import { useState } from 'react'
import { Check, CreditCard, Edit3, Gift, Plus, Settings2, Trash2 } from 'lucide-react'
import { loyaltyRule } from '../data'
import type { Loyalty, MenuItem, Restaurant, RewardTier } from '../data'
import type { CommonProps } from '../nav'
import { LoyaltyCard, Notice, Tabs } from '../components/kit'
import { publishProfile, publishProgram } from '../lib/api'

export interface ProfileDraft {
  name: string
  cuisine: string
  district: string
  address: string
  description: string
  opening: string
  closing: string
  diets: string[]
  image: string
}

const DIET_OPTIONS = ['Halal', 'Végétarien', 'Végan', 'Sans gluten']

export function ProfileEditorPage({ go, draft, setDraft, menu, setMenu, notify, withNav = false, restaurantId }: CommonProps & {
  draft: ProfileDraft
  setDraft: (draft: ProfileDraft) => void
  menu: MenuItem[]
  setMenu: (menu: MenuItem[]) => void
  withNav?: boolean
  restaurantId?: string
}) {
  const [selectedItem, setSelectedItem] = useState(0)
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const [publishing, setPublishing] = useState(false)

  const publish = async () => {
    if (!restaurantId || publishing) return
    setPublishing(true)
    const ok = await publishProfile(restaurantId, draft, menu)
    setPublishing(false)
    notify(ok ? 'Profil et menu publiés sur le serveur ✅' : 'Publication impossible — serveur hors ligne, brouillon conservé en local')
  }

  const updateMenu = (field: keyof MenuItem, value: string) => {
    setMenu(menu.map((item, index) => (index === selectedItem ? { ...item, [field]: value } : item)))
  }
  const addDish = () => {
    const dish: MenuItem = { name: 'Nouveau plat', description: '', price: '0,00 €' }
    setMenu([...menu, dish])
    setSelectedItem(menu.length)
    notify('Plat ajouté au brouillon — complétez-le ci-dessous')
  }
  const removeDish = () => {
    if (!menu[selectedItem]) return
    const removed = menu[selectedItem].name
    setMenu(menu.filter((_, index) => index !== selectedItem))
    setSelectedItem((current) => Math.max(0, Math.min(current, menu.length - 2)))
    notify(`« ${removed} » retiré du menu`)
  }
  const toggleDiet = (diet: string) => {
    setDraft({
      ...draft,
      diets: draft.diets.includes(diet) ? draft.diets.filter((item) => item !== diet) : [...draft.diets, diet],
    })
  }

  return (
    <main className={withNav ? 'page page-with-nav' : 'page'}>
      <div className="detail-header">
        <div>
          <span className="eyebrow">Espace restaurateur</span>
          <h1 style={{ margin: '6px 0 4px' }}>Façade</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Le profil, les photos et le menu visibles par vos clients.
          </p>
        </div>
        <button
          className="round-button"
          type="button"
          aria-label="Réglages des établissements"
          title="Mes établissements"
          onClick={() => go('restoPlaces')}
        >
          <Settings2 size={19} strokeWidth={1.7} />
        </button>
      </div>

      <Notice title="Mode démonstration">
        Données de démonstration locales — aucune publication, caméra ou analyse réelle.
      </Notice>

      <section className="form-section">
        <h2 style={{ margin: 0 }}>Compte restaurant</h2>
        <label>
          Nom du restaurant
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label>
          Cuisine
          <input value={draft.cuisine} onChange={(event) => setDraft({ ...draft, cuisine: event.target.value })} />
        </label>
        <label>
          Adresse
          <input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} />
        </label>
        <label>
          Quartier
          <input value={draft.district} onChange={(event) => setDraft({ ...draft, district: event.target.value })} />
        </label>
        <label>
          Description
          <textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
        </label>

        <h3 style={{ margin: '8px 0 0' }}>Horaires du premier service</h3>
        <label>
          Ouverture (HH:MM)
          <input type="time" value={draft.opening} onChange={(event) => setDraft({ ...draft, opening: event.target.value })} />
        </label>
        <label>
          Fermeture (HH:MM)
          <input type="time" value={draft.closing} onChange={(event) => setDraft({ ...draft, closing: event.target.value })} />
        </label>

        <label>Régimes proposés</label>
        <div className="chips">
          {DIET_OPTIONS.map((diet) => (
            <button key={diet} type="button" className={draft.diets.includes(diet) ? 'selected' : ''} onClick={() => toggleDiet(diet)}>
              {draft.diets.includes(diet) && <Check size={15} />} {diet}
            </button>
          ))}
        </div>
      </section>

      <section className="gallery-draft">
        <h3 style={{ margin: 0 }}>Galerie — aperçu du brouillon</h3>
        <p>Choisissez la couverture locale à prévisualiser. Aucun fichier n’est téléversé ni publié.</p>
        <div>
          {['Photo 1', 'Photo 2'].map((label, index) => (
            <button key={label} type="button" className={selectedPhoto === index ? 'selected' : ''} onClick={() => setSelectedPhoto(index)}>
              {selectedPhoto === index && <Check size={14} />} {label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12 }}>Valeur du brouillon : {selectedPhoto === 0 ? 'chez-amina-hero' : 'chez-amina-table'}</p>
        <img src={selectedPhoto === 0 ? '/images/table.webp' : '/images/tacos.webp'} alt="" />
      </section>

      <button
        className="primary-button full"
        type="button"
        style={{ marginTop: 18 }}
        disabled={publishing}
        onClick={publish}
      >
        {publishing ? 'Publication en cours…' : 'Publier le profil et le menu'}
      </button>

      <section className="menu-editor">
        <div className="menu-editor-header">
          <div>
            <h2 style={{ margin: 0 }}>Éditeur de menu</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Prévisualisez chaque modification, puis publiez-la localement sans serveur ni envoi externe.
            </p>
          </div>
          <button className="outline-button" type="button" onClick={addDish}>
            <Plus size={16} /> Ajouter un plat
          </button>
        </div>
        <div className="editable-menu-list">
          {menu.map((item, index) => (
            <button key={`${item.name}-${index}`} type="button" className={selectedItem === index ? 'active' : ''} onClick={() => setSelectedItem(index)}>
              <span>
                <strong style={{ fontSize: 14.5, display: 'block' }}>{item.name}</strong>
                <small>{item.price}</small>
              </span>
              <Edit3 size={18} color="var(--muted-soft)" />
            </button>
          ))}
          {!menu.length && (
            <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 0' }}>
              Menu vide — ajoutez un premier plat avec le bouton ci-dessus.
            </p>
          )}
        </div>
        {menu[selectedItem] && (
          <div className="selected-dish">
            <h3 style={{ margin: 0 }}>Plat sélectionné</h3>
            <label>
              Nom du plat
              <input value={menu[selectedItem].name} onChange={(event) => updateMenu('name', event.target.value)} />
            </label>
            <label>
              Description du plat
              <textarea rows={3} value={menu[selectedItem].description} onChange={(event) => updateMenu('description', event.target.value)} />
            </label>
            <label>
              Prix en euros
              <input
                value={menu[selectedItem].price.replace(' €', '').replace(',', '.')}
                onChange={(event) => updateMenu('price', `${event.target.value.replace('.', ',')} €`)}
              />
            </label>
            <button className="outline-button full" type="button" onClick={() => notify('Plat enregistré dans l’aperçu local')}>
              Enregistrer dans l’aperçu local
            </button>
            <button className="danger-button full" type="button" onClick={removeDish}>
              <Trash2 size={16} /> Retirer ce plat
            </button>
          </div>
        )}
      </section>

      <button className="outline-button full" type="button" style={{ marginTop: 18 }} onClick={() => go('loyaltyEditor')}>
        <Gift size={18} /> Modifier le programme fidélité
      </button>
    </main>
  )
}

const STYLE_OPTIONS: Array<[Loyalty['style'], string]> = [
  ['braise', 'Braise'],
  ['creme', 'Crème'],
  ['encre', 'Encre'],
]

export function LoyaltyEditorPage({ go, restaurant, draft, setDraft, notify }: CommonProps & {
  restaurant: Restaurant
  draft: Loyalty
  setDraft: (draft: Loyalty) => void
}) {
  const [publishing, setPublishing] = useState(false)

  const publish = async () => {
    if (publishing) return
    setPublishing(true)
    const ok = await publishProgram(restaurant.id, draft)
    setPublishing(false)
    notify(ok ? 'Programme publié sur le serveur ✅' : 'Publication impossible — serveur hors ligne, brouillon conservé en local')
  }

  const isStamps = draft.type === 'stamps'
  const unit = isStamps ? 'coches' : 'points'
  const maxTierAt = isStamps ? 10 : Number.POSITIVE_INFINITY

  /** Trie les paliers, synchronise target/reward avec le dernier palier et régénère la règle de gain. */
  const derive = (loyalty: Loyalty): Loyalty => {
    const tiers = [...loyalty.tiers].sort((a, b) => a.at - b.at)
    const last = tiers[tiers.length - 1] ?? { at: 1, reward: 'Une récompense offerte' }
    return { ...loyalty, tiers, target: last.at, reward: last.reward, rule: loyaltyRule(loyalty) }
  }

  const setType = (type: Loyalty['type']) => {
    setDraft(
      derive({
        ...draft,
        type,
        current: type === 'stamps' ? 9 : 740,
        pointsPerEuro: type === 'points' ? draft.pointsPerEuro ?? 10 : draft.pointsPerEuro,
        eurosPerStamp: type === 'stamps' ? draft.eurosPerStamp ?? 0 : draft.eurosPerStamp,
        tiers:
          type === 'stamps'
            ? [
                { at: 4, reward: 'Une entrée offerte' },
                { at: 10, reward: 'Un plat offert' },
              ]
            : [
                { at: 200, reward: 'Un dessert offert' },
                { at: 800, reward: 'Un menu offert' },
              ],
      }),
    )
  }

  const updateTier = (index: number, patch: Partial<RewardTier>) => {
    setDraft(derive({ ...draft, tiers: draft.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)) }))
  }
  const updateTierAt = (index: number, value: string) => {
    const parsed = Number(value)
    const at = Math.min(maxTierAt, Math.max(1, Number.isFinite(parsed) ? parsed : 1))
    updateTier(index, { at })
  }
  const addTier = () => {
    const lastAt = draft.tiers[draft.tiers.length - 1]?.at ?? 0
    const at = Math.min(maxTierAt, isStamps ? lastAt + 2 : lastAt + 200)
    setDraft(derive({ ...draft, tiers: [...draft.tiers, { at, reward: 'Une récompense offerte' }] }))
  }
  const removeTier = (index: number) => {
    if (draft.tiers.length <= 1) return
    setDraft(derive({ ...draft, tiers: draft.tiers.filter((_, i) => i !== index) }))
  }

  const previewRestaurant: Restaurant = { ...restaurant, loyalty: draft }
  const menuSuggestions = restaurant.menu.map((item) => `« ${item.name} » offert`)

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Espace restaurateur</span>
          <h1 style={{ margin: '6px 0 4px' }}>Programme fidélité</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Composez, validez et publiez un programme local avec aperçu client en direct.
          </p>
        </div>
      </div>

      <Notice title="Mode démonstration">
        Données de démonstration locales — aucune publication, caméra ou analyse réelle.
      </Notice>

      <h2 style={{ margin: '10px 0 4px' }}>Constructeur progressif</h2>
      <p className="lead" style={{ margin: 0, fontSize: 14 }}>
        La publication met immédiatement à jour le restaurant et sa carte client dans la session.
      </p>

      <Tabs
        values={['À coches', 'À points']}
        active={isStamps ? 'À coches' : 'À points'}
        onChange={(value) => setType(value === 'À coches' ? 'stamps' : 'points')}
      />

      <section className="form-section">
        <label>
          Titre du programme
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </label>

        <h3 style={{ margin: '8px 0 0' }}>Comment les clients gagnent</h3>
        {isStamps ? (
          <>
            <label>Attribuer une coche…</label>
            <div className="chips">
              <button
                type="button"
                className={!draft.eurosPerStamp ? 'selected' : ''}
                onClick={() => setDraft(derive({ ...draft, eurosPerStamp: 0 }))}
              >
                {!draft.eurosPerStamp && <Check size={15} />} à chaque visite
              </button>
              <button
                type="button"
                className={draft.eurosPerStamp ? 'selected' : ''}
                onClick={() => setDraft(derive({ ...draft, eurosPerStamp: draft.eurosPerStamp || 15 }))}
              >
                {draft.eurosPerStamp ? <Check size={15} /> : null} tous les X € dépensés
              </button>
            </div>
            {!!draft.eurosPerStamp && (
              <label>
                Montant en euros pour une coche
                <input
                  type="number"
                  min={1}
                  value={draft.eurosPerStamp}
                  onChange={(event) => {
                    const parsed = Number(event.target.value)
                    setDraft(derive({ ...draft, eurosPerStamp: Math.max(1, Number.isFinite(parsed) ? parsed : 1) }))
                  }}
                />
              </label>
            )}
          </>
        ) : (
          <label>
            Points gagnés par euro dépensé
            <input
              type="number"
              min={1}
              value={draft.pointsPerEuro ?? 10}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                setDraft(derive({ ...draft, pointsPerEuro: Math.max(1, Number.isFinite(parsed) ? parsed : 1) }))
              }}
            />
          </label>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          Règle affichée aux clients : {draft.rule}
        </p>
      </section>

      <section className="form-section">
        <h3 style={{ margin: 0 }}>Paliers de récompenses</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Chaque palier débloque une récompense{isStamps ? ' (10 coches maximum)' : ''}. Piochez dans votre menu pour
          des récompenses cohérentes.
        </p>
        {draft.tiers.map((tier, index) => (
          <div className="tier-edit" key={index}>
            <div className="tier-edit-head">
              <label style={{ margin: 0 }}>
                À combien de {unit} ?
                <input
                  type="number"
                  min={1}
                  max={isStamps ? 10 : undefined}
                  value={tier.at}
                  onChange={(event) => updateTierAt(index, event.target.value)}
                />
              </label>
              <button
                className="place-icon-button"
                type="button"
                aria-label={`Retirer le palier ${index + 1}`}
                disabled={draft.tiers.length <= 1}
                onClick={() => removeTier(index)}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <label style={{ margin: 0 }}>
              Récompense du palier
              <input value={tier.reward} onChange={(event) => updateTier(index, { reward: event.target.value })} />
            </label>
            {menuSuggestions.length > 0 && (
              <div className="chips">
                {menuSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className={tier.reward === suggestion ? 'selected' : ''}
                    onClick={() => updateTier(index, { reward: suggestion })}
                  >
                    {tier.reward === suggestion && <Check size={15} />} {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <button className="outline-button" type="button" onClick={addTier}>
          <Plus size={16} /> Ajouter un palier
        </button>
      </section>

      <section className="form-section">
        <label>Style de carte</label>
        <div className="chips">
          {STYLE_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={draft.style === value ? 'selected' : ''}
              onClick={() => setDraft({ ...draft, style: value })}
            >
              {draft.style === value && <Check size={15} />} {label}
            </button>
          ))}
        </div>
      </section>

      <p className="muted" style={{ fontSize: 12.5, margin: '18px 0 -8px' }}>
        Aperçu client — preset {STYLE_OPTIONS.find(([value]) => value === draft.style)?.[1]}
      </p>
      <div style={{ marginTop: 4 }}>
        <LoyaltyCard restaurant={previewRestaurant} />
      </div>

      <button
        className="primary-button full"
        type="button"
        style={{ marginTop: 18 }}
        disabled={publishing}
        onClick={publish}
      >
        {publishing ? 'Publication en cours…' : 'Publier le programme sur le serveur'}
      </button>
      <button className="outline-button full" type="button" style={{ marginTop: 10 }} onClick={() => go('qrPoster', { restaurantId: restaurant.id })}>
        <CreditCard size={18} /> Voir le QR et l’affiche en aperçu
      </button>
    </main>
  )
}

const QR_PATTERN = [
  1,1,1,0,1,0,1,1,1,
  1,0,1,0,0,1,1,0,1,
  1,1,1,0,1,1,0,1,1,
  0,0,0,1,0,0,1,0,0,
  1,0,1,1,1,0,1,1,0,
  0,1,0,0,1,1,0,0,1,
  1,1,1,0,1,0,1,1,1,
  1,0,1,1,0,1,1,0,1,
  1,1,1,0,1,1,0,1,1,
]

/** Chaque restaurant a son propre QR : on décale le motif selon l'identifiant. */
const qrPatternFor = (id: string) => {
  const hash = [...id].reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0)
  return QR_PATTERN.map((cell, index) => {
    const inFinder = (index < 21 && index % 9 < 3) || (index < 27 && index % 9 > 5) || (index > 53 && index % 9 < 3)
    if (inFinder) return cell // les trois coins repères restent fixes
    return (cell + ((index + hash) % 7 === 0 ? 1 : 0)) % 2
  })
}

export function QrPosterPage({ restaurant }: CommonProps & { restaurant: Restaurant }) {
  const pattern = qrPatternFor(restaurant.id)
  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">QR & affiche</span>
          <h1 style={{ margin: '6px 0 4px' }}>{restaurant.name}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Le QR public d’inscription et l’affiche à imprimer pour le comptoir.
          </p>
        </div>
      </div>

      <section className="qr-frame">
        <div className="qr-grid">
          {pattern.map((cell, index) => (
            <span key={index} className={cell ? '' : 'off'} />
          ))}
        </div>
        <strong style={{ fontSize: 15 }}>QR public d’inscription</strong>
        <p className="muted" style={{ margin: 0, fontSize: 13, textAlign: 'center' }}>
          Le client scanne, ouvre la page du restaurant et rejoint « {restaurant.loyalty.title} » en dix secondes.
        </p>
      </section>

      <section className="poster">
        <span className="loyalty-logo">F</span>
        <small>Fidelity · Programme de fidélité</small>
        <h2 style={{ margin: 0, color: '#f7e4cd' }}>{restaurant.name}</h2>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{restaurant.loyalty.reward}</p>
        <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.7 }}>
          Scannez le code en caisse pour gagner {restaurant.loyalty.type === 'stamps' ? 'des coches' : 'des points'} à
          chaque visite.
        </p>
      </section>

      <Notice title="Aperçu d’impression">
        L’affiche finale sera générée en PDF depuis l’espace restaurateur, avec le vrai QR lié à votre compte.
      </Notice>
    </main>
  )
}
