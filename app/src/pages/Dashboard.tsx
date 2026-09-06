import { useEffect, useState } from 'react'
import { ArrowRight, Building2, Check, ChevronRight, CopyPlus, Gift, QrCode, RotateCcw, ScanLine, Share2, Star, Store, Trash2, UtensilsCrossed, Users, X } from 'lucide-react'
import { programClients, recentScans } from '../data'
import type { Restaurant } from '../data'
import type { AppRole, CommonProps } from '../nav'
import { fetchClients, getBackendState } from '../lib/api'

/** Écran d'entrée façon inscription : on choisit son interface. */
export function RolePickerPage({ onSelect }: { onSelect: (role: AppRole) => void }) {
  const [choice, setChoice] = useState<AppRole | null>(null)

  const options: Array<{ role: AppRole; icon: typeof Store; title: string; text: string }> = [
    {
      role: 'member',
      icon: UtensilsCrossed,
      title: 'Je cherche une table',
      text: 'Découvrir des restaurants, garder mes cartes de fidélité et suivre les tables de mes amis.',
    },
    {
      role: 'restaurant',
      icon: Store,
      title: 'Je suis restaurateur',
      text: 'Piloter mon programme de fidélité, suivre mes clients et publier ma page.',
    },
  ]

  return (
    <main className="role-picker">
      <span className="loyalty-logo role-logo">F</span>
      <span className="eyebrow">Bienvenue sur Fidelity</span>
      <h1 style={{ margin: '8px 0 4px' }}>À table, tout simplement</h1>
      <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>
        Pour commencer, dites-nous qui vous êtes.
      </p>

      <div className="role-options">
        {options.map((option) => (
          <button
            key={option.role}
            className={`role-card ${choice === option.role ? 'selected' : ''}`}
            type="button"
            onClick={() => setChoice(option.role)}
          >
            <span className="role-icon">
              <option.icon size={22} strokeWidth={1.7} />
            </span>
            <span className="role-copy">
              <strong>{option.title}</strong>
              <small>{option.text}</small>
            </span>
            <span className={`role-check ${choice === option.role ? 'on' : ''}`}>
              {choice === option.role && <Check size={14} strokeWidth={3} />}
            </span>
          </button>
        ))}
      </div>

      <button
        className="primary-button full"
        type="button"
        disabled={!choice}
        onClick={() => choice && onSelect(choice)}
      >
        Continuer <ArrowRight size={18} />
      </button>
      <p className="microcopy" style={{ textAlign: 'center' }}>
        Démonstration — vous pourrez changer d’interface à tout moment depuis les réglages.
      </p>
    </main>
  )
}

/** Résumé : les chiffres utiles et les actions du jour, rien de plus. */
export function RestoDashboardPage({ go, restaurant, sharedPosts = [] }: CommonProps & { restaurant: Restaurant }) {
  const pendingShares = sharedPosts.filter((share) => share.restaurantId === restaurant.id && share.status === 'pending')
  const [stats, setStats] = useState<{ newMembers: number; weeklyCredits: number; totalMembers: number } | null>(null)
  const connected = getBackendState().connected
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    const refresh = () => fetchClients(restaurant.id).then(data => { if (!cancelled) setStats(data?.stats ?? null) })
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 15_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [restaurant.id, connected])

  return (
    <main className="page page-with-nav">
      <div className="detail-header">
        <div>
          <span className="eyebrow">{restaurant.name}</span>
          <h1 style={{ margin: '6px 0 4px' }}>Résumé</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {connected ? 'votre programme en un coup d’œil.' : 'aperçu de démonstration.'}
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <strong>{connected ? stats?.totalMembers ?? '—' : programClients.length}</strong>
          <span>membres au programme</span>
        </div>
        <div className="kpi-card">
          <strong>{connected ? stats?.weeklyCredits ?? '—' : 27}</strong>
          <span>{restaurant.loyalty.type === 'stamps' ? 'coches' : 'points'} distribués (7 j)</span>
        </div>
        <div className="kpi-card">
          <strong>{connected ? stats?.newMembers ?? '—' : 3}</strong>
          <span>nouveaux membres (7 j)</span>
        </div>
        <button className="kpi-card accent as-button" type="button" onClick={() => go('restoFoodshare')}>
          <strong>{pendingShares.length}</strong>
          <span>partages FoodShare à valider</span>
        </button>
      </div>

      <div className="action-stack">
        <button className="primary-button full" type="button" onClick={() => go('restoScan')}>
          <ScanLine size={19} /> Scanner un client
        </button>
        <button className="outline-button full" type="button" onClick={() => go('restoClients')}>
          <Users size={18} /> Clients récents et leur activité
        </button>
      </div>
    </main>
  )
}

/** Clients du programme + leur activité récente. */
export function RestoClientsPage({ restaurant }: CommonProps & { restaurant: Restaurant }) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()
  const clients = normalized
    ? programClients.filter((client) => client.name.toLowerCase().includes(normalized))
    : programClients

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">{restaurant.name}</span>
          <h1 style={{ margin: '6px 0 4px' }}>Clients du programme</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {programClients.length} membres suivent « {restaurant.loyalty.title} ».
          </p>
        </div>
      </div>

      <label className="search-input">
        <Users size={18} strokeWidth={1.8} />
        <input
          type="search"
          placeholder="Rechercher un client…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="visit-list" style={{ marginTop: 18 }}>
        {clients.map((client) => (
          <div className="visit-row" key={client.id}>
            <span className="visit-avatar">{client.initials}</span>
            <span className="visit-copy">
              <strong>{client.name}</strong>
              <span className="mini-progress">
                <i style={{ width: `${Math.round((client.current / client.target) * 100)}%` }} />
              </span>
              <small>
                {client.current}/{client.target} {client.unit} · dernière visite : {client.lastVisit}
              </small>
            </span>
            {client.rewardReady ? (
              <span className="reward-badge">
                <Gift size={13} /> Prête
              </span>
            ) : (
              <span className="visit-count">
                <strong>{client.target - client.current}</strong>
                <small>reste{client.target - client.current > 1 ? 'nt' : ''}</small>
              </span>
            )}
          </div>
        ))}
        {!clients.length && (
          <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0' }}>
            Aucun client ne correspond à « {query} ».
          </p>
        )}
      </div>

      <section className="dashboard-section">
        <h2 style={{ margin: 0 }}>Activité récente</h2>
        <div className="dashboard-list">
          {recentScans.map((scan) => (
            <div className="activity-row" key={scan.id}>
              <span className="activity-dot" />
              <span className="visit-copy">
                <strong>{scan.clientName}</strong>
                <small>{scan.detail}</small>
              </span>
              <small className="activity-time">{scan.time}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

/** FoodShare : les clients partagent votre table, vous validez, ils gagnent des coches. */
export function RestoFoodsharePage({ restaurant, notify, sharedPosts = [], decideShare }: CommonProps & { restaurant: Restaurant }) {
  const [enabled, setEnabled] = useState(true)
  const isStamps = restaurant.loyalty.type === 'stamps'
  const rewardOptions = isStamps ? [1, 2, 3] : [50, 100, 200]
  const [reward, setReward] = useState(rewardOptions[0])
  const pending = sharedPosts.filter((share) => share.restaurantId === restaurant.id && share.status === 'pending')
  const published = sharedPosts.filter((share) => share.restaurantId === restaurant.id && share.status === 'published')

  const creditLabel = `+${reward} ${isStamps ? `coche${reward > 1 ? 's' : ''}` : 'points'}`

  return (
    <main className="page page-with-nav">
      <div className="detail-header">
        <div>
          <span className="eyebrow">{restaurant.name}</span>
          <h1 style={{ margin: '6px 0 4px' }}>FoodShare</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Un client partage votre table sur son fil. Vous validez : la photo part dans le fil public et sur votre
            page, le client est crédité.
          </p>
        </div>
      </div>

      <div className="action-stack">
        <button className="settings-row" type="button" onClick={() => setEnabled(!enabled)}>
          <span>
            <Share2 size={18} />
          </span>
          <span>
            <strong style={{ fontSize: 14.5 }}>Activer FoodShare</strong>
            <small>{enabled ? 'Les partages peuvent rapporter des coches.' : 'FoodShare est en pause.'}</small>
          </span>
          <span className={`radio-dot ${enabled ? 'on' : ''}`} />
        </button>

        <section className="form-section" style={{ marginTop: 0 }}>
          <label>Récompense par partage republié</label>
          <div className="chips">
            {rewardOptions.map((value) => (
              <button key={value} type="button" className={reward === value ? 'selected' : ''} onClick={() => setReward(value)}>
                {reward === value && <Check size={15} />} +{value} {isStamps ? `coche${value > 1 ? 's' : ''}` : 'points'}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="dashboard-section">
        <h2 style={{ margin: 0 }}>Partages à valider</h2>
        {enabled && pending.length > 0 && (
          <div className="dashboard-list">
            {pending.map((share) => (
              <article className="share-card" key={share.id}>
                <img className="share-photo" src={share.image} alt="" />
                <div className="share-body">
                  <div className="share-head">
                    <span className="visit-avatar">{share.initials}</span>
                    <span className="visit-copy">
                      <strong>{share.author}</strong>
                      <small className="share-stars">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star key={index} size={12} fill={index < share.rating ? 'currentColor' : 'none'} strokeWidth={1.8} />
                        ))}
                      </small>
                    </span>
                    <small className="activity-time">{share.time}</small>
                  </div>
                  {share.caption && <p className="share-caption">{share.caption}</p>}
                  <div className="share-decisions">
                    <button
                      className="primary-button share-validate"
                      type="button"
                      onClick={async () => {
                        if (!await decideShare?.(share.id, true, reward)) return
                        notify(
                          `Partage republié · ${creditLabel} crédité${reward > 1 && isStamps ? 's' : ''} pour ${share.author}${share.backendId ? '' : ' (démo)'}`,
                        )
                      }}
                    >
                      <Check size={16} strokeWidth={2.5} /> Republier · {creditLabel}
                    </button>
                    <button
                      className="share-decline"
                      type="button"
                      aria-label={`Refuser le partage de ${share.author}`}
                      onClick={async () => {
                        if (!await decideShare?.(share.id, false)) return
                        notify(`Partage de ${share.author} refusé — il reste visible sur son profil uniquement`)
                      }}
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {enabled && !pending.length && (
          <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
            Tout est à jour — aucun partage en attente.
          </p>
        )}
        {!enabled && (
          <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
            FoodShare est en pause : les nouveaux partages ne rapportent rien pour le moment.
          </p>
        )}
      </section>

      {published.length > 0 && (
        <section className="dashboard-section">
          <h2 style={{ margin: 0 }}>Republiés sur votre page</h2>
          <div className="dashboard-list">
            {published.map((share) => (
              <div className="activity-row" key={share.id}>
                <span className="visit-avatar">{share.initials}</span>
                <span className="visit-copy">
                  <strong>{share.author}</strong>
                  <small>{share.caption || 'Photo partagée'}</small>
                </span>
                <span className="reward-badge">
                  <Check size={13} /> En ligne
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

/** Établissements : basculer d'un restaurant à l'autre, QR par restaurant, archiver ou ouvrir. */
export function RestoPlacesPage({ go, restaurant, restaurants, archivedRestaurants = [], activeId, onSelect, onAdd, onArchive, onRestore, onDeleteForever, switchRole }: CommonProps & {
  restaurant: Restaurant
  restaurants: Restaurant[]
  archivedRestaurants?: Restaurant[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: (kind: 'franchise' | 'new') => void
  onArchive?: (id: string) => void
  onRestore?: (id: string) => void
  onDeleteForever?: (id: string) => void
}) {
  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Espace restaurateur</span>
          <h1 style={{ margin: '6px 0 4px' }}>Mes établissements</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Basculez d’un restaurant à l’autre, ou ouvrez-en un nouveau.
          </p>
        </div>
      </div>

      <div className="place-list">
        {restaurants.map((place) => (
          <div className={`role-card place-card ${activeId === place.id ? 'selected' : ''}`} key={place.id}>
            <button className="place-main" type="button" onClick={() => onSelect(place.id)}>
              <span className="role-icon">
                <Store size={21} strokeWidth={1.7} />
              </span>
              <span className="role-copy">
                <strong>{place.name}</strong>
                <small>
                  {place.cuisine} · {place.district}
                </small>
              </span>
              <span className={`role-check ${activeId === place.id ? 'on' : ''}`}>
                {activeId === place.id && <Check size={14} strokeWidth={3} />}
              </span>
            </button>
            <span className="place-actions">
              <button
                type="button"
                aria-label={`QR d’accueil de ${place.name}`}
                onClick={() => go('qrPoster', { restaurantId: place.id })}
              >
                <QrCode size={17} />
              </button>
              <button
                type="button"
                aria-label={`Archiver ${place.name}`}
                onClick={() => onArchive?.(place.id)}
                disabled={restaurants.length <= 1}
              >
                <Trash2 size={17} />
              </button>
            </span>
          </div>
        ))}
      </div>

      {archivedRestaurants.length > 0 && (
        <section className="dashboard-section">
          <h2 style={{ margin: 0 }}>Archivés</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Invisibles pour vos clients, mais rien n’est perdu. La suppression définitive est irréversible.
          </p>
          <div className="dashboard-list">
            {archivedRestaurants.map((place) => (
              <div className="visit-row" key={place.id}>
                <span className="visit-copy">
                  <strong>{place.name}</strong>
                  <small>{place.district}</small>
                </span>
                <button className="outline-button small-action" type="button" onClick={() => onRestore?.(place.id)}>
                  <RotateCcw size={14} /> Restaurer
                </button>
                <button className="danger-button small-action" type="button" onClick={() => onDeleteForever?.(place.id)}>
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <h2 style={{ margin: 0 }}>Ajouter un restaurant</h2>
        <div className="role-options" style={{ margin: 0 }}>
          <button className="role-card" type="button" onClick={() => onAdd('franchise')}>
            <span className="role-icon">
              <CopyPlus size={21} strokeWidth={1.7} />
            </span>
            <span className="role-copy">
              <strong>Ouvrir une franchise</strong>
              <small>Même concept que {restaurant.name} : le programme et le menu sont copiés, vous n’avez plus qu’à ajuster.</small>
            </span>
            <ChevronRight size={18} color="var(--muted-soft)" />
          </button>
          <button className="role-card" type="button" onClick={() => onAdd('new')}>
            <span className="role-icon">
              <Building2 size={21} strokeWidth={1.7} />
            </span>
            <span className="role-copy">
              <strong>Créer un autre restaurant</strong>
              <small>Un établissement indépendant, avec sa propre page, son menu et son programme.</small>
            </span>
            <ChevronRight size={18} color="var(--muted-soft)" />
          </button>
        </div>
      </section>

      <button className="settings-row" type="button" style={{ marginTop: 24 }} onClick={() => switchRole?.('member')}>
        <span>
          <UtensilsCrossed size={18} />
        </span>
        <span>
          <strong style={{ fontSize: 14.5 }}>Passer à l’interface membre</strong>
          <small>Retrouvez le fil, les cartes et les profils clients.</small>
        </span>
        <ChevronRight size={18} color="var(--muted-soft)" />
      </button>
    </main>
  )
}
