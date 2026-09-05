import { Check, Plus, Trash2 } from 'lucide-react'
import { FOOD_CATEGORIES, SERVICE_FILTERS, WEEK_DAYS } from '../lib/search-catalog'
import type { SearchProfile } from '../lib/search-profile'

export function SearchProfileEditor({ value, onChange }: { value: SearchProfile; onChange: (value: SearchProfile) => void }) {
  const toggle = (key: 'foodTags' | 'services', id: string) => onChange({ ...value,
    [key]: value[key].includes(id) ? value[key].filter((item) => item !== id) : [...value[key], id],
  })
  const updateDay = (day: number, intervals: SearchProfile['openingHours'][number]['intervals']) => {
    onChange({ ...value, openingHours: [...value.openingHours.filter((item) => item.day !== day), { day, intervals }].sort((a, b) => a.day - b.day) })
  }
  return <>
    <section className="form-section search-profile-editor">
      <span className="eyebrow">Être trouvé sur Fidelity</span>
      <h2>Vos spécialités</h2>
      <p className="muted search-help">Choisissez jusqu’à 8 catégories qui représentent votre carte. Les noms de vos plats sont aussi recherchables.</p>
      <div className="chips">{FOOD_CATEGORIES.map((option) => <button type="button" key={option.id}
        aria-pressed={value.foodTags.includes(option.id)} className={value.foodTags.includes(option.id) ? 'selected' : ''}
        disabled={value.foodTags.length >= 8 && !value.foodTags.includes(option.id)} onClick={() => toggle('foodTags', option.id)}>
        {value.foodTags.includes(option.id) && <Check size={14} />}{option.label}
      </button>)}</div>
      <h3>Vos services</h3>
      <div className="chips">{SERVICE_FILTERS.map((option) => <button type="button" key={option.id}
        aria-pressed={value.services.includes(option.id)} className={value.services.includes(option.id) ? 'selected' : ''}
        onClick={() => toggle('services', option.id)}>{value.services.includes(option.id) && <Check size={14} />}{option.label}</button>)}</div>
      <div className="search-profile-numbers">
        <label>Prix moyen par personne (€)<input type="number" min="0" max="1000" step="0.5" inputMode="decimal" value={value.avgPrice || ''}
          placeholder="Ex. 18" onChange={(event) => onChange({ ...value, avgPrice: Number(event.target.value) })} /></label>
        <label>Personnes par table, au maximum<input type="number" min="1" max="200" step="1" inputMode="numeric" value={value.maxGuests || ''}
          placeholder="Ex. 6" onChange={(event) => onChange({ ...value, maxGuests: Number(event.target.value) })} /></label>
      </div>
      <p className="muted search-help">Laissez vide ce qui n’est pas encore renseigné. Ces informations servent aux filtres budget et taille de table.</p>
    </section>
    <section className="form-section">
      <h2>Horaires de la semaine</h2>
      <p className="muted search-help">Heure de Paris. Ajoutez un second service si vous fermez entre le déjeuner et le dîner. Une fermeture après minuit est possible.</p>
      <div className="weekly-hours">{[1, 2, 3, 4, 5, 6, 0].map((day) => {
        const periods = value.openingHours.find((item) => item.day === day)?.intervals ?? []
        return <div key={day} className="opening-day">
          <label className="opening-day-toggle"><input type="checkbox" checked={periods.length > 0}
            onChange={(event) => updateDay(day, event.target.checked ? [{ open: '12:00', close: '14:00' }] : [])} />{WEEK_DAYS[day]}</label>
          {!periods.length && <small className="muted">Fermé / non renseigné</small>}
          {periods.map((period, index) => <div key={index} className="opening-period">
            <label><span className="sr-only">Ouverture {WEEK_DAYS[day]} service {index + 1}</span><input aria-label={`Ouverture ${WEEK_DAYS[day]} service ${index + 1}`} type="time" value={period.open}
              onChange={(event) => updateDay(day, periods.map((item, i) => i === index ? { ...item, open: event.target.value } : item))} /></label>
            <span>à</span>
            <label><span className="sr-only">Fermeture {WEEK_DAYS[day]} service {index + 1}</span><input aria-label={`Fermeture ${WEEK_DAYS[day]} service ${index + 1}`} type="time" value={period.close}
              onChange={(event) => updateDay(day, periods.map((item, i) => i === index ? { ...item, close: event.target.value } : item))} /></label>
            <button type="button" className="search-clear" aria-label={`Retirer ${WEEK_DAYS[day]} service ${index + 1}`} onClick={() => updateDay(day, periods.filter((_, i) => i !== index))}><Trash2 size={16} /></button>
          </div>)}
          {periods.length === 1 && <button type="button" className="text-link" onClick={() => updateDay(day, [...periods, { open: '19:00', close: '22:00' }])}><Plus size={14} />Second service</button>}
        </div>
      })}</div>
      <p className="muted search-help">Critères conservés sur cet appareil. Publiez la façade pour les synchroniser avec les autres appareils.</p>
    </section>
  </>
}
