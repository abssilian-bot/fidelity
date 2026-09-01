import type { ReactNode } from 'react'
import { ArrowLeft, Check, Heart, MapPin } from 'lucide-react'
import type { Restaurant } from '../data'

export function BackButton({ onClick, dark = false }: { onClick: () => void; dark?: boolean }) {
  return (
    <button className={`fixed-back-button ${dark ? 'dark' : ''}`} type="button" onClick={onClick} aria-label="Retour">
      <ArrowLeft size={22} strokeWidth={1.6} />
    </button>
  )
}

export function HeartButton({ active, onClick, small = false }: { active: boolean; onClick: () => void; small?: boolean }) {
  return (
    <button
      className={`heart-button ${active ? 'active' : ''} ${small ? 'small' : ''}`}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label="Ajouter aux favoris"
    >
      <Heart size={small ? 20 : 25} fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}

export function Tabs({ values, active, onChange }: { values: string[]; active: string; onChange: (value: string) => void }) {
  return (
    <div className="tabs">
      {values.map((value) => (
        <button key={value} type="button" className={active === value ? 'active' : ''} onClick={() => onChange(value)}>
          {value}
        </button>
      ))}
    </div>
  )
}

export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mode-notice">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  )
}

const MAP_PINS: Array<[string, string, string]> = [
  ['amina', '19%', '25%'],
  ['casa', '47%', '16%'],
  ['miso', '70%', '34%'],
  ['comptoir', '34%', '62%'],
  ['rizrouge', '76%', '72%'],
  ['braise', '14%', '76%'],
]

export function MapIllustration({ selected, onSelect, onOpen, showYou = true }: {
  selected: string
  onSelect: (id: string) => void
  onOpen: () => void
  showYou?: boolean
}) {
  return (
    <div className="map-card">
      <span className="map-label">CARTE LOCALE ILLUSTRÉE · SIMULATION</span>
      <div className="map-street street-one" />
      <div className="map-street street-two" />
      <div className="map-street street-three" />
      {showYou && <span className="map-you" style={{ left: '52%', top: '55%' }} />}
      {MAP_PINS.map(([id, left, top]) => (
        <button
          key={id}
          className={`map-pin ${selected === id ? 'active' : ''}`}
          style={{ left, top }}
          type="button"
          onClick={() => onSelect(id)}
          aria-label={`Sélectionner ${id}`}
        >
          <MapPin size={18} fill="currentColor" />
        </button>
      ))}
      <button className="map-open" type="button" onClick={onOpen}>
        Voir cette adresse
      </button>
    </div>
  )
}

export function LoyaltyCard({ restaurant, compact = false }: { restaurant: Restaurant; compact?: boolean }) {
  const loyalty = restaurant.loyalty
  const progress = Math.min(100, Math.round((loyalty.current / loyalty.target) * 100))
  const stampTarget = Math.min(10, Math.max(1, Number(loyalty.target) || 1))
  const stampCurrent = Math.min(stampTarget, Math.max(0, Number(loyalty.current) || 0))
  return (
    <article className={`loyalty-card style-${loyalty.style || 'braise'} ${compact ? 'compact' : ''}`}>
      <header>
        <span className="loyalty-logo">F</span>
        <div>
          <strong>{restaurant.name}</strong>
          <small>CARTE FIDELITY</small>
        </div>
      </header>
      {loyalty.type === 'stamps' ? (
        <div className="stamp-grid">
          {Array.from({ length: stampTarget }).map((_, index) => (
            <span key={index} className={index < stampCurrent ? 'filled' : ''}>
              {index < stampCurrent && <Check size={15} strokeWidth={2.6} />}
            </span>
          ))}
        </div>
      ) : (
        <>
          <div className="progress-bar">
            <i style={{ width: `${progress}%` }} />
          </div>
          <strong className="points-label">
            {loyalty.current} / {loyalty.target} points
          </strong>
        </>
      )}
      <div className="loyalty-divider" />
      <p className="card-rule-label">Comment gagner</p>
      <p className="card-rule">{loyalty.rule}</p>
      <p className="card-reward-label">Votre prochaine récompense</p>
      <strong className="reward-label">{loyalty.reward}</strong>
      <span className="effort">Encore un petit effort</span>
    </article>
  )
}

export function loyaltyTeaser(restaurant: Restaurant): string {
  const loyalty = restaurant.loyalty
  const unit = loyalty.type === 'stamps' ? `${loyalty.target} coches` : `${loyalty.target} points`
  return `Fidélité · ${unit} = ${loyalty.reward.charAt(0).toLowerCase()}${loyalty.reward.slice(1)}`
}
