import { Check, Search } from 'lucide-react'
import type { Restaurant } from '../data'
import type { CommonProps, SearchFilters } from '../nav'
import { MapIllustration } from '../components/kit'
import { RestaurantCard } from './Home'

export function filterRestaurants(items: Restaurant[], filters: SearchFilters): Restaurant[] {
  const query = filters.query.trim().toLocaleLowerCase('fr')
  const location = filters.location.trim().toLocaleLowerCase('fr')

  return items.filter((restaurant) => {
    const searchableText = [
      restaurant.name,
      restaurant.cuisine,
      restaurant.district,
      restaurant.description,
      ...restaurant.menu.map((item) => `${item.name} ${item.description}`),
    ]
      .join(' ')
      .toLocaleLowerCase('fr')
    const restaurantLocation = `${restaurant.district} ${restaurant.address}`.toLocaleLowerCase('fr')
    const distance = Number.parseFloat(restaurant.distance.replace(',', '.'))
    const matchesLocation =
      !location || location === 'paris et alentours' || restaurantLocation.includes(location)

    return (
      (!query || searchableText.includes(query)) &&
      matchesLocation &&
      filters.diets.every((diet) => restaurant.diets.includes(diet)) &&
      (Number.isNaN(distance) || distance <= filters.distance)
    )
  })
}

const DIETS = ['Halal', 'Végétarien', 'Végan']
const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  location: 'Paris et alentours',
  time: 'Peu importe',
  diets: [],
  distance: 5,
}

export function SearchPage({ go, goBack, filters, setFilters, restaurants }: CommonProps & {
  filters: SearchFilters
  setFilters: (filters: SearchFilters) => void
  restaurants: Restaurant[]
}) {
  const resultCount = filterRestaurants(restaurants, filters).length
  const toggleDiet = (diet: string) => {
    setFilters({
      ...filters,
      diets: filters.diets.includes(diet)
        ? filters.diets.filter((item) => item !== diet)
        : [...filters.diets, diet],
    })
  }

  return (
    <main className="page">
      <div className="modal-heading">
        <div>
          <span className="eyebrow">Filtres locaux</span>
          <h1 style={{ margin: '6px 0 0' }}>Trouver votre table</h1>
        </div>
        <button className="outline-button" type="button" style={{ padding: '10px 18px', fontSize: 14 }} onClick={goBack}>
          Fermer
        </button>
      </div>
      <p className="lead" style={{ marginTop: 10 }}>
        Vos critères restent dans cette session. Aucun historique de recherche n’est envoyé.
      </p>

      <section className="form-section">
        <h2 style={{ margin: 0 }}>Recherche</h2>
        <label>
          Restaurant, cuisine ou plat
          <input
            value={filters.query}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            placeholder="Ex. ramen ou Casa Verde"
          />
        </label>
        <label>
          Quartier ou ville
          <input
            value={filters.location}
            onChange={(event) => setFilters({ ...filters, location: event.target.value })}
            placeholder="Ex. Paris 11e"
          />
        </label>
      </section>

      <section className="form-section">
        <h2 style={{ margin: 0 }}>Horaire</h2>
        <strong style={{ fontSize: 16 }}>{filters.time}</strong>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          Choisissez parmi 13 créneaux de déjeuner et de dîner.
        </p>
        <div>
          <button className="outline-button" type="button" onClick={() => go('time')}>
            Changer l’horaire
          </button>
        </div>
      </section>

      <section className="form-section">
        <h2 style={{ margin: 0 }}>Préférences alimentaires</h2>
        <div className="chips">
          {DIETS.map((diet) => (
            <button key={diet} type="button" className={filters.diets.includes(diet) ? 'selected' : ''} onClick={() => toggleDiet(diet)}>
              {filters.diets.includes(diet) && <Check size={15} />} {diet}
            </button>
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2 style={{ margin: 0 }}>Distance maximale</h2>
        <div className="distance-options">
          {[2, 5, 10].map((distance) => (
            <button
              key={distance}
              type="button"
              className={filters.distance === distance ? 'active' : ''}
              onClick={() => setFilters({ ...filters, distance })}
            >
              {distance} km
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Distance simulée depuis Paris. Aucune localisation n’est demandée.
        </p>
      </section>

      <section className="form-section results-preview">
        <h2 style={{ margin: 0 }}>Aperçu des résultats</h2>
        <p style={{ margin: 0, fontSize: 14.5 }}>
          {resultCount} restaurant{resultCount > 1 ? 's' : ''} correspond{resultCount > 1 ? 'ent' : ''} à ces critères.
        </p>
        <div className="button-row">
          <button className="outline-button" type="button" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>
            Réinitialiser
          </button>
          <button className="primary-button" type="button" onClick={() => go('results')}>
            Afficher {resultCount} restaurant{resultCount > 1 ? 's' : ''}
          </button>
        </div>
      </section>
    </main>
  )
}

const TIMES = ['Peu importe', 'Maintenant', '12 h', '12 h 30', '13 h', '13 h 30', '18 h 30', '19 h', '19 h 30', '20 h', '20 h 30', '21 h', '21 h 30']

export function TimePage({ goBack, filters, setFilters }: CommonProps & {
  filters: SearchFilters
  setFilters: (filters: SearchFilters) => void
}) {
  const timeLabel = (time: string) => {
    if (time === 'Peu importe') return 'Voir tous les horaires'
    if (time === 'Maintenant') return 'Ouvert au moment de la recherche'
    return time.includes('12') || time.includes('13') ? 'Déjeuner' : 'Dîner'
  }

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Étape horaire</span>
          <h1 style={{ margin: '6px 0 0' }}>À quelle heure ?</h1>
        </div>
      </div>
      <p className="lead">Choisissez le moment précis auquel vous voulez arriver au restaurant.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
        {TIMES.map((time) => {
          const selected = filters.time === time
          return (
            <button
              key={time}
              type="button"
              onClick={() => setFilters({ ...filters, time })}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
                background: selected ? '#fbe9dc' : 'var(--surface)',
                border: `1.5px solid ${selected ? 'var(--orange)' : 'var(--line)'}`,
                borderRadius: 16, padding: '13px 15px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 15 }}>{time}</strong>
                {selected && <Check size={17} color="var(--orange)" />}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>{timeLabel(time)}</span>
            </button>
          )
        })}
      </div>
      <button className="primary-button full" type="button" style={{ marginTop: 22 }} onClick={goBack}>
        Choisir {filters.time.toLowerCase()}
      </button>
    </main>
  )
}

export function ResultsPage({ go, goBack, filters, restaurants, favorites, toggleFavorite }: CommonProps & {
  filters: SearchFilters
  restaurants: Restaurant[]
}) {
  const matching = filterRestaurants(restaurants, filters)

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Résultats de recherche</span>
          <h1 style={{ margin: '6px 0 4px' }}>
            {matching.length} restaurant{matching.length > 1 ? 's' : ''} autour de vous
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{filters.location || 'Paris et alentours'}</p>
        </div>
        <button className="outline-button" type="button" style={{ padding: '10px 18px', fontSize: 14 }} onClick={goBack}>
          Modifier
        </button>
      </div>

      <h2 style={{ margin: '18px 0 4px' }}>Autour de vous</h2>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13.5 }}>
        Le point bleu indique votre position simulée. Touchez une épingle pour identifier une adresse.
      </p>
      <MapIllustration
        selected={matching[0]?.id || 'amina'}
        onSelect={(id) => go('restaurant', { restaurantId: id })}
        onOpen={() => matching[0] && go('restaurant', { restaurantId: matching[0].id })}
      />

      <h2 style={{ margin: '24px 0 12px' }}>Restaurants correspondants</h2>
      <div className="restaurant-stack">
        {matching.map((restaurant) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            favorite={favorites.has(restaurant.id)}
            onFavorite={() => toggleFavorite(restaurant.id)}
            onOpen={() => go('restaurant', { restaurantId: restaurant.id })}
            compact
          />
        ))}
      </div>
      {!matching.length && (
        <div className="empty-state">
          <span>
            <Search size={26} />
          </span>
          <h2 style={{ margin: 0 }}>Aucun restaurant</h2>
          <p>Modifiez vos critères pour afficher d’autres adresses.</p>
        </div>
      )}
    </main>
  )
}
