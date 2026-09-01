import { useState } from 'react'
import { Clock3, CreditCard, Gift, Heart, Info, MapPin, Navigation, Share2, Star } from 'lucide-react'
import type { Restaurant } from '../data'
import type { CommonProps } from '../nav'
import { HeartButton, LoyaltyCard, Tabs } from '../components/kit'

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

      <Tabs values={['Publications', 'Menu', 'Informations']} active={activeTab} onChange={setActiveTab} />

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

      {activeTab === 'Informations' && (
        <section className="restaurant-tab-content info-section">
          <h2 style={{ margin: 0 }}>À propos</h2>
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
  const remaining = Math.max(0, loyalty.target - loyalty.current)
  const unit = loyalty.type === 'stamps' ? `coche${remaining > 1 ? 's' : ''}` : 'points'

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
          <h2>{loyalty.reward}</h2>
          <p>{loyalty.rule}</p>
        </div>
        <strong>
          {remaining} {unit} avant la récompense
        </strong>
      </section>

      <section className="progress-panel">
        <span>
          <Info size={20} />
        </span>
        <div>
          <p>Progression</p>
          <strong>
            {loyalty.current} sur {loyalty.target} {loyalty.type === 'stamps' ? 'coches' : 'points'}
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
        className="primary-button full"
        type="button"
        style={{ marginTop: 14 }}
        onClick={() => go('foodshareCompose', { restaurantId: restaurant.id })}
      >
        <Share2 size={18} /> Partager ma visite
      </button>
    </main>
  )
}
