import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, Bookmark, ChevronRight, Clock3, Heart, MessageCircle, Plus, Send, Store, X } from 'lucide-react'
import { feedPosts, members, stories } from '../data'
import type { FeedPost, Restaurant } from '../data'
import type { CommonProps, SearchFilters } from '../nav'
import { QuickFilters, SearchBox } from '../components/SearchControls'
import { SearchFacets } from './Search'
import { activeFilterCount, defaultSearchFilters, normalizeSearch, searchMembers } from '../lib/search'
import { useRestaurantSearch } from '../hooks/use-search'
import { useMemberSearch } from '../hooks/use-member-search'
import { fetchPublicShares, fetchSocialState, getAccount, getBackendState, restaurantLink, setMemberFollow, setPostLike } from '../lib/api'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { feedAuthorRoute, shareToFeedPost } from '../lib/feed'

const DISCOVERY_TABS = ['Pour vous', 'Nouveautés', 'Proximité', 'Enregistrés']
function readSaved(key: string): number[] { try { const data = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(data) ? data.filter(value => typeof value === 'number') : [] } catch { return [] } }

export function DiscoveryPage({ go, notify, resolveRestaurant, restaurants, sharedPosts = [], filters, setFilters, scope, setScope, hasCard }: CommonProps & {
  restaurants: Restaurant[]; filters: SearchFilters; setFilters: (filters: SearchFilters) => void
  scope: 'all' | 'restaurants' | 'members'; setScope: (scope: 'all' | 'restaurants' | 'members') => void
}) {
  const [activeTab, setActiveTab] = useState('Pour vous')
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set([1]))
  const savedKey = `fidelity.saved-posts.${getAccount()?.user.id || 'demo'}`
  const [savedPosts, setSavedPosts] = useState<Set<number>>(() => new Set(readSaved(savedKey)))
  const [composer, setComposer] = useState(false)
  const [publicPosts, setPublicPosts] = useState<FeedPost[]>([])
  const [remoteLikes, setRemoteLikes] = useState(new Set<string>())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [busyActions, setBusyActions] = useState(new Set<string>())
  const actions = useRef(new Set<string>())
  useEffect(() => { try { localStorage.setItem(savedKey, JSON.stringify([...savedPosts])) } catch { notify('Le navigateur ne peut pas conserver les publications enregistrées.') } }, [savedPosts, savedKey])
  const [followed, setFollowed] = useState<Set<string>>(new Set(['restaurant:casa']))
  const [noticeVisible, setNoticeVisible] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const query = filters.query

  const normalizedQuery = normalizeSearch(query)
  const handleSearch = query.trim().startsWith('@')
  const localMembers = useMemo(() => normalizedQuery
    ? searchMembers(members, query).map((hit) => hit.item)
    : scope === 'members' ? members : [], [query, normalizedQuery, scope])
  const matchedRestaurants = useRestaurantSearch(restaurants, filters)
  const hasFilters = activeFilterCount(filters) > 0
  const searching = !!query.trim() || hasFilters || scope !== 'all'
  const showMembers = handleSearch || (scope !== 'restaurants' && !hasFilters)
  const showRestaurants = !handleSearch && scope !== 'members'
  const online = getBackendState().connected
  useEffect(() => {
    if (!online) return
    let cancelled = false
    void fetchPublicShares().then(shares => { if (!cancelled) setPublicPosts(shares.map(shareToFeedPost)) }).catch(() => {})
    void fetchSocialState().then(state => { if (!cancelled) { setRemoteLikes(new Set(state.likedPostIds)); setFollowed(previous => new Set([...previous, ...state.followedMemberIds.map(id => `member:${id}`)])) } }).catch(() => {})
    return () => { cancelled = true }
  }, [online])
  const remoteMembers = useMemberSearch(query, online && showMembers)
  const matchedMembers = online ? remoteMembers.items : localMembers
  const changeFilters = (next: SearchFilters) => { setFilters(next); setScope('restaurants') }
  const changeScope = (next: 'all' | 'restaurants' | 'members') => {
    setScope(next)
    setShowFilters(false)
    const nextQuery = next !== 'members' && handleSearch ? query.replace(/^\s*@/, '') : query
    if (next === 'members' || next === 'all') setFilters({ ...defaultSearchFilters(), query: nextQuery })
    else setFilters({ ...filters, query: nextQuery })
  }

  const toggleNumber = (setter: React.Dispatch<React.SetStateAction<Set<number>>>, value: number) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const toggleFollow = (id: string) => {
    setFollowed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const publishedShares = sharedPosts.filter((share) => share.status === 'published').map(shareToFeedPost)
  const allPosts = [...new Map([...publishedShares, ...publicPosts].map(post => [post.backendId || post.id, post])).values(), ...feedPosts]
  async function perform(key: string, operation: () => Promise<void>) {
    if (actions.current.has(key)) return
    actions.current.add(key); setBusyActions(new Set(actions.current))
    try { await operation() } catch (cause) { notify(cause instanceof Error ? cause.message : 'Action impossible. Réessaie.') }
    finally { actions.current.delete(key); setBusyActions(new Set(actions.current)) }
  }
  function like(post: FeedPost) {
    if (!post.backendId) { toggleNumber(setLikedPosts, post.id); return }
    void perform(`like:${post.backendId}`, async () => {
      const result = await setPostLike(post.backendId!, !remoteLikes.has(post.backendId!))
      setRemoteLikes(current => { const next = new Set(current); if (result.active) next.add(post.backendId!); else next.delete(post.backendId!); return next })
      setLikeCounts(current => ({ ...current, [post.backendId!]: result.count }))
    })
  }
  function follow(post: FeedPost, authorKey: string) {
    if (!post.backendId || !post.memberId) { toggleFollow(authorKey); return }
    void perform(authorKey, async () => { await setMemberFollow(post.memberId!, !followed.has(authorKey)); toggleFollow(authorKey) })
  }
  const distance = (id: string) => { const value = resolveRestaurant(id).distance.replace(',', '.'); return (parseFloat(value) || 0) * (value.includes('km') ? 1000 : 1) }
  const visiblePosts = activeTab === 'Enregistrés' ? allPosts.filter(post => savedPosts.has(post.id))
    : activeTab === 'Proximité' ? [...allPosts].sort((a, b) => distance(a.restaurantId) - distance(b.restaurantId)) : allPosts
  async function shareRestaurant(id: string) {
    const url = restaurantLink(id), title = resolveRestaurant(id).name
    try {
      if (navigator.share) await navigator.share({ title, text: 'Une adresse à découvrir sur Fidelity', url })
      else { await navigator.clipboard.writeText(url); notify('Lien du restaurant copié.') }
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) notify('Le partage est indisponible. Ouvre la fiche du restaurant pour copier son adresse.') }
  }

  return (
    <main className="page page-with-nav">
      <div className="discovery-titlebar">
        <button className="round-button" type="button" aria-label="Partager ma visite" onClick={() => setComposer(true)}>
          <Plus size={24} strokeWidth={1.7} />
        </button>
        <h1 style={{ margin: 0 }}>Découvrir</h1>
        <span className="titlebar-spacer" aria-hidden="true" />
      </div>

      <SearchBox label="Rechercher dans Discovery" placeholder="Une table, une cuisine, @pseudo…"
        value={query} onChange={(query) => setFilters({ ...filters, query })}
        onFilters={scope !== 'members' && !handleSearch ? () => setShowFilters(!showFilters) : undefined}
        filterCount={activeFilterCount(filters)} />
      {scope !== 'members' && !handleSearch && <QuickFilters filters={filters} onChange={changeFilters} />}
      <div className="search-scopes" role="group" aria-label="Type de résultats">
        {([['all', 'Tout'], ['restaurants', 'Tables'], ['members', 'Personnes']] as const).map(([value, label]) =>
          <button type="button" key={value} aria-pressed={handleSearch ? value === 'members' : scope === value}
            className={(handleSearch ? value === 'members' : scope === value) ? 'active' : ''}
            onClick={() => changeScope(value)}>{label}</button>
        )}
      </div>
      {showFilters && <section className="discovery-filter-panel" aria-label="Filtres des tables">
        <SearchFacets filters={filters} setFilters={changeFilters} />
        <button className="outline-button full" type="button" onClick={() => setShowFilters(false)}>Voir les tables</button>
      </section>}

      {searching ? (
        <section className="search-results">
          <div className="search-summary">
            <p role="status">{(showMembers ? matchedMembers.length : 0) + (showRestaurants ? matchedRestaurants.length : 0)} résultat(s)</p>
            <button type="button" className="text-link" onClick={() => { setFilters(defaultSearchFilters()); setScope('all'); setShowFilters(false) }}>Tout effacer</button>
          </div>
          {showMembers && <>
          <h2>Personnes</h2>
          {online && remoteMembers.loading ? <p role="status" className="search-help muted">Recherche des personnes…</p>
          : online && remoteMembers.error ? <div><p className="search-help muted">La recherche de personnes est momentanément indisponible.</p><button className="text-link" type="button" onClick={remoteMembers.retry}>Réessayer</button></div>
          : online && !remoteMembers.eligible ? <p className="search-help muted">Saisissez au moins 2 caractères du nom ou du pseudo.</p>
          : matchedMembers.length ? matchedMembers.map((member) => (
            <button className="settings-row" key={member.id} type="button" onClick={() => go('memberProfile', { memberId: member.id })}>
              <span className="member-avatar">{member.initials}</span>
              <span><strong>{member.name}</strong><small>{member.handle}</small></span>
              <ChevronRight size={18} color="var(--muted-soft)" />
            </button>
          )) : <p className="search-help muted">Aucune personne trouvée. Essayez son nom ou son @pseudo.</p>}
          </>}
          {showRestaurants && <>
          <h2>Tables</h2>
          {matchedRestaurants.length ? matchedRestaurants.map((restaurant) => (
            <button className="settings-row" key={restaurant.id} type="button" onClick={() => go('restaurant', { restaurantId: restaurant.id })}>
              <span><Store size={18} /></span>
              <span><strong>{restaurant.name}</strong><small>{restaurant.cuisine} · {restaurant.district}</small></span>
              <ChevronRight size={18} color="var(--muted-soft)" />
            </button>
          )) : <p className="search-help muted">Aucune table trouvée. Essayez un autre plat ou retirez un filtre.</p>}
          </>}
        </section>
      ) : (
        <>
      <div className="segmented">
        {DISCOVERY_TABS.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>

      <span className="preview-label">
        <Clock3 size={15} /> Stories et suggestions de démonstration
      </span>

      <div className="stories-row">
        {[
          { name: 'Casa Verde', image: '/images/tacos.webp', index: 0, count: 4 },
          { name: 'Camille R.', image: '', index: 2, count: 2 },
          { name: 'Atelier Miso', image: '/images/ramen.webp', index: 1, count: 2 },
        ].map((story) => (
          <button className="story-item" type="button" key={story.name} onClick={() => go('story', { storyIndex: story.index })}>
            <span className="story-circle" style={story.image ? { backgroundImage: `url(${story.image})` } : undefined}>
              {!story.image && 'CR'}
              <i>{story.count}</i>
            </span>
            <small>{story.name}</small>
          </button>
        ))}
      </div>

      {noticeVisible && (
        <div className="inline-notice">
          <span>Après une visite créditée en caisse, le bouton + permet de publier votre FoodShare.</span>
          <button type="button" onClick={() => setNoticeVisible(false)}>
            Fermer
          </button>
        </div>
      )}

      {visiblePosts.length ? (
        visiblePosts.map((post) => {
          const restaurant = resolveRestaurant(post.restaurantId)
          const liked = post.backendId ? remoteLikes.has(post.backendId) : likedPosts.has(post.id)
          const saved = savedPosts.has(post.id)
          const authorRoute = feedAuthorRoute(post)
          const authorKey = post.authorType === 'member' ? `member:${post.memberId}` : `restaurant:${post.restaurantId}`
          const isFollowing = followed.has(authorKey)
          const openAuthor = () => {
            if (authorRoute) go(authorRoute.name, authorRoute)
            else notify('Le profil de cette personne n’est plus disponible.')
          }
          return (
            <article className="feed-post" key={post.backendId || post.id}>
              <header>
                <button type="button" className="avatar" aria-label={`Voir le compte de ${post.author}`} onClick={openAuthor} style={{ backgroundImage: `url(${post.image})` }}>
                  {!post.image && post.author.slice(0, 1)}
                </button>
                <button type="button" onClick={openAuthor}>
                  <strong>
                    {post.author}
                    {post.verified && <BadgeCheck size={16} className="verified" fill="currentColor" stroke="#fbf5ed" />}
                  </strong>
                  <span>{post.handle || restaurant.district}</span>
                </button>
                <button
                  className={`follow-button ${isFollowing ? 'following' : ''}`}
                  type="button"
                  disabled={!authorRoute || busyActions.has(authorKey) || (post.backendId !== undefined && post.memberId === getAccount()?.user.id)}
                  onClick={() => follow(post, authorKey)}
                >
                  {isFollowing ? 'Suivi' : 'Suivre'}
                </button>
              </header>
              <button className="post-image" type="button" aria-label={`Voir ${restaurant.name}`} onClick={() => go('restaurant', { restaurantId: post.restaurantId })}>
                <img src={post.image} alt="" />
              </button>
              <div className="post-actions">
                <button type="button" className={liked ? 'active' : ''} disabled={busyActions.has(`like:${post.backendId}`)} onClick={() => like(post)} aria-label="Aimer" aria-pressed={liked}>
                  <Heart fill={liked ? 'currentColor' : 'none'} />
                </button>
                <button type="button" aria-label="Donner mon avis sur ce restaurant" onClick={() => go('foodshareCompose', { restaurantId: post.restaurantId })}>
                  <MessageCircle />
                </button>
                <button type="button" aria-label="Partager le restaurant" onClick={() => void shareRestaurant(post.restaurantId)}>
                  <Send />
                </button>
                <button type="button" className={saved ? 'active' : ''} onClick={() => toggleNumber(setSavedPosts, post.id)} aria-label="Enregistrer">
                  <Bookmark fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="post-copy">
                <strong>{post.backendId ? likeCounts[post.backendId] ?? post.likes : post.likes + (liked ? 1 : 0)} coups de cœur</strong>
                <p>
                  <button className="post-author" type="button" onClick={openAuthor}>{post.author}</button> {post.text}
                </p>
                <button type="button" onClick={() => go('restaurant', { restaurantId: post.restaurantId })}>
                  Voir la fiche de {restaurant.name}
                </button>
                <small>{post.time}</small>
              </div>
            </article>
          )
        })
      ) : (
        <div className="empty-state">
          <span>
            <Heart size={26} />
          </span>
          <h2 style={{ margin: 0 }}>Rien ici pour l’instant</h2>
          <p>Aucune publication ne correspond à cette sélection pour le moment.</p>
          <button className="outline-button" type="button" onClick={() => setActiveTab('Pour vous')}>
            Voir tout le flux
          </button>
        </div>
      )}
        </>
      )}
      <Dialog open={composer} onOpenChange={setComposer}>
        <DialogContent><DialogTitle>Partager ma visite</DialogTitle><DialogDescription>Choisis une de tes cartes. Une visite créditée en caisse est nécessaire pour publier un FoodShare.</DialogDescription>
          <div className="compose-restaurants">{restaurants.filter(item => hasCard(item.id)).map(item => <button className="settings-row" type="button" key={item.id} onClick={() => { setComposer(false); go('foodshareCompose', { restaurantId: item.id }) }}><span><Store size={18} /></span><span><strong>{item.name}</strong></span><ChevronRight size={18} /></button>)}</div>
          <button className="outline-button full" type="button" onClick={() => { setComposer(false); go('loyalty') }}>Voir mes cartes</button>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export function StoryPage({ go, goBack, storyIndex = 0 }: CommonProps & { storyIndex?: number }) {
  const [index, setIndex] = useState(storyIndex % stories.length)
  const story = stories[index]

  const openAuthor = () => {
    if (story.restaurantId) go('restaurant', { restaurantId: story.restaurantId })
    else if (story.memberId) go('memberProfile', { memberId: story.memberId })
  }

  return (
    <main className="story-page">
      <div className="story-progress">
        {stories.map((_, progressIndex) => (
          <span key={progressIndex} className={progressIndex <= index ? 'active' : ''} />
        ))}
      </div>
      <header>
        <button className="story-author" type="button" onClick={openAuthor} aria-label={`Voir le compte de ${story.author}`}>
          <span className="avatar">{story.author.split(' ').map((word) => word[0]).join('').slice(0, 2)}</span>
          <div>
            <strong>{story.author}</strong>
            <small>{story.meta}</small>
          </div>
        </button>
      </header>
      <button className="story-close" type="button" onClick={goBack} aria-label="Fermer la story">
        <X size={20} />
      </button>
      <div className="story-stage">
        <img className="story-image" src={story.image} alt="" />
        <button
          className="story-tap left"
          type="button"
          onClick={() => setIndex((index - 1 + stories.length) % stories.length)}
          aria-label="Story précédente"
        />
        <button
          className="story-tap right"
          type="button"
          onClick={() => setIndex((index + 1) % stories.length)}
          aria-label="Story suivante"
        />
      </div>
      <div className="story-caption">
        <p>{story.caption}</p>
        <Heart size={25} strokeWidth={1.6} />
      </div>
    </main>
  )
}
