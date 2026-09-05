import { Check, Search } from 'lucide-react'
import type { Restaurant } from '../data'
import type { CommonProps, SearchFilters } from '../nav'
import { RestaurantCard } from './Home'
import { QuickFilters, SearchBox, SearchSort, SearchSummary } from '../components/SearchControls'
import { DIET_FILTERS, FOOD_CATEGORIES, SERVICE_FILTERS } from '../lib/search-catalog'
import { activeFilterCount, defaultSearchFilters, toggleQuickFilter } from '../lib/search'
import { useRestaurantSearch } from '../hooks/use-search'

export function SearchFacets({ filters, setFilters }: { filters: SearchFilters; setFilters: (filters: SearchFilters) => void }) {
  return <>
    <section className="form-section">
      <h2>De quoi avez-vous envie ?</h2>
      <p className="muted search-help">Plusieurs envies : les tables qui proposent au moins l’une d’elles.</p>
      <div className="chips">{FOOD_CATEGORIES.map((option) => <button key={option.id} type="button"
        aria-pressed={filters.categories.includes(option.id)} className={filters.categories.includes(option.id) ? 'selected' : ''}
        onClick={() => setFilters(toggleQuickFilter(filters, option.id))}>{filters.categories.includes(option.id) && <Check size={14} />}{option.label}</button>)}</div>
    </section>
    <section className="form-section">
      <h2>Préférences alimentaires</h2>
      <p className="muted search-help">Toutes vos préférences doivent être proposées par le restaurant.</p>
      <div className="chips">{DIET_FILTERS.map((option) => <button key={option.id} type="button"
        aria-pressed={filters.diets.includes(option.value)} className={filters.diets.includes(option.value) ? 'selected' : ''}
        onClick={() => setFilters(toggleQuickFilter(filters, option.id))}>{filters.diets.includes(option.value) && <Check size={14} />}{option.value}</button>)}</div>
    </section>
    <section className="form-section">
      <h2>Sur place ou à emporter</h2>
      <div className="chips">{SERVICE_FILTERS.map((option) => <button key={option.id} type="button"
        aria-pressed={filters.services.includes(option.id)} className={filters.services.includes(option.id) ? 'selected' : ''}
        onClick={() => setFilters(toggleQuickFilter(filters, option.id))}>{filters.services.includes(option.id) && <Check size={14} />}{option.label}</button>)}</div>
    </section>
  </>
}

const PRICE_OPTIONS: Array<[number, string]> = [[0, 'Tous les budgets'], [15, '≤ 15 €'], [20, '≤ 20 €'], [30, '≤ 30 €'], [50, '≤ 50 €']]

export function SearchPage({ go, filters, setFilters, restaurants }: CommonProps & {
  filters: SearchFilters; setFilters: (filters: SearchFilters) => void; restaurants: Restaurant[]
}) {
  const matching = useRestaurantSearch(restaurants, filters)
  return <main className="page search-filter-page">
    <div className="detail-header"><div><span className="eyebrow">Votre prochaine table</span><h1>Affiner la recherche</h1></div></div>
    <SearchBox label="Rechercher une table" value={filters.query} onChange={(query) => setFilters({ ...filters, query })}
      placeholder="Ex. ramen végé ou Casa Verde" onSubmit={() => go('results')} />
    <QuickFilters filters={filters} onChange={setFilters} />
    <section className="form-section"><h2>Où ?</h2><label>Ville, quartier ou code postal
      <input value={filters.location} maxLength={100} onChange={(event) => setFilters({ ...filters, location: event.target.value })} placeholder="Ex. Paris 11e" />
    </label></section>
    <SearchFacets filters={filters} setFilters={setFilters} />
    <section className="form-section"><h2>Aujourd’hui, à quelle heure ?</h2>
      <p className="search-help muted">{filters.times.length ? filters.times.join(' · ') : 'Tous les horaires'}</p>
      <button className="outline-button" type="button" onClick={() => go('time')}>Choisir un horaire</button>
      {filters.times.length > 0 && <button className="text-link" type="button" onClick={() => setFilters({ ...filters, times: [] })}>Retirer les horaires</button>}
    </section>
    <section className="form-section"><h2>Combien êtes-vous ?</h2><div className="chips">
      {[1, 2, 3, 4, 6, 8].map((guests) => <button type="button" key={guests} aria-pressed={filters.guests === guests} className={filters.guests === guests ? 'selected' : ''}
        onClick={() => setFilters({ ...filters, guests })}>{guests === 1 ? 'Peu importe' : guests + ' pers.'}</button>)}
    </div><p className="search-help muted">Selon la capacité de table renseignée par l’établissement.</p></section>
    <section className="form-section"><h2>Budget par personne</h2><div className="chips">
      {PRICE_OPTIONS.map(([maxPrice, label]) => <button type="button" key={maxPrice} aria-pressed={filters.maxPrice === maxPrice} className={filters.maxPrice === maxPrice ? 'selected' : ''}
        onClick={() => setFilters({ ...filters, maxPrice })}>{label}</button>)}
    </div><p className="search-help muted">Prix moyen d’un repas, indiqué par le restaurant.</p></section>
    <section className="form-section"><h2>Distance maximale</h2><div className="chips">
      {[0, 2, 5, 10].map((distance) => <button type="button" key={distance} aria-pressed={filters.distance === distance} className={filters.distance === distance ? 'selected' : ''}
        onClick={() => setFilters({ ...filters, distance })}>{distance ? distance + ' km' : 'Peu importe'}</button>)}
    </div><p className="search-help muted">Les distances de cet aperçu sont données depuis Paris 11e.</p></section>
    <div className="search-filter-footer"><button type="button" className="text-link" onClick={() => setFilters(defaultSearchFilters())}>Tout effacer</button>
      <button className="primary-button" type="button" onClick={() => go('results')}>Voir {matching.length} table{matching.length !== 1 ? 's' : ''}</button>
    </div>
  </main>
}

const TIMES = ['Maintenant', '12 h', '12 h 30', '13 h', '13 h 30', '18 h 30', '19 h', '19 h 30', '20 h', '20 h 30', '21 h', '21 h 30']

export function TimePage({ goBack, filters, setFilters }: CommonProps & {
  filters: SearchFilters; setFilters: (filters: SearchFilters) => void
}) {
  return <main className="page">
    <div className="detail-header"><div><span className="eyebrow">Aujourd’hui · heure de Paris</span><h1>À quelle heure ?</h1></div></div>
    <p className="lead">Choisissez un ou plusieurs créneaux. Les tables ouvertes à au moins un de ces horaires seront proposées.</p>
    <div className="time-options">{TIMES.map((time) => {
      const selected = filters.times.includes(time)
      return <button type="button" key={time} aria-pressed={selected} className={selected ? 'selected' : ''}
        onClick={() => setFilters({ ...filters, times: selected ? filters.times.filter((item) => item !== time) : [...filters.times, time] })}>
        <span>{time}{selected && <Check size={17} />}</span><small>{time === 'Maintenant' ? 'Ouvert actuellement' : time.startsWith('12') || time.startsWith('13') ? 'Déjeuner' : 'Dîner'}</small>
      </button>
    })}</div>
    <button className="primary-button full" type="button" style={{ marginTop: 22 }} onClick={goBack}>Valider les horaires</button>
  </main>
}

export function ResultsPage({ go, filters, setFilters, restaurants, favorites, toggleFavorite }: CommonProps & {
  filters: SearchFilters; setFilters: (filters: SearchFilters) => void; restaurants: Restaurant[]
}) {
  const matching = useRestaurantSearch(restaurants, filters)
  return <main className="page">
    <div className="detail-header"><div><span className="eyebrow">Vos envies, vos tables</span><h1>Les bonnes adresses</h1></div></div>
    <SearchBox label="Rechercher une table" value={filters.query} onChange={(query) => setFilters({ ...filters, query })}
      placeholder="Une cuisine, un plat, une table…" onFilters={() => go('search')} filterCount={activeFilterCount(filters)} />
    <QuickFilters filters={filters} onChange={setFilters} />
    <SearchSummary count={matching.length} filters={filters} onReset={() => setFilters(defaultSearchFilters())} />
    <SearchSort filters={filters} onChange={setFilters} />
    <div className="restaurant-stack">{matching.map((restaurant) => <RestaurantCard key={restaurant.id} restaurant={restaurant}
      favorite={favorites.has(restaurant.id)} onFavorite={() => toggleFavorite(restaurant.id)} onOpen={() => go('restaurant', { restaurantId: restaurant.id })} compact />)}</div>
    {!matching.length && <div className="empty-state"><span><Search size={26} /></span><h2>Aucune table pour ces critères</h2>
      <p>Essayez une autre cuisine, un autre quartier ou moins de filtres.</p>
      <button className="outline-button full" type="button" onClick={() => go('search')}>Ajuster les filtres</button></div>}
  </main>
}
