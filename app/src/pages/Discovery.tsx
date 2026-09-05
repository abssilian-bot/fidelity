import { useMemo, useState } from 'react'
import { BadgeCheck, Bookmark, ChevronRight, Clock3, Heart, MessageCircle, Plus, Send, Store, X } from 'lucide-react'
import { feedPosts, getRestaurant, members, stories } from '../data'
import type { FeedPost, Restaurant } from '../data'
import type { CommonProps, SearchFilters } from '../nav'
import { QuickFilters, SearchBox } from '../components/SearchControls'
import { SearchFacets } from './Search'
import { activeFilterCount, defaultSearchFilters, normalizeSearch, searchMembers } from '../lib/search'
import { useRestaurantSearch } from '../hooks/use-search'
import { useMemberSearch } from '../hooks/use-member-search'
import { getBackendState } from '../lib/api'

const DISCOVERY_TABS = ['Pour vous', 'Nouveautés', 'Proximité']

/** Les FoodShare validés par les restaurants rejoignent le fil public. */
const shareToFeedPost = (share: { id: number; restaurantId: string; author: string; image: string; caption: string; time: string }): FeedPost => ({
  id: share.id + 1_000_000,
  restaurantId: share.restaurantId,
  author: share.author,
  verified: false,
  image: share.image,
  likes: 0,
  text: share.caption || 'A partagé sa visite via FoodShare.',
  time: share.time,
})

export function DiscoveryPage({ go, notify, restaurants, sharedPosts = [], filters, setFilters, scope, setScope }: CommonProps & {
  restaurants: Restaurant[]; filters: SearchFilters; setFilters: (filters: SearchFilters) => void
  scope: 'all' | 'restaurants' | 'members'; setScope: (scope: 'all' | 'restaurants' | 'members') => void
}) {
  const [activeTab, setActiveTab] = useState('Pour vous')
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set([1]))
  const [savedPosts, setSavedPosts] = useState<Set<number>>(new Set())
  const [followed, setFollowed] = useState<Set<string>>(new Set(['casa']))
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
  const allPosts = [...publishedShares, ...feedPosts]
  const visiblePosts =
    activeTab === 'Pour vous' ? allPosts : activeTab === 'Nouveautés' ? [...allPosts].reverse() : []

  return (
    <main className="page page-with-nav">
      <div className="discovery-titlebar">
        <button className="round-button" type="button" aria-label="Créer" onClick={() => notify('La création arrive après le lancement fidélité')}>
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
        <Clock3 size={15} /> Aperçu · réseau social à venir
      </span>

      <div className="stories-row">
        <button className="story-item" type="button" onClick={() => notify('Votre story arrive bientôt')}>
          <span className="story-circle">
            F
            <i>
              <Plus size={13} strokeWidth={2.5} />
            </i>
          </span>
          <small>Votre story</small>
        </button>
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
          <span>La création de posts et stories arrivera après le lancement fidélité.</span>
          <button type="button" onClick={() => setNoticeVisible(false)}>
            Fermer
          </button>
        </div>
      )}

      {visiblePosts.length ? (
        visiblePosts.map((post) => {
          const restaurant = getRestaurant(post.restaurantId)
          const liked = likedPosts.has(post.id)
          const saved = savedPosts.has(post.id)
          const isFollowing = followed.has(post.restaurantId)
          return (
            <article className="feed-post" key={post.id}>
              <header>
                <span className="avatar" style={{ backgroundImage: `url(${post.image})` }}>
                  {!post.image && post.author.slice(0, 1)}
                </span>
                <button type="button" onClick={() => go('restaurant', { restaurantId: post.restaurantId })}>
                  <strong>
                    {post.author}
                    {post.verified && <BadgeCheck size={16} className="verified" fill="currentColor" stroke="#fbf5ed" />}
                  </strong>
                  <span>{post.handle || restaurant.district}</span>
                </button>
                <button
                  className={`follow-button ${isFollowing ? 'following' : ''}`}
                  type="button"
                  onClick={() => toggleFollow(post.restaurantId)}
                >
                  {isFollowing ? 'Suivi' : 'Suivre'}
                </button>
              </header>
              <button className="post-image" type="button" onClick={() => go('restaurant', { restaurantId: post.restaurantId })}>
                <img src={post.image} alt="" />
              </button>
              <div className="post-actions">
                <button type="button" className={liked ? 'active' : ''} onClick={() => toggleNumber(setLikedPosts, post.id)} aria-label="Aimer">
                  <Heart fill={liked ? 'currentColor' : 'none'} />
                </button>
                <button type="button" aria-label="Commenter" onClick={() => notify('Les commentaires arrivent avec les comptes')}>
                  <MessageCircle />
                </button>
                <button type="button" aria-label="Partager" onClick={() => notify('Le partage sera activé avec les comptes Fidelity')}>
                  <Send />
                </button>
                <button type="button" className={saved ? 'active' : ''} onClick={() => toggleNumber(setSavedPosts, post.id)} aria-label="Enregistrer">
                  <Bookmark fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="post-copy">
                <strong>{post.likes + (liked ? 1 : 0)} coups de cœur</strong>
                <p>
                  <b>{post.author}</b> {post.text}
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
