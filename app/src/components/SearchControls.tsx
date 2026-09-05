import { Check, Search, SlidersHorizontal, X } from 'lucide-react'
import type { SearchFilters } from '../nav'
import { DIET_FILTERS, FOOD_CATEGORIES, QUICK_FILTERS, SERVICE_FILTERS } from '../lib/search-catalog'
import { activeFilterCount, toggleQuickFilter } from '../lib/search'

export function SearchBox({ value, onChange, onSubmit, placeholder, onFilters, filterCount = 0, label }: {
  value: string; onChange: (value: string) => void; onSubmit?: () => void; placeholder: string
  onFilters?: () => void; filterCount?: number; label: string
}) {
  return (
    <form className="search-box" role="search" onSubmit={(event) => { event.preventDefault(); onSubmit?.() }}>
      <Search size={20} strokeWidth={1.7} aria-hidden="true" />
      <input aria-label={label} type="search" value={value} maxLength={160} autoComplete="off"
        enterKeyHint="search" placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {value && <button className="search-clear" type="button" aria-label="Effacer la recherche" onClick={() => onChange('')}><X size={17} /></button>}
      {onFilters && <button className={`search-filter-button ${filterCount ? 'has-filters' : ''}`} type="button"
        aria-label={`Tous les filtres${filterCount ? `, ${filterCount} actifs` : ''}`} onClick={onFilters}>
        <SlidersHorizontal size={19} />{filterCount > 0 && <span>{filterCount}</span>}
      </button>}
    </form>
  )
}

export function QuickFilters({ filters, onChange }: { filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
  const options = [...FOOD_CATEGORIES, ...DIET_FILTERS, ...SERVICE_FILTERS]
  const selected = (id: string) => {
    const diet = DIET_FILTERS.find((option) => option.id === id)
    return diet ? filters.diets.includes(diet.value) : filters.categories.includes(id) || filters.services.includes(id)
  }
  const visible = [...new Set([...QUICK_FILTERS, ...options.filter((option) => selected(option.id)).map((option) => option.id)])]
  return (
    <div className="quick-filters" role="group" aria-label="Filtres rapides">
      {visible.map((id) => {
        const option = options.find((option) => option.id === id)
        if (!option) return null
        return <button key={id} type="button" aria-pressed={selected(id)} className={`filter-bubble ${selected(id) ? 'selected' : ''}`}
          onClick={() => onChange(toggleQuickFilter(filters, id))}>
          {selected(id) && <Check size={14} strokeWidth={2} />}{option.label}
        </button>
      })}
    </div>
  )
}

export function SearchSummary({ count, filters, onReset }: { count: number; filters: SearchFilters; onReset: () => void }) {
  return <div className="search-summary">
    <p role="status" aria-live="polite">{count} table{count !== 1 ? 's' : ''}{filters.query.trim() ? ` pour « ${filters.query.trim()} »` : ''}</p>
    {(activeFilterCount(filters) > 0 || filters.query.trim()) && <button type="button" className="text-link" onClick={onReset}>Tout effacer</button>}
  </div>
}

export function SearchSort({ filters, onChange }: { filters: SearchFilters; onChange: (filters: SearchFilters) => void }) {
  return <label className="search-sort">Trier par
    <select value={filters.sort} onChange={(event) => onChange({ ...filters, sort: event.target.value as SearchFilters['sort'] })}>
      <option value="relevance">Pertinence</option><option value="price">Prix croissant</option><option value="distance">Distance</option>
    </select>
  </label>
}
