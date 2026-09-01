import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Compass,
  CreditCard,
  Database,
  Edit3,
  FlaskConical,
  Gift,
  Heart,
  Home,
  Info,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Navigation,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Star,
  Store,
  Utensils,
} from 'lucide-react'
import { feedPosts, getRestaurant, historyItems, restaurants } from './data.js'

const mainPages = new Set(['home', 'discovery', 'loyalty', 'settings'])

function filterRestaurants(items, filters) {
  const query = filters.query.trim().toLocaleLowerCase('fr')
  const location = filters.location.trim().toLocaleLowerCase('fr')

  return items.filter((restaurant) => {
    const searchableText = [
      restaurant.name,
      restaurant.cuisine,
      restaurant.district,
      restaurant.description,
      ...restaurant.menu.map((item) => `${item.name} ${item.description}`),
    ].join(' ').toLocaleLowerCase('fr')
    const restaurantLocation = `${restaurant.district} ${restaurant.address}`.toLocaleLowerCase('fr')
    const distance = Number.parseFloat(restaurant.distance.replace(',', '.'))
    const matchesLocation = !location || location === 'paris et alentours' || restaurantLocation.includes(location)

    return (
      (!query || searchableText.includes(query))
      && matchesLocation
      && filters.diets.every((diet) => restaurant.diets.includes(diet))
      && (Number.isNaN(distance) || distance <= filters.distance)
    )
  })
}

function App() {
  const baseAmina = getRestaurant('amina')
  const [route, setRoute] = useState({ name: 'home' })
  const [routeStack, setRouteStack] = useState([])
  const [favorites, setFavorites] = useState(() => new Set(['amina']))
  const [likedPosts, setLikedPosts] = useState(() => new Set([1]))
  const [savedPosts, setSavedPosts] = useState(() => new Set())
  const [searchFilters, setSearchFilters] = useState({
    query: '',
    location: 'Paris et alentours',
    time: 'Peu importe',
    diets: [],
    distance: 5,
  })
  const [discoveryTab, setDiscoveryTab] = useState('Pour vous')
  const [loyaltyTab, setLoyaltyTab] = useState('Mes cartes')
  const [settingsTab, setSettingsTab] = useState('Utilisateur')
  const [restaurantTab, setRestaurantTab] = useState('Publications')
  const [noticeVisible, setNoticeVisible] = useState(true)
  const [toast, setToast] = useState('')
  const [profileDraft, setProfileDraft] = useState({
    name: baseAmina.name,
    cuisine: baseAmina.cuisine,
    district: baseAmina.district,
    address: baseAmina.address,
    description: baseAmina.description,
    opening: '11:30',
    closing: '23:00',
    diets: [...baseAmina.diets],
  })
  const [menuDraft, setMenuDraft] = useState(baseAmina.menu.map((item) => ({ ...item })))
  const [loyaltyDraft, setLoyaltyDraft] = useState({ ...baseAmina.loyalty })

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(''), 2500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const resolveRestaurant = (id) => {
    const restaurant = getRestaurant(id)
    if (id !== 'amina') return restaurant
    return {
      ...restaurant,
      ...profileDraft,
      menu: menuDraft,
      loyalty: loyaltyDraft,
    }
  }

  const resolvedRestaurants = useMemo(
    () => restaurants.map((restaurant) => resolveRestaurant(restaurant.id)),
    [profileDraft, menuDraft, loyaltyDraft],
  )

  const go = (name, params = {}) => {
    setRouteStack((previous) => [...previous, route])
    setRoute({ name, ...params })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const goMain = (name) => {
    setRouteStack([])
    setRoute({ name })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const goBack = () => {
    setRouteStack((previous) => {
      const next = [...previous]
      setRoute(next.pop() || { name: 'home' })
      return next
    })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const toggleSetValue = (setter, value) => {
    setter((current) => {
      const next = new Set(current)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  const common = {
    go,
    goBack,
    favorites,
    toggleFavorite: (id) => toggleSetValue(setFavorites, id),
    resolveRestaurant,
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
      page = (
        <DiscoveryPage
          {...common}
          activeTab={discoveryTab}
          setActiveTab={setDiscoveryTab}
          likedPosts={likedPosts}
          savedPosts={savedPosts}
          toggleLike={(id) => toggleSetValue(setLikedPosts, id)}
          toggleSaved={(id) => toggleSetValue(setSavedPosts, id)}
          noticeVisible={noticeVisible}
          closeNotice={() => setNoticeVisible(false)}
        />
      )
      break
    case 'story':
      page = <StoryPage {...common} initialIndex={route.index || 0} />
      break
    case 'restaurant':
      page = (
        <RestaurantPage
          {...common}
          restaurant={resolveRestaurant(route.restaurantId)}
          activeTab={restaurantTab}
          setActiveTab={setRestaurantTab}
        />
      )
      break
    case 'card':
      page = <CardDetailPage {...common} restaurant={resolveRestaurant(route.restaurantId)} />
      break
    case 'loyalty':
      page = (
        <LoyaltyPage
          {...common}
          restaurants={resolvedRestaurants}
          activeTab={loyaltyTab}
          setActiveTab={setLoyaltyTab}
        />
      )
      break
    case 'transaction':
      page = <TransactionPage {...common} item={historyItems.find((item) => item.id === route.transactionId) || historyItems[0]} />
      break
    case 'settings':
      page = (
        <SettingsPage
          {...common}
          activeTab={settingsTab}
          setActiveTab={setSettingsTab}
          restaurant={resolveRestaurant('amina')}
        />
      )
      break
    case 'userProfile':
      page = <UserProfilePage {...common} />
      break
    case 'restaurantHub':
      page = <RestaurantHubPage {...common} restaurant={resolveRestaurant('amina')} />
      break
    case 'profileEditor':
      page = (
        <ProfileEditorPage
          {...common}
          draft={profileDraft}
          setDraft={setProfileDraft}
          menu={menuDraft}
          setMenu={setMenuDraft}
          onPublish={() => setToast('Profil publié localement')}
        />
      )
      break
    case 'loyaltyEditor':
      page = (
        <LoyaltyEditorPage
          {...common}
          restaurant={resolveRestaurant('amina')}
          draft={loyaltyDraft}
          setDraft={setLoyaltyDraft}
          onPublish={() => setToast('Programme publié localement')}
        />
      )
      break
    default:
      page = <HomePage {...common} restaurants={resolvedRestaurants} />
  }

  return (
    <div className="stage">
      <div className={`app-shell ${route.name === 'story' ? 'story-shell' : ''} ${mainPages.has(route.name) ? '' : 'has-fixed-back'}`}>
        {!mainPages.has(route.name) && <BackButton onClick={goBack} dark={route.name === 'story'} />}
        {page}
        {mainPages.has(route.name) && <BottomNav active={route.name} onSelect={goMain} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  )
}

function BottomNav({ active, onSelect }) {
  const items = [
    ['home', Home, 'Accueil'],
    ['discovery', Compass, 'Discovery'],
    ['loyalty', CreditCard, 'Fidélité'],
    ['settings', Settings, 'Réglages'],
  ]
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

function BackButton({ onClick, dark = false }) {
  return (
    <button className={`fixed-back-button ${dark ? 'dark' : ''}`} type="button" onClick={onClick} aria-label="Retour">
      <ArrowLeft size={22} strokeWidth={1.6} />
    </button>
  )
}

function HeartButton({ active, onClick, small = false }) {
  return (
    <button className={`heart-button ${active ? 'active' : ''} ${small ? 'small' : ''}`} type="button" onClick={onClick} aria-label="Ajouter aux favoris">
      <Heart size={small ? 20 : 25} fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}

function Tabs({ values, active, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`}>
      {values.map((value) => (
        <button key={value} type="button" className={active === value ? 'active' : ''} onClick={() => onChange(value)}>
          {value}
        </button>
      ))}
    </div>
  )
}

function HomePage({ go, favorites, toggleFavorite, restaurants: allRestaurants }) {
  const [mapRestaurant, setMapRestaurant] = useState('amina')
  const featured = allRestaurants[0]
  return (
    <main className="page page-with-nav home-page">
      <header className="home-header">
        <span className="eyebrow">Fidelity</span>
        <h1>À table, tout simplement</h1>
        <p>Des tables choisies pour leur cuisine, leur quartier et leur programme fidélité.</p>
      </header>

      <button className="search-bar" type="button" onClick={() => go('search')}>
        <Search size={20} />
        <span>Paris et alentours</span>
        <span className="filter-circle"><SlidersHorizontal size={18} /></span>
      </button>
      <p className="microcopy">Aperçu local · données de démonstration</p>

      <section className="section-block">
        <h2>La table de la semaine</h2>
        <RestaurantCard restaurant={featured} favorite={favorites.has(featured.id)} onFavorite={() => toggleFavorite(featured.id)} onOpen={() => go('restaurant', { restaurantId: featured.id })} large />
      </section>

      <section className="section-block">
        <div className="section-heading-row">
          <div>
            <h2>Autour de vous</h2>
            <p>Paris 11e</p>
          </div>
          <button className="text-link" type="button" onClick={() => go('results')}>Explorer la carte <ChevronRight size={17} /></button>
        </div>
        <MapIllustration selected={mapRestaurant} onSelect={setMapRestaurant} onOpen={() => go('restaurant', { restaurantId: mapRestaurant })} />
        <RestaurantCard restaurant={allRestaurants.find((item) => item.id === mapRestaurant) || featured} favorite={favorites.has(mapRestaurant)} onFavorite={() => toggleFavorite(mapRestaurant)} onOpen={() => go('restaurant', { restaurantId: mapRestaurant })} compact />
      </section>

      <section className="section-block">
        <h2>Pour changer d’air</h2>
        <div className="restaurant-stack">
          {allRestaurants.slice(1, 4).map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} favorite={favorites.has(restaurant.id)} onFavorite={() => toggleFavorite(restaurant.id)} onOpen={() => go('restaurant', { restaurantId: restaurant.id })} />
          ))}
        </div>
      </section>
    </main>
  )
}

function RestaurantCard({ restaurant, favorite, onFavorite, onOpen, large = false, compact = false }) {
  return (
    <article className={`restaurant-card ${large ? 'large' : ''} ${compact ? 'compact' : ''}`}>
      <button className="restaurant-image-button" type="button" onClick={onOpen}>
        <img src={restaurant.image} alt="" />
      </button>
      <HeartButton active={favorite} onClick={onFavorite} small />
      <button className="restaurant-copy" type="button" onClick={onOpen}>
        <span className="restaurant-title-row">
          <strong>{restaurant.name}</strong>
          <span><Star size={14} fill="currentColor" /> {restaurant.rating}</span>
        </span>
        <span className="muted">{restaurant.cuisine} · {restaurant.distance}</span>
        {!compact && <span className="loyalty-teaser">Fidélité · {restaurant.loyalty.type === 'stamps' ? `${restaurant.loyalty.target} coches` : `${restaurant.loyalty.target} points`} = {restaurant.loyalty.reward.toLowerCase()}</span>}
        {!compact && <span className="open-now">Ouvert maintenant</span>}
      </button>
    </article>
  )
}

function MapIllustration({ selected, onSelect, onOpen }) {
  const pins = [
    ['amina', '19%', '25%'],
    ['casa', '47%', '16%'],
    ['miso', '70%', '34%'],
    ['comptoir', '34%', '62%'],
    ['rizrouge', '76%', '72%'],
    ['braise', '14%', '76%'],
  ]
  return (
    <div className="map-card">
      <span className="map-label">CARTE LOCALE ILLUSTRÉE · SIMULATION</span>
      <div className="map-street street-one" />
      <div className="map-street street-two" />
      {pins.map(([id, left, top], index) => (
        <button key={`${id}-${index}`} className={`map-pin ${selected === id ? 'active' : ''}`} style={{ left, top }} type="button" onClick={() => onSelect(id)} aria-label={`Sélectionner ${id}`}>
          <MapPin size={18} fill="currentColor" />
        </button>
      ))}
      <button className="map-open" type="button" onClick={onOpen}>Voir cette adresse <ChevronRight size={16} /></button>
    </div>
  )
}

function SearchPage({ go, filters, setFilters, restaurants: allRestaurants }) {
  const resultCount = filterRestaurants(allRestaurants, filters).length
  const toggleDiet = (diet) => {
    setFilters((current) => ({
      ...current,
      diets: current.diets.includes(diet) ? current.diets.filter((item) => item !== diet) : [...current.diets, diet],
    }))
  }
  return (
    <main className="page filters-page">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">Filtres locaux</span>
          <h1>Trouver votre table</h1>
        </div>
      </div>
      <p className="lead">Vos critères restent dans cette session. Aucun historique de recherche n’est envoyé.</p>

      <section className="form-section">
        <h2>Recherche</h2>
        <label>Restaurant, cuisine ou plat
          <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Ex. ramen ou Casa Verde" />
        </label>
        <label>Quartier ou ville
          <input value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} placeholder="Ex. Paris 11e" />
        </label>
      </section>

      <section className="form-section">
        <h2>Horaire</h2>
        <strong>{filters.time}</strong>
        <p className="muted">Choisissez parmi 13 créneaux de déjeuner et de dîner.</p>
        <button className="outline-button" type="button" onClick={() => go('time')}>Changer l’horaire</button>
      </section>

      <section className="form-section">
        <h2>Préférences alimentaires</h2>
        <div className="chips">
          {['Halal', 'Végétarien', 'Végan'].map((diet) => (
            <button key={diet} type="button" className={filters.diets.includes(diet) ? 'selected' : ''} onClick={() => toggleDiet(diet)}>
              {filters.diets.includes(diet) && <Check size={15} />} {diet}
            </button>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>Distance maximale</h2>
        <div className="distance-options">
          {[2, 5, 10].map((distance) => (
            <button key={distance} type="button" className={filters.distance === distance ? 'active' : ''} onClick={() => setFilters({ ...filters, distance })}>{distance} km</button>
          ))}
        </div>
        <p className="muted">Distance simulée depuis Paris. Aucune localisation n’est demandée.</p>
      </section>

      <section className="form-section results-preview">
        <h2>Aperçu des résultats</h2>
        <p>{resultCount} restaurant{resultCount > 1 ? 's' : ''} corresponde{resultCount > 1 ? 'nt' : ''} à ces critères.</p>
        <div className="button-row">
          <button className="outline-button" type="button" onClick={() => setFilters({ query: '', location: 'Paris et alentours', time: 'Peu importe', diets: [], distance: 5 })}>Réinitialiser</button>
          <button className="primary-button" type="button" onClick={() => go('results')}>Afficher {resultCount} restaurant{resultCount > 1 ? 's' : ''}</button>
        </div>
      </section>
    </main>
  )
}

function TimePage({ goBack, filters, setFilters }) {
  const times = ['Peu importe', 'Maintenant', '12 h', '12 h 30', '13 h', '13 h 30', '18 h 30', '19 h', '19 h 30', '20 h', '20 h 30', '21 h', '21 h 30']
  return (
    <main className="page time-page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Étape horaire</span>
          <h1>À quelle heure ?</h1>
        </div>
      </div>
      <p className="lead">Choisissez le moment précis auquel vous voulez arriver au restaurant.</p>
      <div className="time-grid">
        {times.map((time) => (
          <button key={time} type="button" className={filters.time === time ? 'selected' : ''} onClick={() => setFilters({ ...filters, time })}>
            <strong>{time}</strong>
            <span>{time.includes('12') || time.includes('13') ? 'Déjeuner' : time === 'Peu importe' ? 'Voir tous les horaires' : time === 'Maintenant' ? 'Ouvert au moment de la recherche' : 'Dîner'}</span>
            {filters.time === time && <Check size={17} />}
          </button>
        ))}
      </div>
      <button className="primary-button full" type="button" onClick={goBack}>Choisir {filters.time.toLowerCase()}</button>
    </main>
  )
}

function ResultsPage({ goBack, go, filters, restaurants: allRestaurants, favorites, toggleFavorite }) {
  const matchingRestaurants = filterRestaurants(allRestaurants, filters)
  return (
    <main className="page results-page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Résultats de recherche</span>
          <h1>{matchingRestaurants.length} restaurant{matchingRestaurants.length > 1 ? 's' : ''} autour de vous</h1>
          <p>{filters.location || 'Paris et alentours'}</p>
        </div>
        <button className="outline-button" type="button" onClick={goBack}>Modifier</button>
      </div>
      <h2>Autour de vous</h2>
      <p className="muted">Le point bleu indique votre position simulée. Touchez une épingle pour identifier une adresse.</p>
      <MapIllustration selected="miso" onSelect={(id) => go('restaurant', { restaurantId: id })} onOpen={() => go('restaurant', { restaurantId: 'miso' })} />
      <h2>Restaurants correspondants</h2>
      <div className="restaurant-stack">
        {matchingRestaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} favorite={favorites.has(restaurant.id)} onFavorite={() => toggleFavorite(restaurant.id)} onOpen={() => go('restaurant', { restaurantId: restaurant.id })} compact />
        ))}
      </div>
      {!matchingRestaurants.length && <div className="empty-state compact-empty"><span><Search /></span><h2>Aucun restaurant</h2><p>Modifiez vos critères pour afficher d’autres adresses.</p></div>}
    </main>
  )
}

function DiscoveryPage({ go, activeTab, setActiveTab, likedPosts, savedPosts, toggleLike, toggleSaved, noticeVisible, closeNotice }) {
  const visiblePosts = activeTab === 'Pour vous' ? feedPosts : activeTab === 'Nouveautés' ? feedPosts.slice().reverse() : []
  return (
    <main className="page page-with-nav discovery-page">
      <div className="discovery-titlebar">
        <button className="round-button" type="button" aria-label="Créer"><Plus size={25} /></button>
        <h1>Découvrir</h1>
        <button className={`round-button ${activeTab === 'Proximité' ? 'active' : ''}`} type="button" onClick={() => setActiveTab(activeTab === 'Proximité' ? 'Pour vous' : 'Proximité')} aria-label="Favoris"><Heart size={25} fill={activeTab === 'Proximité' ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="segmented">
        {['Pour vous', 'Nouveautés', 'Proximité'].map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>
      <div className="preview-label"><Clock3 size={17} /> Aperçu · réseau social à venir</div>
      <div className="stories-row">
        <button className="story-item" type="button"><span className="story-circle initials">F<i><Plus size={16} /></i></span><small>Votre story</small></button>
        {[
          ['Casa Verde', '/images/tacos.webp', 0, 4],
          ['Camille R.', '', 2, 2],
          ['Atelier Miso', '/images/ramen.webp', 1, 2],
        ].map(([name, image, index, count]) => (
          <button className="story-item" type="button" key={name} onClick={() => go('story', { index })}>
            <span className={`story-circle ${image ? '' : 'initials'}`} style={image ? { backgroundImage: `url(${image})` } : undefined}>{!image && 'CR'}<i>{count}</i></span>
            <small>{name}</small>
          </button>
        ))}
      </div>
      {noticeVisible && <div className="inline-notice"><span>La création de posts et stories arrivera après le lancement fidélité.</span><button type="button" onClick={closeNotice}>Fermer</button></div>}
      {visiblePosts.length ? visiblePosts.map((post) => (
        <FeedPost key={post.id} post={post} liked={likedPosts.has(post.id)} saved={savedPosts.has(post.id)} onLike={() => toggleLike(post.id)} onSave={() => toggleSaved(post.id)} onRestaurant={() => go('restaurant', { restaurantId: post.restaurantId })} />
      )) : <EmptyDiscovery onReset={() => setActiveTab('Pour vous')} />}
    </main>
  )
}

function FeedPost({ post, liked, saved, onLike, onSave, onRestaurant }) {
  return (
    <article className="feed-post">
      <header>
        <span className="avatar" style={{ backgroundImage: `url(${post.image})` }}>{post.author.slice(0, 1)}</span>
        <button type="button" onClick={onRestaurant}><strong>{post.author}</strong><span>{post.handle || post.district}</span></button>
        <button className="follow-button" type="button">Suivre</button>
        <MoreHorizontal size={21} />
      </header>
      <button className="post-image" type="button" onClick={onRestaurant}><img src={post.image} alt="" /></button>
      <div className="post-actions">
        <button type="button" className={liked ? 'active' : ''} onClick={onLike}><Heart fill={liked ? 'currentColor' : 'none'} /></button>
        <button type="button"><MessageCircle /></button>
        <button type="button"><Send /></button>
        <button type="button" className={saved ? 'active' : ''} onClick={onSave}><Bookmark fill={saved ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="post-copy">
        <strong>{post.likes + (liked ? 1 : 0)} coups de cœur</strong>
        <p><b>{post.author}</b> {post.text}</p>
        <button type="button" onClick={onRestaurant}>Voir la fiche de {getRestaurant(post.restaurantId).name}</button>
        <small>{post.time}</small>
      </div>
    </article>
  )
}

function EmptyDiscovery({ onReset }) {
  return (
    <div className="empty-state">
      <span><Heart size={28} /></span>
      <h2>Rien ici pour l’instant</h2>
      <p>Aucune publication ne correspond à cette sélection pour le moment.</p>
      <button className="outline-button" type="button" onClick={onReset}>Voir tout le flux</button>
    </div>
  )
}

function StoryPage({ initialIndex }) {
  const stories = [
    { author: 'Casa Verde', meta: 'Il y a 12 min · 1 sur 4', image: '/images/tacos.webp', caption: 'La salle est prête. Ce soir, la salsa verde accompagne toutes les tortillas.' },
    { author: 'Atelier Miso', meta: 'Il y a 5 min · 4 sur 4', image: '/images/ramen.webp', caption: 'Dernier aperçu : notre assiette de saison, entièrement végétale.' },
    { author: 'Camille R.', meta: 'Il y a 48 min · 1 sur 2', image: '/images/table.webp', caption: 'Une table généreuse et une nouvelle coche sur ma carte Chez Amina.' },
  ]
  const [index, setIndex] = useState(initialIndex % stories.length)
  const story = stories[index]
  return (
    <main className="story-page">
      <div className="story-progress">{stories.map((_, progressIndex) => <span key={progressIndex} className={progressIndex <= index ? 'active' : ''} />)}</div>
      <header>
        <span className="avatar initials">{story.author.split(' ').map((word) => word[0]).join('').slice(0, 2)}</span>
        <div><strong>{story.author}</strong><small>{story.meta}</small></div>
      </header>
      <img className="story-image" src={story.image} alt="" />
      <div className="story-caption"><p>{story.caption}</p><Heart size={25} /></div>
      <button className="story-arrow left" type="button" onClick={() => setIndex((index - 1 + stories.length) % stories.length)}><ChevronLeft /></button>
      <button className="story-arrow right" type="button" onClick={() => setIndex((index + 1) % stories.length)}><ChevronRight /></button>
    </main>
  )
}

function RestaurantPage({ go, restaurant, favorites, toggleFavorite, activeTab, setActiveTab }) {
  return (
    <main className="page restaurant-page">
      <div className="restaurant-topline">
        <div><span className="eyebrow">{restaurant.cuisine}</span><h1>{restaurant.name}</h1><p>{restaurant.district} · {restaurant.distance} · Note {restaurant.rating}/5</p></div>
      </div>
      <div className="restaurant-hero">
        <img src={restaurant.image} alt="" />
        <HeartButton active={favorites.has(restaurant.id)} onClick={() => toggleFavorite(restaurant.id)} />
      </div>
      <section className="restaurant-loyalty-section">
        <h2>Votre carte Fidelity</h2>
        <p>Ajout local à Mes cartes, sans compte ni pass Wallet réel.</p>
        <LoyaltyCard restaurant={restaurant} compact />
        <button className="outline-button full" type="button" onClick={() => go('card', { restaurantId: restaurant.id })}><CreditCard size={18} /> Voir ma carte</button>
      </section>
      <button className="address-card" type="button">
        <span><MapPin /></span><span><strong>{restaurant.address}</strong><small>Appuyer pour choisir votre application d’itinéraire</small></span><Navigation fill="currentColor" />
      </button>
      <Tabs values={['Publications', 'Menu', 'Informations']} active={activeTab} onChange={setActiveTab} className="restaurant-tabs" />
      {activeTab === 'Publications' && (
        <section className="restaurant-tab-content">
          <h2>Publications</h2><p className="muted">Les dernières images publiées par le restaurant.</p>
          <div className="restaurant-gallery"><img src={restaurant.image} alt="" /><img src={restaurant.id === 'amina' ? '/images/tacos.webp' : '/images/table.webp'} alt="" /></div>
        </section>
      )}
      {activeTab === 'Menu' && <MenuList restaurant={restaurant} />}
      {activeTab === 'Informations' && <RestaurantInfo restaurant={restaurant} />}
    </main>
  )
}

function MenuList({ restaurant }) {
  return (
    <section className="restaurant-tab-content menu-section">
      <h2>Menu</h2>
      {restaurant.menu.map((item) => (
        <article key={item.name}><div><strong>{item.name}</strong><p>{item.description}</p></div><b>{item.price}</b></article>
      ))}
    </section>
  )
}

function RestaurantInfo({ restaurant }) {
  return (
    <section className="restaurant-tab-content info-section">
      <h2>À propos</h2>
      <p>{restaurant.description}</p>
      <div className="hours"><Clock3 /> <span>{restaurant.hours.map((line) => <span key={line}>{line}</span>)}</span></div>
      <div className="diet-tags">{restaurant.diets.map((diet) => <span key={diet}>{diet}</span>)}</div>
      <h2>Avis</h2>
      <p className="muted">Avis fictifs de la démonstration.</p>
      <div className="rating-line"><Star fill="currentColor" /> <strong>{restaurant.rating} sur 5</strong></div>
      <article className="review"><div><strong>Sarah L.</strong><b>5/5</b></div><p>Une cuisine généreuse et un accueil qui donne envie de revenir.</p></article>
    </section>
  )
}

function LoyaltyCard({ restaurant, compact = false, preview = false }) {
  const loyalty = restaurant.loyalty
  const progress = Math.min(100, Math.round((loyalty.current / loyalty.target) * 100))
  const stampTarget = Math.min(10, Math.max(1, Number(loyalty.target) || 1))
  const stampCurrent = Math.min(stampTarget, Math.max(0, Number(loyalty.current) || 0))
  return (
    <article className={`loyalty-card style-${loyalty.style || 'braise'} ${compact ? 'compact' : ''} ${preview ? 'preview' : ''}`}>
      <header><span className="loyalty-logo">F</span><div><strong>{restaurant.name}</strong><small>CARTE FIDELITY</small></div><Gift /></header>
      {loyalty.type === 'stamps' ? (
        <div className="stamp-grid">{Array.from({ length: stampTarget }).map((_, index) => <span key={index} className={index < stampCurrent ? 'filled' : ''}>{index < stampCurrent && <Check size={14} strokeWidth={1.6} />}</span>)}</div>
      ) : (
        <><div className="progress-bar"><i style={{ width: `${progress}%` }} /></div><strong className="points-label">{loyalty.current} / {loyalty.target} points</strong></>
      )}
      <div className="loyalty-divider" />
      <small>Comment gagner</small>
      <p>{loyalty.rule}</p>
      <small>VOTRE PROCHAINE RÉCOMPENSE</small>
      <strong className="reward-label">{loyalty.reward}</strong>
      <span className="effort">Encore un petit effort</span>
    </article>
  )
}

function CardDetailPage({ restaurant }) {
  const loyalty = restaurant.loyalty
  const remaining = Math.max(0, loyalty.target - loyalty.current)
  return (
    <main className="page card-detail-page">
      <div className="detail-header"><div><span className="eyebrow">Ma carte</span><h1>{restaurant.name}</h1><p>{loyalty.title}</p></div></div>
      <LoyaltyCard restaurant={restaurant} />
      <section className="reward-panel">
        <span><Gift /></span><div><h2>{loyalty.reward}</h2><p>{loyalty.rule}</p></div>
        <strong>{remaining} {loyalty.type === 'stamps' ? `coche${remaining > 1 ? 's' : ''}` : 'points'} avant la récompense</strong>
      </section>
      <section className="progress-panel"><span><Info /></span><div><p>Progression</p><strong>{loyalty.current} sur {loyalty.target} {loyalty.type === 'stamps' ? 'coches' : 'points'}</strong></div></section>
    </main>
  )
}

function LoyaltyPage({ go, restaurants: allRestaurants, activeTab, setActiveTab }) {
  return (
    <main className="page page-with-nav loyalty-page">
      <h1>Fidélité</h1>
      <p className="lead">Vos cartes de fidélité et tous vos mouvements, réunis.</p>
      <Tabs values={['Mes cartes', 'Historique']} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'Mes cartes' ? (
        <div className="loyalty-list">
          {[allRestaurants[0], allRestaurants[2]].map((restaurant) => <div key={restaurant.id}><LoyaltyCard restaurant={restaurant} compact /><button className="outline-button full" type="button" onClick={() => go('card', { restaurantId: restaurant.id })}><Gift size={18} /> Voir la carte {restaurant.name}</button></div>)}
        </div>
      ) : (
        <div className="history-list">
          {historyItems.map((item) => {
            const restaurant = getRestaurant(item.restaurantId)
            return <button type="button" key={item.id} onClick={() => go('transaction', { transactionId: item.id })}><span className={item.amount.startsWith('-') ? 'negative' : 'positive'}>{item.amount.startsWith('-') ? '−' : '+'}</span><span><strong>{restaurant.name} · {item.title}</strong><small>{item.date}</small></span><b>{item.amount}</b></button>
          })}
        </div>
      )}
    </main>
  )
}

function TransactionPage({ go, item }) {
  const restaurant = getRestaurant(item.restaurantId)
  return (
    <main className="page transaction-page">
      <div className="detail-header"><div><span className="eyebrow">Historique</span><h1>{item.title}</h1><p>Mouvement local associé à une commande de démonstration.</p></div></div>
      <div className="mode-notice"><strong>Registre de fidélité</strong><p>Ce mouvement appartient uniquement à la session locale de démonstration.</p></div>
      <dl className="transaction-details">
        <div><dt>Restaurant</dt><dd>{restaurant.name}</dd></div>
        <div><dt>Date</dt><dd>{item.date}</dd></div>
        <div><dt>Mouvement</dt><dd>{item.amount}</dd></div>
        <div><dt>Origine</dt><dd>Commande locale</dd></div>
        <div><dt>Solde après opération</dt><dd>{item.balance}</dd></div>
      </dl>
      <button className="primary-button full" type="button" onClick={() => go('card', { restaurantId: item.restaurantId })}>Voir la carte de fidélité</button>
    </main>
  )
}

function SettingsPage({ go, activeTab, setActiveTab, restaurant }) {
  return (
    <main className="page page-with-nav settings-page">
      <h1>Réglages</h1>
      <p className="lead">Passez de votre profil membre à l’espace de gestion restaurant.</p>
      <Tabs values={['Utilisateur', 'Restaurant']} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'Utilisateur' ? <UserProfileSummary onOpen={() => go('userProfile')} /> : <RestaurantAccountSummary restaurant={restaurant} go={go} />}
    </main>
  )
}

function UserProfileSummary({ onOpen }) {
  return (
    <section className="profile-summary">
      <h2>Profil utilisateur</h2>
      <p className="muted">Ce que les autres membres voient lorsqu’ils ouvrent votre profil.</p>
      <button className="profile-identity" type="button" onClick={onOpen}><span className="profile-avatar">CR</span><span><strong>Camille Robert</strong><small>@camilleatable</small><em>Camille · Robert</em></span></button>
      <p>Toujours partante pour une grande tablée, un bouillon réconfortant et les adresses qui prennent soin des végétariens.</p>
      <div className="profile-stats"><span><strong>3</strong> publications</span><span><strong>3</strong> restaurants</span><span><strong>15</strong> visites</span></div>
      <Tabs values={['Publications', 'À propos']} active="Publications" onChange={() => {}} />
      <div className="profile-grid"><img src="/images/table.webp" alt="" /><img src="/images/ramen.webp" alt="" /><img src="/images/tacos.webp" alt="" /></div>
    </section>
  )
}

function RestaurantAccountSummary({ restaurant, go }) {
  return (
    <section className="restaurant-account">
      <h2>Compte restaurant</h2>
      <p className="muted">Modifiez le contenu visible par les clients et les offres de fidélité.</p>
      <article><img src={restaurant.image} alt="" /><div><h2>{restaurant.name}</h2><p>{restaurant.cuisine} · {restaurant.district}</p><p>{restaurant.description}</p></div></article>
      <button className="primary-button full" type="button" onClick={() => go('profileEditor')}><Edit3 size={18} /> Modifier le profil et le menu</button>
      <button className="outline-button full" type="button" onClick={() => go('loyaltyEditor')}><Gift size={18} /> Fidélité et promotions</button>
      <button className="outline-button full" type="button" onClick={() => go('restaurant', { restaurantId: 'amina' })}><Store size={18} /> Voir le profil public</button>
      <div className="mode-notice"><strong>Tout au même endroit</strong><p>Le profil public réunit les publications, le menu, l’adresse et les horaires. Les outils ci-dessus permettent au restaurateur de les modifier depuis son application.</p></div>
      <h2>Démonstration</h2>
      <button className="demo-card" type="button" onClick={() => go('restaurantHub')}><span><Store /></span><span><strong>Espace restaurateur — mode démonstration</strong><small>Simulation locale du profil, du programme et des scans, sans serveur.</small></span><ChevronRight /></button>
    </section>
  )
}

function UserProfilePage() {
  return (
    <main className="page user-profile-page">
      <div className="detail-header"><div><span className="eyebrow">Profil utilisateur</span><h1>Camille Robert</h1></div></div>
      <UserProfileSummary onOpen={() => {}} />
      <h2>Restaurants enregistrés</h2>
      <div className="saved-restaurants">{['Chez Amina', 'Le Comptoir Solaire', 'Atelier Miso'].map((name) => <div key={name}><strong>{name}</strong><button type="button">Retirer</button></div>)}</div>
    </main>
  )
}

function RestaurantHubPage({ go, restaurant }) {
  return (
    <main className="page restaurant-hub-page">
      <div className="detail-header"><div><span className="eyebrow">Espace restaurateur</span><h1>Gestion locale</h1><p>Le profil, le programme et les scans de démonstration.</p></div></div>
      <article className="restaurant-hub-card"><img src={restaurant.image} alt="" /><div><h2>{restaurant.name}</h2><p>{restaurant.cuisine} · {restaurant.district}</p></div></article>
      <button className="primary-button full" type="button" onClick={() => go('profileEditor')}><Edit3 size={18} /> Profil & menu</button>
      <button className="outline-button full" type="button" onClick={() => go('loyaltyEditor')}><Gift size={18} /> Programme fidélité</button>
      <button className="outline-button full" type="button" onClick={() => go('restaurant', { restaurantId: 'amina' })}><Store size={18} /> Voir le profil public</button>
      <div className="mode-notice"><strong>Mode démonstration</strong><p>Données locales — aucune publication, caméra ou analyse réelle.</p></div>
    </main>
  )
}

function ProfileEditorPage({ draft, setDraft, menu, setMenu, onPublish }) {
  const [selectedItem, setSelectedItem] = useState(0)
  const updateMenu = (field, value) => setMenu((items) => items.map((item, index) => index === selectedItem ? { ...item, [field]: value } : item))
  const toggleDiet = (diet) => setDraft((current) => ({ ...current, diets: current.diets.includes(diet) ? current.diets.filter((item) => item !== diet) : [...current.diets, diet] }))
  return (
    <main className="page editor-page">
      <div className="detail-header"><div><span className="eyebrow">Espace restaurateur</span><h1>Profil & menu</h1><p>Publiez les champs du compte local et préparez les contenus visuels sans téléchargement.</p></div></div>
      <div className="mode-notice"><strong>Mode démonstration</strong><p>Données de démonstration locales — aucune publication, caméra ou analyse réelle.</p></div>
      <section className="form-section">
        <h2>Compte restaurant</h2>
        <label>Nom du restaurant<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Cuisine<input value={draft.cuisine} onChange={(event) => setDraft({ ...draft, cuisine: event.target.value })} /></label>
        <label>Adresse<input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label>
        <label>Quartier<input value={draft.district} onChange={(event) => setDraft({ ...draft, district: event.target.value })} /></label>
        <label>Description<textarea rows="4" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <h3>Horaires du premier service</h3>
        <label>Ouverture (HH:MM)<input type="time" value={draft.opening} onChange={(event) => setDraft({ ...draft, opening: event.target.value })} /></label>
        <label>Fermeture (HH:MM)<input type="time" value={draft.closing} onChange={(event) => setDraft({ ...draft, closing: event.target.value })} /></label>
        <label>Régimes proposés</label>
        <div className="chips">{['Halal', 'Végétarien', 'Végan', 'Sans gluten'].map((diet) => <button key={diet} type="button" className={draft.diets.includes(diet) ? 'selected' : ''} onClick={() => toggleDiet(diet)}>{draft.diets.includes(diet) && <Check size={15} />} {diet}</button>)}</div>
      </section>
      <section className="gallery-draft"><h3>Galerie — aperçu du brouillon</h3><p>Choisissez la couverture locale à prévisualiser. Aucun fichier n’est téléversé ni publié.</p><div><button className="selected" type="button">Photo 1</button><button type="button">Photo 2</button></div><img src="/images/table.webp" alt="" /></section>
      <button className="primary-button full" type="button" onClick={onPublish}>Publier le profil localement</button>
      <section className="menu-editor">
        <h2>Éditeur de menu</h2>
        <p className="muted">Prévisualisez chaque modification, puis publiez-la localement sans serveur ni envoi externe.</p>
        <div className="editable-menu-list">{menu.map((item, index) => <button key={item.name} type="button" className={selectedItem === index ? 'active' : ''} onClick={() => setSelectedItem(index)}><span><strong>{item.name}</strong><small>{item.price}</small></span><Edit3 size={18} /></button>)}</div>
        <div className="selected-dish">
          <h3>Plat sélectionné</h3>
          <label>Nom du plat<input value={menu[selectedItem].name} onChange={(event) => updateMenu('name', event.target.value)} /></label>
          <label>Description du plat<textarea rows="3" value={menu[selectedItem].description} onChange={(event) => updateMenu('description', event.target.value)} /></label>
          <label>Prix en euros<input value={menu[selectedItem].price.replace(' €', '').replace(',', '.')} onChange={(event) => updateMenu('price', `${event.target.value.replace('.', ',')} €`)} /></label>
          <button className="outline-button full" type="button">Enregistrer dans l’aperçu local</button>
        </div>
      </section>
    </main>
  )
}

function LoyaltyEditorPage({ restaurant, draft, setDraft, onPublish }) {
  const setType = (type) => setDraft((current) => ({ ...current, type, current: type === 'stamps' ? 9 : 740, target: type === 'stamps' ? 10 : 800, rule: type === 'stamps' ? 'Une coche par visite, hors boissons.' : 'Dix points par euro dépensé.' }))
  const updateTarget = (value) => {
    const parsedValue = Number(value)
    const maximum = draft.type === 'stamps' ? 10 : Number.POSITIVE_INFINITY
    const target = Math.min(maximum, Math.max(1, Number.isFinite(parsedValue) ? parsedValue : 1))
    setDraft((current) => ({ ...current, target, current: Math.min(current.current, target) }))
  }
  const previewRestaurant = { ...restaurant, loyalty: draft }
  return (
    <main className="page editor-page loyalty-editor-page">
      <div className="detail-header"><div><span className="eyebrow">Espace restaurateur</span><h1>Programme fidélité</h1><p>Composez, validez et publiez un programme local avec aperçu client en direct.</p></div></div>
      <div className="mode-notice"><strong>Mode démonstration</strong><p>Données de démonstration locales — aucune publication, caméra ou analyse réelle.</p></div>
      <h2>Constructeur progressif</h2>
      <p className="lead">La publication met immédiatement à jour le restaurant et sa carte client dans la session.</p>
      <Tabs values={['À coches', 'À points']} active={draft.type === 'stamps' ? 'À coches' : 'À points'} onChange={(value) => setType(value === 'À coches' ? 'stamps' : 'points')} />
      <section className="form-section">
        <label>Titre du programme<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>{draft.type === 'stamps' ? 'Nombre de coches (10 maximum)' : 'Objectif de points'}<input type="number" min="1" max={draft.type === 'stamps' ? 10 : undefined} value={draft.target} onChange={(event) => updateTarget(event.target.value)} /></label>
        <label>Récompense<input value={draft.reward} onChange={(event) => setDraft({ ...draft, reward: event.target.value })} /></label>
        <label>Conditions de gain<textarea rows="3" value={draft.rule} onChange={(event) => setDraft({ ...draft, rule: event.target.value })} /></label>
        <label>Style de carte</label>
        <div className="chips">{[['braise', 'Braise'], ['creme', 'Crème'], ['encre', 'Encre']].map(([value, label]) => <button key={value} type="button" className={draft.style === value ? 'selected' : ''} onClick={() => setDraft({ ...draft, style: value })}>{draft.style === value && <Check size={15} />} {label}</button>)}</div>
      </section>
      <LoyaltyCard restaurant={previewRestaurant} preview />
      <button className="primary-button full" type="button" onClick={onPublish}>Publier le programme localement</button>
      <button className="outline-button full" type="button"><CreditCard size={18} /> Voir le QR et l’affiche en aperçu</button>
    </main>
  )
}

export default App
