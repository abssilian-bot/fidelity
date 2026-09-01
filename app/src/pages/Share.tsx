import { useState } from 'react'
import { Check, Share2, Star } from 'lucide-react'
import type { Restaurant } from '../data'
import type { CommonProps } from '../nav'

const PHOTO_CHOICES = ['/images/table.webp', '/images/ramen.webp', '/images/tacos.webp']

/** FoodShare côté membre : après un scan gagnant, on laisse un avis étoilé + une photo. */
export function FoodshareComposePage({ goBack, restaurant, notify, publishShare }: CommonProps & { restaurant: Restaurant }) {
  const [rating, setRating] = useState(5)
  const [caption, setCaption] = useState('')
  const [photo, setPhoto] = useState(restaurant.image || PHOTO_CHOICES[0])

  const publish = () => {
    publishShare?.({ restaurantId: restaurant.id, image: photo, caption: caption.trim(), rating })
    notify('Avis publié ! La photo apparaîtra dans le fil dès que le restaurant l’aura republiée.')
    goBack()
  }

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">FoodShare</span>
          <h1 style={{ margin: '6px 0 4px' }}>Partager ma visite</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {restaurant.name} · vos points sont déjà crédités, merci !
          </p>
        </div>
      </div>

      <section className="form-section">
        <label>Votre note</label>
        <div className="star-picker" role="radiogroup" aria-label="Note sur 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={value <= rating ? 'on' : ''}
              onClick={() => setRating(value)}
              aria-label={`${value} étoile${value > 1 ? 's' : ''}`}
            >
              <Star size={30} fill={value <= rating ? 'currentColor' : 'none'} strokeWidth={1.6} />
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          La note compte immédiatement dans les avis du restaurant.
        </p>

        <label>
          Votre commentaire
          <textarea
            rows={3}
            placeholder="Racontez votre visite en une phrase…"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>

        <label>Votre photo</label>
        <div className="photo-picker">
          {PHOTO_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={photo === choice ? 'selected' : ''}
              onClick={() => setPhoto(choice)}
            >
              <img src={choice} alt="" />
              {photo === choice && (
                <span>
                  <Check size={15} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
          La photo et le commentaire sont visibles sur votre profil tout de suite, et dans le fil public après
          validation par le restaurant.
        </p>
      </section>

      <button className="primary-button full" type="button" style={{ marginTop: 18 }} onClick={publish}>
        <Share2 size={18} /> Publier mon FoodShare
      </button>
    </main>
  )
}
