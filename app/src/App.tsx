import { useEffect, useMemo, useRef, useState } from 'react'
import { Compass, CreditCard, Home, LayoutDashboard, Settings, Share2, Store } from 'lucide-react'
import { getRestaurant, pendingSharesSeed, restaurants as demoRestaurants, setHistoryItems, setProgramClients, setRecentScans, userReviews, userVisits } from './data'
import type { Loyalty, MenuItem, Offer, Restaurant, UserReview } from './data'
import { addMyCard, bootstrapBackend, completeLogin, decideShareApi, fetchClients, fetchHistory, fetchMyShares, fetchOwnedRestaurants, fetchPendingShares, getAccount, publishShareApi, refreshMyCards } from './lib/api'
import type { BackendState } from './lib/api'
import type { AppRole, CommonProps, Route, RouteName, SearchFilters, Share } from './nav'
import { BackButton } from './components/kit'
import HomePage from './pages/Home'
import { ResultsPage, SearchPage, TimePage } from './pages/Search'
import { DiscoveryPage, StoryPage } from './pages/Discovery'
import { CardDetailPage, RestaurantPage } from './pages/Restaurant'
import { LoyaltyPage, TransactionPage } from './pages/Loyalty'
import { SettingsPage, UserProfilePage } from './pages/Settings'
import { LikedRestaurantsPage, MemberProfilePage, MyReviewsPage, VisitsPage } from './pages/Member'
import { RestoClientsPage, RestoDashboardPage, RestoFoodsharePage, RestoPlacesPage, RolePickerPage } from './pages/Dashboard'
import { FoodshareComposePage } from './pages/Share'
import { LoyaltyEditorPage, ProfileEditorPage, QrPosterPage } from './pages/Studio'
import type { ProfileDraft } from './pages/Studio'
import { defaultSearchFilters } from './lib/search'
import { readSearchProfiles, saveSearchProfiles, searchProfileOf, searchProfileSchema } from './lib/search-profile'
import { WEEK_DAYS } from './lib/search-catalog'
import { readMyCards, saveMyCards, usedCardIds } from './lib/my-cards'
import { ScanPage } from './pages/Scan'
import { frontRestaurantId } from './lib/api'
import { AdminRestaurantsPage, RestaurantRegistrationPage } from './pages/RestaurantRegistration'

const MAIN_PAGES = new Set<RouteName>([
  'home',
  'discovery',
  'loyalty',
  'settings',
  'restoDashboard',
  'restoFacade',
  'restoFoodshare',
])

interface RestoDraft {
  profile: ProfileDraft
  menu: MenuItem[]
  loyalty: Loyalty
  offers: Offer[]
}

const makeDraft = (restaurant: Restaurant): RestoDraft => ({
  profile: {
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    district: restaurant.district,
    address: restaurant.address,
    description: restaurant.description,
    image: restaurant.image,
    ...searchProfileOf(restaurant),
  },
  menu: restaurant.menu.map((item) => ({ ...item })),
  loyalty: { ...restaurant.loyalty },
  offers: (restaurant.offers ?? []).map((offer) => ({ ...offer })),
})

// Retirer le secret avant tout chargement de contenu ou navigation. Conserver la valeur
// hors de l'effet pour les deux montages de développement de React StrictMode.
const startupUrl = new URL(window.location.href)
const startupLoginToken = startupUrl.searchParams.get('token')
const startupRestaurant = startupUrl.searchParams.get('restaurant')
const startupRole = (() => { try { return startupUrl.searchParams.get('espace') === 'restaurant' || localStorage.getItem('fidelity.interface') === 'restaurant' ? 'restaurant' : 'member' } catch { return 'member' } })()
if (startupUrl.searchParams.has('token')) {
  startupUrl.searchParams.delete('token')
  window.history.replaceState(window.history.state, '', `${startupUrl.pathname}${startupUrl.search}${startupUrl.hash}`)
}

function App() {
  const [role, setRole] = useState<AppRole | null>(() => startupRestaurant ? 'member' : getAccount() || startupRole === 'restaurant' ? startupRole : null)
  const [route, setRoute] = useState<Route>(startupRestaurant && /^[a-z0-9-]{1,120}$/.test(startupRestaurant) ? { name: 'restaurant', restaurantId: frontRestaurantId(startupRestaurant) } : { name: startupRole === 'restaurant' ? 'restoDashboard' : 'home' })
  const [, setRouteStack] = useState<Route[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['amina', 'comptoir', 'miso']))
  const [toast, setToast] = useState('')
  const [backend, setBackend] = useState<BackendState | null>(null)
  const [localCards, setLocalCards] = useState(() => readMyCards(usedCardIds(demoRestaurants, userVisits)))
  const addingCards = useRef(new Set<string>())
  const [pendingCards, setPendingCards] = useState(new Set<string>())
  const [refreshingCards, setRefreshingCards] = useState(false)
  const [, setClientsVersion] = useState(0)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(defaultSearchFilters)
  const [discoveryFilters, setDiscoveryFilters] = useState<SearchFilters>(defaultSearchFilters)
  const [discoveryScope, setDiscoveryScope] = useState<'all' | 'restaurants' | 'members'>('all')
  const [searchProfiles, setSearchProfiles] = useState(readSearchProfiles)

  // Démarrage : on récupère les vraies données du backend (restos + soldes + historique).
  // Si le serveur est éteint, l'app continue avec les données de démonstration.
  useEffect(() => {
    let cancelled = false
    const start = async () => {
      let loginFailed = false
      if (startupLoginToken !== null) {
        try {
          await completeLogin(startupLoginToken)
          if (!cancelled) window.location.reload()
          return
        } catch { loginFailed = true }
      }
      if (cancelled) return
      const state = await bootstrapBackend(demoRestaurants)
      if (cancelled) return
      setBackend(state)
      if (startupRestaurant && !(state.connected ? state.restaurants[frontRestaurantId(startupRestaurant)] : demoRestaurants.some(item => item.id === frontRestaurantId(startupRestaurant)))) {
        setRoute({ name: 'home' }); setToast('Ce restaurant est indisponible. Retrouve les autres tables dans la recherche.')
      }
      if (loginFailed) {
        setRole('member'); setRoute({ name: 'settings' })
        setToast('Lien invalide ou expiré — redemande un lien de connexion.')
      }
      if (!state.connected) return
      setSharedPosts([])
      const history = await fetchHistory()
      if (!cancelled) setHistoryItems(history)
      // FoodShare : les partages réels du membre (en attente, publiés, refusés)
      const mineShares = await fetchMyShares()
      if (!cancelled && mineShares?.length) {
        setSharedPosts((current) => {
          const known = new Set(current.map((share) => share.backendId).filter(Boolean))
          const fresh = mineShares.filter((share) => !known.has(share.backendId))
          return fresh.length ? [...fresh, ...current] : current
        })
      }
    }
    void start()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const expired = () => window.location.reload()
    window.addEventListener('fidelity:session-expired', expired)
    const account = getAccount()
    const timer = account ? window.setInterval(() => { if (!getAccount()) expired() }, 30_000) : undefined
    return () => {
      window.removeEventListener('fidelity:session-expired', expired)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [])

  // Espace restaurateur : établissements du compte, établissement actif, brouillons par établissement
  const [customRestaurants, setCustomRestaurants] = useState<Record<string, Restaurant>>({})
  const [myRestaurants, setMyRestaurants] = useState<string[]>(['amina', 'braise'])
  const [activeRestoId, setActiveRestoId] = useState('amina')
  const [drafts, setDrafts] = useState<Record<string, RestoDraft>>({})
  const [ownerAccess, setOwnerAccess] = useState<'loading' | 'ready' | 'none'>('loading')
  const [ownerRefresh, setOwnerRefresh] = useState(0)
  useEffect(() => {
    if (role !== 'restaurant' || !backend) return
    let cancelled = false
    if (!backend.connected) { setOwnerAccess(getAccount() ? 'none' : 'ready'); return }
    setOwnerAccess('loading')
    fetchOwnedRestaurants().then(items => {
      if (cancelled) return
      const ids = items.filter(item => item.status === 'VERIFIED').map(item => item.frontId)
      setMyRestaurants(ids)
      setActiveRestoId(current => ids.includes(current) ? current : ids[0] || '')
      setOwnerAccess(ids.length ? 'ready' : 'none')
      setBackend(current => current ? { ...current } : current)
    }).catch(() => { if (!cancelled) setOwnerAccess('none') })
    return () => { cancelled = true }
  }, [role, backend?.connected, ownerRefresh])

  // Espace restaurateur : clients réels du restaurant actif
  useEffect(() => {
    if (!backend?.connected || role !== 'restaurant') return
    let cancelled = false
    const refresh = () => fetchClients(activeRestoId).then((data) => {
      if (cancelled) return
      setProgramClients(data?.clients ?? [])
      setRecentScans(data?.scans ?? [])
      setClientsVersion((version) => version + 1) // force le rafraîchissement des écrans
    })
    void refresh()
    const changed = () => void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 15_000)
    window.addEventListener('fidelity:ledger-updated', changed)
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('fidelity:ledger-updated', changed) }
  }, [backend?.connected, role, activeRestoId])

  // Espace restaurateur : file FoodShare réelle (partages en attente de validation)
  useEffect(() => {
    if (!backend?.connected || role !== 'restaurant') return
    fetchPendingShares(activeRestoId).then((shares) => {
      if (!shares?.length) return
      setSharedPosts((current) => {
        const known = new Set(current.map((share) => share.backendId).filter(Boolean))
        const fresh = shares.filter((share) => !known.has(share.backendId))
        return fresh.length ? [...fresh, ...current] : current
      })
    })
  }, [backend, role, activeRestoId])

  const baseRestaurant = (id: string): Restaurant => {
    const restaurant = { ...(customRestaurants[id] ?? backend?.restaurants[id] ?? getRestaurant(id)), ...searchProfiles[id] }
    return restaurant.openingHours ? { ...restaurant,
      hours: restaurant.openingHours.filter((day) => day.intervals.length).map((day) => `${WEEK_DAYS[day.day]} · ${day.intervals.map((period) => `${period.open}–${period.close}`).join(' / ')}`),
    } : restaurant
  }

  const getDraft = (id: string): RestoDraft => drafts[id] ?? makeDraft(baseRestaurant(id))

  const patchDraft = (id: string, patch: Partial<RestoDraft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? makeDraft(baseRestaurant(id))), ...patch } }))
    if (patch.profile) {
      const parsed = searchProfileSchema.safeParse(patch.profile)
      if (parsed.success) {
        const next = { ...searchProfiles, [id]: parsed.data }
        setSearchProfiles(next)
        if (!saveSearchProfiles(next)) setToast('Le navigateur ne peut pas conserver ces critères après fermeture.')
      }
    }
  }

  const selectRestaurant = (id: string) => {
    setDrafts((current) => (current[id] ? current : { ...current, [id]: makeDraft(baseRestaurant(id)) }))
    setActiveRestoId(id)
    setRouteStack([])
    setRoute({ name: 'restoDashboard' })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  const addRestaurant = (kind: 'franchise' | 'new') => {
    const base = resolveRestaurant(activeRestoId)
    const id = `resto-${Date.now() % 100000}`
    const created: Restaurant =
      kind === 'franchise'
        ? {
            ...base,
            id,
            name: `${base.name} · Batignolles`,
            district: 'Paris 17e',
            address: 'Adresse à compléter',
            rating: '—',
            menu: base.menu.map((item) => ({ ...item })),
            loyalty: { ...base.loyalty },
            reviews: [],
          }
        : {
            ...base,
            id,
            name: 'Nouveau restaurant',
            cuisine: 'Cuisine à définir',
            district: 'Paris',
            address: 'Adresse à compléter',
            description: 'Présentez votre table en quelques phrases.',
            rating: '—',
            open: true,
            hours: ['Vendredi · 11:30–23:00'],
            diets: [],
            foodTags: [], services: [], openingHours: [], avgPrice: 0, maxGuests: 0,
            menu: [],
            offers: [],
            loyalty: {
              type: 'stamps',
              title: 'Mon programme',
              current: 0,
              target: 10,
              reward: 'Une récompense offerte',
              rule: 'Une coche par visite.',
              eurosPerStamp: 0,
              tiers: [{ at: 10, reward: 'Une récompense offerte' }],
              style: 'braise',
            },
            reviews: [],
          }
    setCustomRestaurants((current) => ({ ...current, [id]: created }))
    setMyRestaurants((current) => [...current, id])
    setDrafts((current) => ({ ...current, [id]: makeDraft(created) }))
    setActiveRestoId(id)
    setRouteStack([])
    setRoute({ name: 'restoDashboard' })
    setToast(kind === 'franchise' ? 'Brouillon local créé — programme et menu copiés' : 'Brouillon local créé — complétez la façade pour préparer votre établissement')
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  // FoodShare : partages membres (attente → publié/refusé) et avis de Camille
  const [sharedPosts, setSharedPosts] = useState<Share[]>(
    pendingSharesSeed.map((share) => ({ ...share, status: 'pending' as const })),
  )
  const [myReviews, setMyReviews] = useState<UserReview[]>(userReviews)

  const publishShare = async (input: { restaurantId: string; image: string; caption: string; rating: number }): Promise<boolean> => {
    // Backend branché : la note compte tout de suite (avis), la photo part en attente.
    const addLocalReview = () =>
      setMyReviews((current) => [
        {
          id: Date.now(),
          restaurantId: input.restaurantId,
          rating: `${input.rating}/5`,
          date: '31 juil. 2026',
          text: input.caption || 'Visite partagée via FoodShare.',
        },
        ...current,
      ])

    if (backend?.connected) {
      const result = await publishShareApi(input.restaurantId, input)
      if (result === 'forbidden') {
        setToast('FoodShare disponible après votre première commande dans ce restaurant')
        return false
      }
      if (result) {
        setSharedPosts((current) => [result, ...current.filter((share) => share.backendId !== result.backendId)])
        addLocalReview()
        return true
      }
      setToast('Publication non confirmée. Vérifie ta connexion ou attends une nouvelle visite pour proposer un autre FoodShare.')
      return false
    }

    if (getAccount()) { setToast('Connexion au serveur nécessaire pour publier avec ton compte.'); return false }

    setSharedPosts((current) => [
      {
        id: Date.now(),
        restaurantId: input.restaurantId,
        author: 'Camille Robert',
        memberId: 'camille',
        initials: 'CR',
        image: input.image,
        caption: input.caption,
        rating: input.rating,
        time: 'À l’instant',
        status: 'pending' as const,
      },
      ...current,
    ])
    addLocalReview()
    return true
  }

  const decidingShares = useRef(new Set<number>())
  const decideShare = async (id: number, publish: boolean, rewardDelta = 1): Promise<boolean> => {
    if (decidingShares.current.has(id)) return false
    const target = sharedPosts.find((share) => share.id === id)
    if (!target) return false
    decidingShares.current.add(id)
    try {
      if (target.backendId && !await decideShareApi(target.backendId, publish, rewardDelta)) {
        setToast('Le serveur n’a pas confirmé la décision. Recharge la file avant de réessayer.')
        return false
      }
      if (!target.backendId && backend?.connected) { setToast('Ce partage de démonstration ne peut pas être crédité.'); return false }
    setSharedPosts((current) =>
      current.map((share) => (share.id === id ? { ...share, status: publish ? ('published' as const) : ('rejected' as const) } : share)),
    )
      window.dispatchEvent(new Event('fidelity:ledger-updated'))
      return true
    } finally { decidingShares.current.delete(id) }
  }

  // Établissements : suppression en deux temps (archivé → suppression définitive)
  const [archivedPlaces, setArchivedPlaces] = useState<Set<string>>(new Set())

  const archiveRestaurant = (id: string) => {
    setArchivedPlaces((current) => new Set(current).add(id))
    if (id === activeRestoId) {
      const remaining = myRestaurants.filter((place) => place !== id && !archivedPlaces.has(place))
      setActiveRestoId(remaining[0] || 'amina')
    }
    setToast('Restaurant masqué dans cet aperçu local')
  }

  const restoreRestaurant = (id: string) => {
    setArchivedPlaces((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setToast('Restaurant réaffiché dans cet aperçu')
  }

  const deleteRestaurantForever = (id: string) => {
    setMyRestaurants((current) => current.filter((place) => place !== id))
    setArchivedPlaces((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setToast('Restaurant retiré de la liste locale. Les données du serveur sont conservées.')
  }

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const resolveRestaurant = (id: string) => {
    const restaurant = baseRestaurant(id)
    const draft = drafts[id]
    // Le solde réel du backend prime toujours sur les valeurs de démonstration
    const balance = backend?.connected ? backend.balances[id] ?? 0 : getAccount() ? 0 : undefined
    const withBalance = (input: Restaurant): Restaurant =>
      balance === undefined ? input : { ...input, loyalty: { ...input.loyalty, current: balance } }
    if (!draft) return withBalance(restaurant)
    return withBalance({
      ...restaurant,
      name: draft.profile.name,
      cuisine: draft.profile.cuisine,
      district: draft.profile.district,
      address: draft.profile.address,
      description: draft.profile.description,
      diets: draft.profile.diets,
      menu: draft.menu,
      loyalty: draft.loyalty,
      offers: draft.offers,
      foodTags: draft.profile.foodTags,
      services: draft.profile.services,
      openingHours: draft.profile.openingHours,
      avgPrice: draft.profile.avgPrice,
      maxGuests: draft.profile.maxGuests,
      hours: draft.profile.openingHours.filter((day) => day.intervals.length).map((day) =>
        `${WEEK_DAYS[day.day]} · ${day.intervals.map((period) => `${period.open}–${period.close}`).join(' / ')}`),
    })
  }

  const activeDraft = getDraft(activeRestoId)
  const activeRestaurant = resolveRestaurant(activeRestoId)

  const resolvedRestaurants = useMemo(
    () => [...new Set([...(backend?.connected ? Object.keys(backend.restaurants) : demoRestaurants.map((restaurant) => restaurant.id)), ...Object.keys(customRestaurants)])]
      .filter((id) => !archivedPlaces.has(id)).map((id) => resolveRestaurant(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, customRestaurants, backend, searchProfiles, archivedPlaces],
  )

  const go = (name: RouteName, params: Omit<Route, 'name'> = {}) => {
    setRouteStack((previous) => [...previous, route])
    setRoute({ name, ...params })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  const goMain = (name: RouteName) => {
    setRouteStack([])
    setRoute({ name })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  const goBack = () => {
    setRouteStack((previous) => {
      const next = [...previous]
      setRoute(next.pop() || { name: role === 'restaurant' ? 'restoDashboard' : 'home' })
      return next
    })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  const switchRole = (next: AppRole) => {
    try { localStorage.setItem('fidelity.interface', next) } catch { /* Le choix d’interface reste utilisable sans stockage. */ }
    const url = new URL(window.location.href); url.searchParams.delete('espace')
    window.history.replaceState(window.history.state, '', url.pathname + url.search)
    setRole(next)
    if (next === 'restaurant') { setOwnerAccess('loading'); setOwnerRefresh(value => value + 1) }
    setRouteStack([])
    setRoute({ name: next === 'restaurant' ? 'restoDashboard' : 'home' })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  const hasCard = (id: string) => backend?.connected ? !!backend.memberships[id] : !getAccount() && !!backend && localCards.has(id)

  const addCard = async (id: string) => {
    if (!backend) throw new Error('Vos cartes sont en cours de chargement. Réessayez dans un instant.')
    if (hasCard(id) || addingCards.current.has(id)) return
    addingCards.current.add(id)
    setPendingCards(new Set(addingCards.current))
    try {
      if (backend.connected) {
        setBackend(await addMyCard(id))
      } else {
        // Relire le stockage pour conserver aussi les ajouts d'un autre onglet.
        const next = readMyCards([...localCards])
        next.add(id)
        try { saveMyCards(next) } catch { throw new Error('Le navigateur ne peut pas enregistrer cette carte. Autorisez le stockage puis réessayez.') }
        setLocalCards(next)
      }
      setToast('Carte ajoutée à « Mes cartes »')
    } catch (error) {
      if (error instanceof TypeError) throw new Error('Connexion au serveur impossible. Réessayez pour ajouter votre carte.')
      throw error
    } finally {
      addingCards.current.delete(id)
      setPendingCards(new Set(addingCards.current))
    }
  }

  const reloadCards = async () => {
    setRefreshingCards(true)
    try { setBackend(await refreshMyCards()) }
    catch { setToast('Vos cartes sont indisponibles pour le moment. Réessayez plus tard.') }
    finally { setRefreshingCards(false) }
  }

  const common: CommonProps = {
    go,
    goBack,
    favorites,
    toggleFavorite: (id: string) => {
      setFavorites((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    resolveRestaurant,
    notify: setToast,
    hasCard,
    addCard,
    isAddingCard: (id) => pendingCards.has(id),
    cardsLoading: !backend || refreshingCards,
    cardsUnavailable: !!backend?.connected && !backend.membershipsReady,
    reloadCards,
    syncCards: setBackend,
    switchRole,
    sharedPosts,
    publishShare,
    decideShare,
    myReviews,
  }

  let page
  switch (route.name) {
    case 'search':
      page = <SearchPage {...common} filters={searchFilters} setFilters={setSearchFilters} restaurants={resolvedRestaurants} />
      break
    case 'time':
      page = <TimePage {...common} filters={searchFilters} setFilters={setSearchFilters} />
      break
    case 'results':
      page = <ResultsPage {...common} filters={searchFilters} setFilters={setSearchFilters} restaurants={resolvedRestaurants} />
      break
    case 'discovery':
      page = <DiscoveryPage {...common} restaurants={resolvedRestaurants} filters={discoveryFilters} setFilters={setDiscoveryFilters} scope={discoveryScope} setScope={setDiscoveryScope} />
      break
    case 'story':
      page = <StoryPage {...common} storyIndex={route.storyIndex || 0} />
      break
    case 'restaurant':
      page = <RestaurantPage {...common} restaurant={resolveRestaurant(route.restaurantId || 'amina')} />
      break
    case 'card':
      page = <CardDetailPage {...common} restaurant={resolveRestaurant(route.restaurantId || 'amina')} />
      break
    case 'loyalty':
      page = <LoyaltyPage {...common} restaurants={resolvedRestaurants} />
      break
    case 'transaction':
      page = <TransactionPage {...common} transactionId={route.transactionId} />
      break
    case 'settings':
      page = <SettingsPage {...common} />
      break
    case 'restoRegistration':
      page = <RestaurantRegistrationPage {...common} />
      break
    case 'adminRestaurants':
      page = <AdminRestaurantsPage />
      break
    case 'userProfile':
      page = <UserProfilePage {...common} />
      break
    case 'likedRestaurants':
      page = <LikedRestaurantsPage {...common} memberId={route.memberId} />
      break
    case 'visits':
      page = <VisitsPage {...common} memberId={route.memberId} />
      break
    case 'myReviews':
      page = <MyReviewsPage {...common} memberId={route.memberId} />
      break
    case 'memberProfile':
      page = <MemberProfilePage key={route.memberId} {...common} memberId={route.memberId} />
      break
    case 'foodshareCompose':
      page = <FoodshareComposePage {...common} restaurant={resolveRestaurant(route.restaurantId || 'amina')} />
      break
    case 'restoDashboard':
      page = <RestoDashboardPage {...common} restaurant={activeRestaurant} />
      break
    case 'restoScan':
      page = <ScanPage {...common} restaurantId={activeRestoId} />
      break
    case 'restoClients':
      page = <RestoClientsPage {...common} restaurant={activeRestaurant} />
      break
    case 'restoFacade':
      page = (
        <ProfileEditorPage
          {...common}
          withNav
          restaurantId={activeRestoId}
          draft={activeDraft.profile}
          setDraft={(profile) => patchDraft(activeRestoId, { profile })}
          menu={activeDraft.menu}
          setMenu={(menu) => patchDraft(activeRestoId, { menu })}
          offers={activeDraft.offers}
          setOffers={(offers) => patchDraft(activeRestoId, { offers })}
        />
      )
      break
    case 'restoFoodshare':
      page = <RestoFoodsharePage {...common} restaurant={activeRestaurant} />
      break
    case 'restoPlaces':
      page = (
        <RestoPlacesPage
          {...common}
          restaurant={activeRestaurant}
          restaurants={myRestaurants.filter((id) => !archivedPlaces.has(id)).map((id) => resolveRestaurant(id))}
          archivedRestaurants={[...archivedPlaces].map((id) => resolveRestaurant(id))}
          activeId={activeRestoId}
          onSelect={selectRestaurant}
          onAdd={addRestaurant}
          onArchive={archiveRestaurant}
          onRestore={restoreRestaurant}
          onDeleteForever={deleteRestaurantForever}
        />
      )
      break
    case 'loyaltyEditor':
      page = (
        <LoyaltyEditorPage
          {...common}
          restaurant={activeRestaurant}
          draft={activeDraft.loyalty}
          setDraft={(loyalty) => patchDraft(activeRestoId, { loyalty })}
        />
      )
      break
    case 'qrPoster':
      page = <QrPosterPage {...common} restaurant={resolveRestaurant(route.restaurantId || 'amina')} />
      break
    default:
      page = <HomePage {...common} restaurants={resolvedRestaurants} backendConnected={backend?.connected ?? false} filters={searchFilters} setFilters={setSearchFilters} />
  }

  if (role === 'restaurant' && ownerAccess !== 'ready' && !['settings', 'restoRegistration', 'adminRestaurants'].includes(route.name)) {
    page = ownerAccess === 'loading' ? <main className="page"><h1>Espace restaurateur</h1><p role="status">Chargement de vos établissements…</p></main> : <RestaurantRegistrationPage {...common} />
  }

  if (backend === null) {
    return (
      <div className="stage">
        <div className="app-shell">
          <main className="role-picker">
            <span className="loyalty-logo role-logo">F</span>
            <span className="eyebrow">Fidelity</span>
            <h1 style={{ margin: '8px 0 4px' }}>À table, tout simplement</h1>
            <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
              Connexion au serveur…
            </p>
          </main>
        </div>
      </div>
    )
  }

  if (role === null) {
    return (
      <div className="stage">
        <div className="app-shell">
          <RolePickerPage onSelect={switchRole} />
        </div>
      </div>
    )
  }

  return (
    <div className="stage">
      <div className={`app-shell ${route.name === 'story' ? 'story-shell' : ''} ${MAIN_PAGES.has(route.name) ? '' : 'has-fixed-back'}`}>
        {!MAIN_PAGES.has(route.name) && route.name !== 'story' && <BackButton onClick={goBack} />}
        {page}
        {MAIN_PAGES.has(route.name) && !(role === 'restaurant' && ownerAccess !== 'ready') && <BottomNav role={role} active={route.name} onSelect={goMain} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}

function BottomNav({ role, active, onSelect }: { role: AppRole; active: RouteName; onSelect: (name: RouteName) => void }) {
  const memberItems: Array<[RouteName, typeof Home, string]> = [
    ['home', Home, 'Accueil'],
    ['discovery', Compass, 'Discovery'],
    ['loyalty', CreditCard, 'Fidélité'],
    ['settings', Settings, 'Réglages'],
  ]
  const restaurantItems: Array<[RouteName, typeof Home, string]> = [
    ['restoDashboard', LayoutDashboard, 'Résumé'],
    ['restoFacade', Store, 'Façade'],
    ['restoFoodshare', Share2, 'FoodShare'],
  ]
  const items = role === 'restaurant' ? restaurantItems : memberItems
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map(([name, Icon, label]) => (
        <button key={name} type="button" className={active === name ? 'active' : ''} onClick={() => onSelect(name)}>
          <Icon size={21} strokeWidth={1.55} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

export default App
