import { useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, CreditCard, Edit3, Gift, Plus, Settings2, Trash2 } from 'lucide-react'
import { loyaltyRule } from '../data'
import type { Loyalty, MenuItem, Offer, Restaurant, RewardTier } from '../data'
import type { CommonProps } from '../nav'
import { LoyaltyCard, Notice, Tabs } from '../components/kit'
import { publishProfile, publishProgram, restaurantLink } from '../lib/api'
import { SearchProfileEditor } from '../components/SearchProfileEditor'
import { searchProfileSchema } from '../lib/search-profile'
import type { SearchProfile } from '../lib/search-profile'

export interface ProfileDraft extends SearchProfile {
  name: string
  cuisine: string
  district: string
  address: string
  description: string
  diets: string[]
  image: string
}

const DIET_OPTIONS = ['Halal', 'Végétarien', 'Végan', 'Sans gluten']

/** Types d'offres proposés au restaurateur — affichés dans « Infos & promos » côté client. */
const OFFER_KIND_OPTIONS: Array<[Offer['kind'], string]> = [
  ['happyhour', 'Happy hour'],
  ['duo', '1 + 1 offert'],
  ['discount', 'Promo'],
  ['special', 'Offre du moment'],
]
const OFFER_KIND_LABELS: Record<Offer['kind'], string> = Object.fromEntries(OFFER_KIND_OPTIONS) as Record<Offer['kind'], string>

export function ProfileEditorPage({ go, draft, setDraft, menu, setMenu, offers = [], setOffers, notify, withNav = false, restaurantId }: CommonProps & {
  draft: ProfileDraft
  setDraft: (draft: ProfileDraft) => void
  menu: MenuItem[]
  setMenu: (menu: MenuItem[]) => void
  offers?: Offer[]
  setOffers?: (offers: Offer[]) => void
  withNav?: boolean
  restaurantId?: string
}) {
  const [selectedItem, setSelectedItem] = useState(0)
  const [selectedOffer, setSelectedOffer] = useState(0)
  const [publishing, setPublishing] = useState(false)

  const publish = async () => {
    if (!restaurantId || publishing) return
    if (!searchProfileSchema.safeParse(draft).success) { notify('Vérifiez le budget, la capacité et les horaires avant de publier.'); return }
    setPublishing(true)
    const ok = await publishProfile(restaurantId, draft, menu, offers)
    setPublishing(false)
    notify(ok === 'unsupported' ? 'La synchronisation des critères nécessite la mise à jour du serveur. Ils restent conservés sur cet appareil.'
      : ok ? 'Profil, menu et offres publiés sur le serveur' : 'Publication impossible — vérifie ta connexion et les champs du formulaire. Ton brouillon reste affiché.')
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

  // Offres & promotions — ponctuelles, indépendantes du programme fidélité
  const updateOffer = (field: keyof Offer, value: string) => {
    setOffers?.(offers.map((offer, index) => (index === selectedOffer ? { ...offer, [field]: value } : offer)))
  }
  const addOffer = () => {
    const offer: Offer = { id: Date.now(), kind: 'happyhour', title: 'Nouvelle offre', detail: '', schedule: '' }
    setOffers?.([...offers, offer])
    setSelectedOffer(offers.length)
    notify('Offre ajoutée au brouillon — complétez-la ci-dessous')
  }
  const removeOffer = () => {
    if (!offers[selectedOffer]) return
    const removed = offers[selectedOffer].title
    setOffers?.(offers.filter((_, index) => index !== selectedOffer))
    setSelectedOffer((current) => Math.max(0, Math.min(current, offers.length - 2)))
    notify(`« ${removed} » retirée des offres`)
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

        <label>Régimes proposés</label>
        <p className="muted search-help">Déclarez uniquement les options que vous proposez réellement. Elles déterminent les filtres Végé, Végan, Halal et Sans gluten.</p>
        <div className="chips">
          {DIET_OPTIONS.map((diet) => (
            <button key={diet} type="button" aria-pressed={draft.diets.includes(diet)} className={draft.diets.includes(diet) ? 'selected' : ''} onClick={() => toggleDiet(diet)}>
              {draft.diets.includes(diet) && <Check size={15} />} {diet}
            </button>
          ))}
        </div>
      </section>

      <SearchProfileEditor value={draft} onChange={(profile) => setDraft({ ...draft, ...profile })} />

      <section className="gallery-draft">
        <h3 style={{ margin: 0 }}>Photo de couverture</h3>
        <p>Ces photos d’exemple permettent de préparer la couverture. Publiez le profil pour enregistrer votre choix.</p>
        <div>
          {[['Table', '/images/table.webp'], ['Cuisine', '/images/tacos.webp']].map(([label, image]) => (
            <button key={image} type="button" aria-pressed={draft.image === image} className={draft.image === image ? 'selected' : ''} onClick={() => setDraft({ ...draft, image })}>
              {draft.image === image && <Check size={14} />} {label}
            </button>
          ))}
        </div>
        <img src={draft.image} alt="Aperçu de la couverture" />
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
              Préparez votre menu, puis publiez-le pour le rendre visible à vos clients.
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
            <button className="outline-button full" type="button" disabled={publishing} onClick={() => void publish()}>
              {publishing ? 'Publication…' : 'Publier la façade et le menu'}
            </button>
            <button className="danger-button full" type="button" onClick={removeDish}>
              <Trash2 size={16} /> Retirer ce plat
            </button>
          </div>
        )}
      </section>

      <section className="menu-editor">
        <div className="menu-editor-header">
          <div>
            <h2 style={{ margin: 0 }}>Offres & promotions</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Happy hour, 1 acheté = 1 offert, promo du moment… Visibles dans l’onglet « Infos & promos » de votre
              page — indépendantes du programme fidélité.
            </p>
          </div>
          <button className="outline-button" type="button" onClick={addOffer}>
            <Plus size={16} /> Ajouter une offre
          </button>
        </div>
        <div className="editable-menu-list">
          {offers.map((offer, index) => (
            <button key={offer.id} type="button" className={selectedOffer === index ? 'active' : ''} onClick={() => setSelectedOffer(index)}>
              <span>
                <strong style={{ fontSize: 14.5, display: 'block' }}>{offer.title}</strong>
                <small>
                  {OFFER_KIND_LABELS[offer.kind]}
                  {offer.schedule ? ` · ${offer.schedule}` : ''}
                </small>
              </span>
              <Edit3 size={18} color="var(--muted-soft)" />
            </button>
          ))}
          {!offers.length && (
            <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 0' }}>
              Aucune offre pour le moment — ajoutez votre première promotion avec le bouton ci-dessus.
            </p>
          )}
        </div>
        {offers[selectedOffer] && (
          <div className="selected-dish">
            <h3 style={{ margin: 0 }}>Offre sélectionnée</h3>
            <label>Type d’offre</label>
            <div className="chips">
              {OFFER_KIND_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={offers[selectedOffer].kind === value ? 'selected' : ''}
                  onClick={() => updateOffer('kind', value)}
                >
                  {offers[selectedOffer].kind === value && <Check size={15} />} {label}
                </button>
              ))}
            </div>
            <label>
              Titre de l’offre
              <input value={offers[selectedOffer].title} onChange={(event) => updateOffer('title', event.target.value)} />
            </label>
            <label>
              Détail et conditions
              <textarea
                rows={2}
                placeholder="Ex. : en salle uniquement, hors boissons…"
                value={offers[selectedOffer].detail}
                onChange={(event) => updateOffer('detail', event.target.value)}
              />
            </label>
            <label>
              Jours et horaires (affiché aux clients)
              <input
                placeholder="Ex. : Lun–Ven · 17h–19h"
                value={offers[selectedOffer].schedule}
                onChange={(event) => updateOffer('schedule', event.target.value)}
              />
            </label>
            <button className="outline-button full" type="button" disabled={publishing} onClick={() => void publish()}>
              {publishing ? 'Publication…' : 'Publier la façade et les offres'}
            </button>
            <button className="danger-button full" type="button" onClick={removeOffer}>
              <Trash2 size={16} /> Retirer cette offre
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

export function QrPosterPage({ restaurant }: CommonProps & { restaurant: Restaurant }) {
  const qr = useRef<SVGSVGElement>(null)
  const url = restaurantLink(restaurant.id)
  const download = () => {
    if (!qr.current) return
    const blob = new Blob([new XMLSerializer().serializeToString(qr.current)], { type: 'image/svg+xml' })
    const href = URL.createObjectURL(blob), link = document.createElement('a')
    link.href = href; link.download = `Fidelity-QR-${restaurant.id}.svg`
    document.body.appendChild(link)
    link.click(); link.remove()
    window.setTimeout(() => URL.revokeObjectURL(href), 30_000)
  }
  return (
    <main className="page qr-poster-page">
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
        <QRCodeSVG ref={qr} value={url} size={240} level="M" marginSize={4} title={`Ouvrir la carte ${restaurant.name}`} />
        <strong style={{ fontSize: 15 }}>QR public d’inscription</strong>
        <p className="muted" style={{ margin: 0, fontSize: 13, textAlign: 'center' }}>
          Le client scanne et ouvre la page du restaurant pour ajouter sa carte « {restaurant.loyalty.title} ».
        </p>
      </section>

      <section className="poster">
        <span className="loyalty-logo">F</span>
        <small>Fidelity · Programme de fidélité</small>
        <h2 style={{ margin: 0, color: '#f7e4cd' }}>{restaurant.name}</h2>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{restaurant.loyalty.reward}</p>
        <QRCodeSVG value={url} size={220} level="M" marginSize={4} title={`Rejoindre ${restaurant.name}`} />
        <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.7 }}>
          Scannez pour ajouter votre carte. Présentez ensuite votre QR personnel en caisse à chaque visite.
        </p>
      </section>

      <div className="qr-poster-actions">
        <button className="primary-button full" type="button" onClick={() => window.print()}>Imprimer l’affiche / Enregistrer en PDF</button>
        <button className="outline-button full" type="button" onClick={download}>Télécharger le QR en SVG</button>
        <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">Tester le lien d’inscription</a>
      </div>
      {['localhost', '127.0.0.1'].includes(window.location.hostname) && <Notice title="Aperçu local">Pour une affiche utilisable par les clients, ouvre cet écran sur le site public Fidelity : le QR utilise l’adresse du site actuellement ouvert.</Notice>}
    </main>
  )
}
