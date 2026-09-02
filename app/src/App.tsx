import { useEffect, useMemo, useState } from 'react'
import { Compass, CreditCard, Home, LayoutDashboard, Settings, Share2, Store } from 'lucide-react'
import { getRestaurant, pendingSharesSeed, restaurants as demoRestaurants, setHistoryItems, setProgramClients, setRecentScans, userReviews } from './data'
import type { Loyalty, MenuItem, Restaurant, UserReview } from './data'
import { bootstrapBackend, fetchClients, fetchHistory } from './lib/api'
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
}

const makeDraft = (restaurant: Restaurant): RestoDraft => ({
  profile: {
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    district: restaurant.district,
    address: restaurant.address,
    description: restaurant.description,
    opening: '11:30',
    closing: '23:00',
    diets: [...restaurant.diets],
    image: restaurant.image,
  },
  menu: restaurant.menu.map((item) => ({ ...item })),
  loyalty: { ...restaurant.loyalty },
})

function App() {
  const baseAmina = getRestaurant('amina')
  const [role, setRole] = useState<AppRole | null>(null)
  const [route, setRoute] = useState<Route>({ name: 'home' })
  const [, setRouteStack] = useState<Route[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['amina', 'comptoir', 'miso']))
  const [toast, setToast] = useState('')
  const [backend, setBackend] = useState<BackendState | null>(null)
  const [, setClientsVersion] = useState(0)
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    location: 'Paris et alentours',
    times: [],
    diets: [],
    distance: 5,
    guests: 2,
    maxPrice: 0,
  })

  // Démarrage : on récupère les vraies données du backend (restos + soldes + historique).
  // Si le serveur est éteint, l'app continue avec les données de démonstration.
  useEffect(() => {
    let cancelled = false
    bootstrapBackend(demoRestaurants).then(async (state) => {
      if (cancelled) return
      setBackend(state)
      const history = await fetchHistory()
      if (!cancelled && history.length) setHistoryItems(history)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Espace restaurateur : établissements du compte, établissement actif, brouillons par établissement
  const [customRestaurants, setCustomRestaurants] = useState<Record<string, Restaurant>>({})
  const [myRestaurants, setMyRestaurants] = useState<string[]>(['amina', 'braise'])
  const [activeRestoId, setActiveRestoId] = useState('amina')
  const [drafts, setDrafts] = useState<Record<string, RestoDraft>>({ amina: makeDraft(baseAmina) })

  // Espace restaurateur : clients réels du restaurant actif
  useEffect(() => {
    if (!backend?.connected || role !== 'restaurant') return
    fetchClients(activeRestoId).then((data) => {
      if (!data) return
      setProgramClients(data.clients)
      setRecentScans(data.scans)
      setClientsVersion((version) => version + 1) // force le rafraîchissement des écrans
    })
  }, [backend, role, activeRestoId])

  const baseRestaurant = (id: string) => customRestaurants[id] ?? backend?.restaurants[id] ?? getRestaurant(id)

  const getDraft = (id: string): RestoDraft => drafts[id] ?? makeDraft(baseRestaurant(id))

  const patchDraft = (id: string, patch: Partial<RestoDraft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? makeDraft(baseRestaurant(id))), ...patch } }))
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
            menu: [],
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
    setToast(kind === 'franchise' ? 'Franchise créée — programme et menu copiés' : 'Nouveau restaurant créé — complétez sa façade')
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  // FoodShare : partages membres (attente → publié/refusé) et avis de Camille
  const [sharedPosts, setSharedPosts] = useState<Share[]>(
    pendingSharesSeed.map((share) => ({ ...share, status: 'pending' as const })),
  )
  const [myReviews, setMyReviews] = useState<UserReview[]>(userReviews)

  const publishShare = (input: { restaurantId: string; image: string; caption: string; rating: number }) => {
    setSharedPosts((current) => [
      {
        id: Date.now(),
        restaurantId: input.restaurantId,
        author: 'Camille Robert',
        initials: 'CR',
        image: input.image,
        caption: input.caption,
        rating: input.rating,
        time: 'À l’instant',
        status: 'pending' as const,
      },
      ...current,
    ])
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
  }

  const decideShare = (id: number, publish: boolean) => {
    setSharedPosts((current) =>
      current.map((share) => (share.id === id ? { ...share, status: publish ? ('published' as const) : ('rejected' as const) } : share)),
    )
  }

  // Établissements : suppression en deux temps (archivé → suppression définitive)
  const [archivedPlaces, setArchivedPlaces] = useState<Set<string>>(new Set())

  const archiveRestaurant = (id: string) => {
    setArchivedPlaces((current) => new Set(current).add(id))
    if (id === activeRestoId) {
      const remaining = myRestaurants.filter((place) => place !== id && !archivedPlaces.has(place))
      setActiveRestoId(remaining[0] || 'amina')
    }
    setToast('Restaurant archivé — il reste visible dans « Archivés » ci-dessous')
  }

  const restoreRestaurant = (id: string) => {
    setArchivedPlaces((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setToast('Restaurant restauré')
  }

  const deleteRestaurantForever = (id: string) => {
    setMyRestaurants((current) => current.filter((place) => place !== id))
    setArchivedPlaces((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
    setToast('Restaurant supprimé définitivement')
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
    const balance = backend?.balances[id]
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
      hours: [`Vendredi · ${draft.profile.opening}–${draft.profile.closing}`, ...restaurant.hours.slice(1)],
      menu: draft.menu,
      loyalty: draft.loyalty,
    })
  }

  const activeDraft = getDraft(activeRestoId)
  const activeRestaurant = resolveRestaurant(activeRestoId)

  const resolvedRestaurants = useMemo(
    () => ['amina', 'casa', 'miso', 'comptoir', 'rizrouge', 'braise', ...Object.keys(customRestaurants)].map((id) => resolveRestaurant(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, customRestaurants, backend],
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
    setRole(next)
    setRouteStack([])
    setRoute({ name: next === 'restaurant' ? 'restoDashboard' : 'home' })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
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
      page = <ResultsPage {...common} filters={searchFilters} restaurants={resolvedRestaurants} />
      break
    case 'discovery':
      page = <DiscoveryPage {...common} restaurants={resolvedRestaurants} />
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
      page = <MemberProfilePage {...common} memberId={route.memberId} />
      break
    case 'foodshareCompose':
      page = <FoodshareComposePage {...common} restaurant={resolveRestaurant(route.restaurantId || 'amina')} />
      break
    case 'restoDashboard':
      page = <RestoDashboardPage {...common} restaurant={activeRestaurant} />
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
      page = <HomePage {...common} restaurants={resolvedRestaurants} backendConnected={backend?.connected ?? false} />
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
        {MAIN_PAGES.has(route.name) && <BottomNav role={role} active={route.name} onSelect={goMain} />}
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
