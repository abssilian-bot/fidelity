import { useState } from 'react'
import { Check, Clock3, CreditCard, Gift, Heart, Info, MapPin, Navigation, Percent, Share2, Sparkles, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Offer, Restaurant } from '../data'
import { userVisits } from '../data'
import type { CommonProps } from '../nav'
import { HeartButton, LoyaltyCard, Tabs } from '../components/kit'

/** Offres ponctuelles — distinctes du programme de fidélité. */
const OFFER_LABELS: Record<Offer['kind'], string> = {
  happyhour: 'Happy hour',
  duo: '1 + 1 offert',
  discount: 'Promo',
  special: 'Offre du moment',
}
const OFFER_ICONS: Record<Offer['kind'], LucideIcon> = {
  happyhour: Clock3,
  duo: Gift,
  discount: Percent,
  special: Sparkles,
}

/** Badge « En ce moment » quand la plage jours/horaires de l'offre couvre l'instant présent. */
const offerIsLive = (offer: Offer) => {
  if (!offer.days || offer.startHour === undefined || offer.endHour === undefined) return false
  const now = new Date()
  const hour = now.getHours() + now.getMinutes() / 60
  return offer.days.includes(now.getDay()) && hour >= offer.startHour && hour < offer.endHour
}

export function RestaurantPage({ go, restaurant, favorites, toggleFavorite, sharedPosts = [], myReviews = [] }: CommonProps & { restaurant: Restaurant }) {
  const [activeTab, setActiveTab] = useState('Publications')
  const restaurantShares = sharedPosts.filter((share) => share.restaurantId === restaurant.id && share.status === 'published')
  const restaurantMyReviews = myReviews.filter((review) => review.restaurantId === restaurant.id)

  return (
    <main className="page">
      <div>
        <span className="eyebrow">{restaurant.cuisine}</span>
        <h1 style={{ margin: '6px 0 4px' }}>{restaurant.name}</h1>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {restaurant.district} · {restaurant.distance} · Note {restaurant.rating}/5
        </p>
      </div>

      <div className="restaurant-hero">
        <img src={restaurant.image} alt="" />
        <HeartButton active={favorites.has(restaurant.id)} onClick={() => toggleFavorite(restaurant.id)} />
      </div>

      <button
        className={`like-restaurant-button ${favorites.has(restaurant.id) ? 'liked' : ''}`}
        type="button"
        onClick={() => toggleFavorite(restaurant.id)}
      >
        <Heart size={18} fill={favorites.has(restaurant.id) ? 'currentColor' : 'none'} />
        {favorites.has(restaurant.id) ? 'Ajouté à vos restaurants likés' : 'Ajouter à mes restaurants likés'}
      </button>

      <section className="restaurant-loyalty-section">
        <h2 style={{ margin: 0 }}>Votre carte Fidelity</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
          Ajout local à Mes cartes, sans compte ni pass Wallet réel.
        </p>
        <LoyaltyCard restaurant={restaurant} compact />
        <button className="outline-button full" type="button" onClick={() => go('card', { restaurantId: restaurant.id })}>
          <CreditCard size={18} /> Voir ma carte
        </button>
      </section>

      <button className="address-card" type="button">
        <span>
          <MapPin size={20} />
        </span>
        <span>
          <strong style={{ fontSize: 14.5 }}>{restaurant.address}</strong>
          <small>Appuyer pour choisir votre application d’itinéraire</small>
        </span>
        <Navigation size={19} fill="currentColor" />
      </button>

      <Tabs values={['Publications', 'Menu', 'Infos & promos']} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'Publications' && (
        <section className="restaurant-tab-content">
          <h2 style={{ margin: 0 }}>Publications</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            Les images du restaurant et les FoodShare qu’il a republiés.
          </p>
          <div className="restaurant-gallery">
            <img src={restaurant.image} alt="" />
            <img src={restaurant.id === 'amina' ? '/images/tacos.webp' : '/images/table.webp'} alt="" />
          </div>
          {restaurantShares.map((share) => (
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
              </div>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'Menu' && (
        <section className="restaurant-tab-content menu-section">
          <h2 style={{ margin: 0 }}>Menu</h2>
          {restaurant.menu.map((item) => (
            <article key={item.name}>
              <div>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
              </div>
              <b>{item.price}</b>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'Infos & promos' && (
        <section className="restaurant-tab-content info-section">
          <h2 style={{ margin: 0 }}>Promotions</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Offres ponctuelles du restaurant — indépendantes de votre carte Fidelity.
          </p>
          {restaurant.offers.length === 0 && (
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              Aucune offre en ce moment — revenez bientôt.
            </p>
          )}
          {restaurant.offers.map((offer) => {
            const OfferIcon = OFFER_ICONS[offer.kind]
            return (
              <article className="offer-card" key={offer.id}>
                <div className="offer-head">
                  <span className={`offer-badge ${offer.kind}`}>
                    <OfferIcon size={12} strokeWidth={2.4} /> {OFFER_LABELS[offer.kind]}
                  </span>
                  {offerIsLive(offer) && <span className="offer-live">En ce moment</span>}
                </div>
                <strong>{offer.title}</strong>
                <p>{offer.detail}</p>
                <small className="offer-schedule">
                  <Clock3 size={13} /> {offer.schedule}
                </small>
              </article>
            )
          })}

          <h2 style={{ margin: '14px 0 0' }}>À propos</h2>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{restaurant.description}</p>
          <div className="hours">
            <Clock3 size={18} />
            <span>
              {restaurant.hours.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
          </div>
          <div className="diet-tags">
            {restaurant.diets.map((diet) => (
              <span key={diet}>{diet}</span>
            ))}
          </div>
          <h2 style={{ margin: '10px 0 0' }}>Avis</h2>
          <div className="rating-line">
            <Star size={18} fill="currentColor" />
            <strong>{restaurant.rating} sur 5</strong>
          </div>
          {restaurantMyReviews.length > 0 && (
            <>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Vos avis — comptabilisés immédiatement.
              </p>
              {restaurantMyReviews.map((review) => (
                <article className="review" key={review.id}>
                  <div>
                    <strong>Vous</strong>
                    <b>{review.rating}</b>
                  </div>
                  <p>{review.text}</p>
                </article>
              ))}
            </>
          )}
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Avis de la communauté.
          </p>
          {restaurant.reviews.map((review) => (
            <article className="review" key={review.author}>
              <div>
                <strong>{review.author}</strong>
                <b>{review.rating}</b>
              </div>
              <p>{review.text}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}

export function CardDetailPage({ go, restaurant }: CommonProps & { restaurant: Restaurant }) {
  const loyalty = restaurant.loyalty
  const tiers = loyalty.tiers?.length ? loyalty.tiers : [{ at: loyalty.target, reward: loyalty.reward }]
  const nextTier = tiers.find((tier) => tier.at > loyalty.current) ?? tiers[tiers.length - 1]
  const remaining = Math.max(0, nextTier.at - loyalty.current)
  const unit = loyalty.type === 'stamps' ? `coche${remaining > 1 ? 's' : ''}` : 'points'
  const unitPlural = loyalty.type === 'stamps' ? 'coches' : 'points'
  // FoodShare réservé aux membres ayant déjà commandé (visite enregistrée ou solde réel)
  const hasOrdered =
    loyalty.current > 0 || userVisits.some((visit) => visit.restaurantId === restaurant.id && visit.count > 0)

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Ma carte</span>
          <h1 style={{ margin: '6px 0 4px' }}>{restaurant.name}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{loyalty.title}</p>
        </div>
      </div>

      <LoyaltyCard restaurant={restaurant} />

      <section className="reward-panel">
        <span>
          <Gift size={20} />
        </span>
        <div>
          <h2>{nextTier.reward}</h2>
          <p>{loyalty.rule}</p>
        </div>
        <strong>
          {remaining === 0 ? 'Palier atteint !' : `${remaining} ${unit} avant le palier`}
        </strong>
      </section>

      <section className="tier-list">
        <h2 style={{ margin: 0 }}>Paliers de récompenses</h2>
        {tiers.map((tier) => {
          const reached = loyalty.current >= tier.at
          const isNext = tier === nextTier && !reached
          return (
            <div className={`tier-row ${reached ? 'reached' : ''} ${isNext ? 'next' : ''}`} key={tier.at}>
              <span className="tier-check">{reached && <Check size={13} strokeWidth={3} />}</span>
              <span className="visit-copy">
                <strong>{tier.reward}</strong>
                <small>
                  {reached ? 'Débloqué — à retirer en caisse' : isNext ? 'Prochain palier' : 'Palier suivant'}
                </small>
              </span>
              <span className="tier-at">
                {tier.at} {loyalty.type === 'stamps' ? (tier.at > 1 ? 'coches' : 'coche') : 'points'}
              </span>
            </div>
          )
        })}
      </section>

      <section className="progress-panel">
        <span>
          <Info size={20} />
        </span>
        <div>
          <p>Progression</p>
          <strong>
            {loyalty.current} sur {loyalty.target} {unitPlural}
          </strong>
        </div>
      </section>

      <section className="reward-panel foodshare-cta">
        <span>
          <Share2 size={20} />
        </span>
        <div>
          <h2>FoodShare</h2>
          <p>
            Vous venez de scanner votre carte ? Laissez un avis étoilé et une photo : la note compte tout de suite,
            la photo part dans le fil si le restaurant la republie.
          </p>
        </div>
      </section>
      <button
        className="outline-button full"
        type="button"
        style={{ marginTop: 14 }}
        disabled={!hasOrdered}
        onClick={() => go('foodshareCompose', { restaurantId: restaurant.id })}
      >
        <Share2 size={18} /> Publier un FoodShare
      </button>
      {!hasOrdered && (
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 13, textAlign: 'center' }}>
          Partage disponible après votre première commande — présentez votre carte en caisse.
        </p>
      )}
    </main>
  )
}
