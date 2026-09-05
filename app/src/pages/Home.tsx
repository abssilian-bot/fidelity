import { useState } from 'react'
import { ChevronRight, Search, Star } from 'lucide-react'
import type { Restaurant } from '../data'
import type { CommonProps, SearchFilters } from '../nav'
import { HeartButton, MapIllustration, loyaltyTeaser } from '../components/kit'
import { QuickFilters, SearchBox, SearchSort, SearchSummary } from '../components/SearchControls'
import { activeFilterCount, defaultSearchFilters, isOpenAt, openingHoursOf, parisClock } from '../lib/search'
import { useRestaurantSearch } from '../hooks/use-search'

export function RestaurantCard({ restaurant, favorite, onFavorite, onOpen, large = false, compact = false }: {
  restaurant: Restaurant
  favorite: boolean
  onFavorite: () => void
  onOpen: () => void
  large?: boolean
  compact?: boolean
}) {
  const clock = parisClock()
  const open = isOpenAt(restaurant, clock.day, clock.minutes)
  const hoursKnown = openingHoursOf(restaurant).some((day) => day.day === clock.day)
  return (
    <article className={`restaurant-card ${large ? 'large' : ''} ${compact ? 'compact' : ''}`}>
      <button className="restaurant-image-button" type="button" onClick={onOpen}>
        <img src={restaurant.image} alt="" />
      </button>
      <HeartButton active={favorite} onClick={onFavorite} small />
      <button className="restaurant-copy" type="button" onClick={onOpen}>
        <span className="restaurant-title-row">
          <strong>{restaurant.name}</strong>
          <span>
            <Star size={14} fill="currentColor" /> {restaurant.rating}
          </span>
        </span>
        <span className="muted" style={{ fontSize: 13.5 }}>
          {restaurant.cuisine} · {restaurant.distance}
        </span>
        {!compact && <span className="loyalty-teaser">{loyaltyTeaser(restaurant)}</span>}
        {restaurant.avgPrice > 0 && <span className="muted" style={{ fontSize: 12 }}>{restaurant.avgPrice.toLocaleString('fr-FR')} € en moyenne / pers.</span>}
        <span className={open ? 'open-now' : 'closed-now'}>
          {open ? 'Ouvert maintenant' : hoursKnown ? 'Fermé pour le moment' : 'Horaires non renseignés'}
        </span>
      </button>
    </article>
  )
}

export default function HomePage({ go, favorites, toggleFavorite, restaurants, backendConnected = false, filters, setFilters }: CommonProps & {
  restaurants: Restaurant[]; backendConnected?: boolean; filters: SearchFilters; setFilters: (filters: SearchFilters) => void
}) {
  const [mapRestaurant, setMapRestaurant] = useState('amina')
  const [whyVisible, setWhyVisible] = useState(false)
  const featured = restaurants[0]
  const selected = restaurants.find((item) => item.id === mapRestaurant) || featured
  const matching = useRestaurantSearch(restaurants, filters)
  const searching = !!filters.query.trim() || activeFilterCount(filters) > 0

  return (
    <main className="page page-with-nav">
      <header style={{ marginBottom: 22 }}>
        <span className="eyebrow">Fidelity</span>
        <h1 style={{ margin: '6px 0 8px' }}>À table, tout simplement</h1>
        <p className="lead" style={{ margin: 0 }}>
          Des tables choisies pour leur cuisine, leur quartier et leur programme fidélité.
        </p>
      </header>

      <SearchBox label="Rechercher une table" placeholder="Une cuisine, un plat, une table…" value={filters.query}
        onChange={(query) => setFilters({ ...filters, query })} onSubmit={() => go('results')}
        onFilters={() => go('search')} filterCount={activeFilterCount(filters)} />
      <QuickFilters filters={filters} onChange={setFilters} />
      <p className="microcopy">
        {backendConnected ? 'Connecté au serveur · données en temps réel' : 'Aperçu local · serveur hors ligne, données de démonstration'}
      </p>

      {searching ? <section className="home-search-results" aria-label="Résultats de recherche">
        <SearchSummary count={matching.length} filters={filters} onReset={() => setFilters(defaultSearchFilters())} />
        <SearchSort filters={filters} onChange={setFilters} />
        <div className="restaurant-stack">{matching.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant}
          favorite={favorites.has(restaurant.id)} onFavorite={() => toggleFavorite(restaurant.id)}
          onOpen={() => go('restaurant', { restaurantId: restaurant.id })} compact />)}</div>
        {!matching.length && <div className="empty-state"><span><Search size={26} /></span><h2>Aucune table pour ces critères</h2>
          <p>Essayez une autre envie ou retirez un filtre.</p>
          <button className="outline-button full" type="button" onClick={() => go('search')}>Ajuster les filtres</button>
        </div>}
      </section> : <>
      {featured && <section style={{ marginTop: 28 }}>
        <h2 style={{ margin: '0 0 12px' }}>La table de la semaine</h2>
        <RestaurantCard
          restaurant={featured}
          favorite={favorites.has(featured.id)}
          onFavorite={() => toggleFavorite(featured.id)}
          onOpen={() => go('restaurant', { restaurantId: featured.id })}
          large
        />
        <button className="text-link" type="button" style={{ marginTop: 10 }} onClick={() => setWhyVisible(!whyVisible)}>
          Pourquoi cette table ?
        </button>
        {whyVisible && (
          <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0', lineHeight: 1.5 }}>
            {featured.description} Son programme « {featured.loyalty.title} » récompense chaque visite, et la communauté
            lui donne {featured.rating}/5.
          </p>
        )}
      </section>}

      {selected && <section style={{ marginTop: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Près de vous</h2>
            <p className="muted" style={{ margin: '3px 0 0', fontSize: 13.5 }}>Paris 11e</p>
          </div>
          <button className="text-link" type="button" onClick={() => go('results')}>
            Explorer la carte <ChevronRight size={17} />
          </button>
        </div>
        <MapIllustration
          selected={mapRestaurant}
          onSelect={setMapRestaurant}
          onOpen={() => go('restaurant', { restaurantId: mapRestaurant })}
        />
        <div style={{ marginTop: 12 }}>
          <RestaurantCard
            restaurant={selected}
            favorite={favorites.has(selected.id)}
            onFavorite={() => toggleFavorite(selected.id)}
            onOpen={() => go('restaurant', { restaurantId: selected.id })}
            compact
          />
        </div>
      </section>}

      <section style={{ marginTop: 30 }}>
        <h2 style={{ margin: '0 0 12px' }}>Pour changer d’air</h2>
        <div className="restaurant-stack">
          {restaurants.slice(1, 4).map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              favorite={favorites.has(restaurant.id)}
              onFavorite={() => toggleFavorite(restaurant.id)}
              onOpen={() => go('restaurant', { restaurantId: restaurant.id })}
            />
          ))}
        </div>
      </section>
      </>}
    </main>
  )
}
