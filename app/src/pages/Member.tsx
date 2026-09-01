import { useState } from 'react'
import { BadgeCheck, ChevronRight, Star, Trash2, UserPlus, UtensilsCrossed } from 'lucide-react'
import { getMember, userReviews, userVisits } from '../data'
import type { Member, UserReview, Visit } from '../data'
import type { CommonProps } from '../nav'
import { Tabs } from '../components/kit'

interface MemberData {
  name: string
  isSelf: boolean
  likedIds: string[]
  visits: Visit[]
  reviews: UserReview[]
}

function useMemberData(memberId: string | undefined, favorites: Set<string>, selfReviews?: UserReview[]): MemberData {
  if (memberId) {
    const member = getMember(memberId)
    return {
      name: member.name,
      isSelf: false,
      likedIds: member.likedRestaurants,
      visits: member.visitList,
      reviews: member.reviewList,
    }
  }
  return {
    name: 'Camille Robert',
    isSelf: true,
    likedIds: [...favorites],
    visits: userVisits,
    reviews: selfReviews ?? userReviews,
  }
}

/** Liste des restaurants likés — par soi ou par un membre. */
export function LikedRestaurantsPage({ go, favorites, toggleFavorite, resolveRestaurant, memberId }: CommonProps & { memberId?: string }) {
  const data = useMemberData(memberId, favorites)
  const liked = data.likedIds.map((id) => resolveRestaurant(id))

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Profil membre</span>
          <h1 style={{ margin: '6px 0 4px' }}>{data.isSelf ? 'Restaurants likés' : `Les tables de ${data.name}`}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {liked.length} restaurant{liked.length > 1 ? 's' : ''} {data.isSelf ? 'dans vos coups de cœur' : 'dans ses coups de cœur'}.
          </p>
        </div>
      </div>

      <div className="saved-restaurants">
        {liked.map((restaurant) => (
          <div key={restaurant.id}>
            <button className="row-main" type="button" onClick={() => go('restaurant', { restaurantId: restaurant.id })}>
              <strong>{restaurant.name}</strong>
              <small>
                {restaurant.cuisine} · {restaurant.district}
              </small>
            </button>
            {data.isSelf && (
              <button className="outline-button" type="button" onClick={() => toggleFavorite(restaurant.id)}>
                <Trash2 size={15} /> Retirer
              </button>
            )}
          </div>
        ))}
        {!liked.length && (
          <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0' }}>
            {data.isSelf
              ? 'Aucun restaurant liké pour le moment — touchez le cœur sur la page d’un restaurant.'
              : `${data.name} n’a pas encore liké de restaurant.`}
          </p>
        )}
      </div>
    </main>
  )
}

/** Liste des restaurants visités, avec le nombre de visites et le plat le plus pris. */
export function VisitsPage({ go, favorites, resolveRestaurant, memberId }: CommonProps & { memberId?: string }) {
  const data = useMemberData(memberId, favorites)
  const total = data.visits.reduce((sum, visit) => sum + visit.count, 0)

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Profil membre</span>
          <h1 style={{ margin: '6px 0 4px' }}>{data.isSelf ? 'Vos visites' : `Les visites de ${data.name}`}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {total} visites au compteur, restaurant par restaurant.
          </p>
        </div>
      </div>

      <div className="visit-list">
        {data.visits.map((visit) => {
          const restaurant = resolveRestaurant(visit.restaurantId)
          return (
            <button
              className="visit-row"
              key={visit.restaurantId}
              type="button"
              onClick={() => go('restaurant', { restaurantId: restaurant.id })}
            >
              <span className="visit-icon">
                <UtensilsCrossed size={18} />
              </span>
              <span className="visit-copy">
                <strong>{restaurant.name}</strong>
                <small>
                  {restaurant.district} · Plat favori : {visit.topDish}
                </small>
              </span>
              <span className="visit-count">
                <strong>{visit.count}</strong>
                <small>visite{visit.count > 1 ? 's' : ''}</small>
              </span>
              <ChevronRight size={17} color="var(--muted-soft)" />
            </button>
          )
        })}
      </div>
    </main>
  )
}

/** Avis déposés — par soi ou par un membre. */
export function MyReviewsPage({ go, favorites, resolveRestaurant, memberId, myReviews }: CommonProps & { memberId?: string }) {
  const data = useMemberData(memberId, favorites, myReviews)

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Profil membre</span>
          <h1 style={{ margin: '6px 0 4px' }}>{data.isSelf ? 'Vos avis' : `Les avis de ${data.name}`}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {data.reviews.length} avis déposé{data.reviews.length > 1 ? 's' : ''} auprès des restaurants.
          </p>
        </div>
      </div>

      <div className="review-list">
        {data.reviews.map((review) => {
          const restaurant = resolveRestaurant(review.restaurantId)
          return (
            <article className="review" key={review.id}>
              <div>
                <button className="review-restaurant" type="button" onClick={() => go('restaurant', { restaurantId: restaurant.id })}>
                  <strong>{restaurant.name}</strong>
                  <ChevronRight size={15} />
                </button>
                <b>
                  <Star size={13} fill="currentColor" /> {review.rating}
                </b>
              </div>
              <p>{review.text}</p>
              <small className="review-date">{review.date}</small>
            </article>
          )
        })}
      </div>
    </main>
  )
}

/** Profil public d'un membre — même présentation que notre propre profil. */
export function MemberProfilePage({ go, memberId }: CommonProps & { memberId?: string }) {
  const member: Member = getMember(memberId || 'camille')
  const [following, setFollowing] = useState(false)
  const [activeTab, setActiveTab] = useState('Publications')

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Profil membre</span>
          <h1 style={{ margin: '6px 0 0' }}>{member.name}</h1>
        </div>
      </div>

      <section className="profile-summary">
        <div className="profile-identity static">
          <span className="profile-avatar">{member.initials}</span>
          <span>
            <strong>
              {member.name}
              {member.id === 'camille' && (
                <BadgeCheck size={16} className="verified" fill="currentColor" stroke="#fbf5ed" />
              )}
            </strong>
            <small>{member.handle}</small>
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{member.bio}</p>

        <button
          className={following ? 'outline-button full' : 'primary-button full'}
          type="button"
          onClick={() => setFollowing(!following)}
        >
          <UserPlus size={18} /> {following ? `Vous suivez ${member.name.split(' ')[0]}` : `Suivre ${member.name.split(' ')[0]}`}
        </button>

        <div className="profile-stats four">
          <span>
            <strong>{member.posts}</strong> publications
          </span>
          <button type="button" onClick={() => go('likedRestaurants', { memberId: member.id })}>
            <strong>{member.liked}</strong> restaurants
          </button>
          <button type="button" onClick={() => go('visits', { memberId: member.id })}>
            <strong>{member.visits}</strong> visites
          </button>
          <button type="button" onClick={() => go('myReviews', { memberId: member.id })}>
            <strong>{member.reviews}</strong> avis
          </button>
        </div>

        <Tabs values={['Publications', 'À propos']} active={activeTab} onChange={setActiveTab} />
        {activeTab === 'Publications' ? (
          <div className="profile-grid">
            {member.photos.map((photo) => (
              <img src={photo} alt="" key={photo} />
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>
            {member.bio} Membre Fidelity actif — {member.visits} visites, {member.reviews} avis déposés et{' '}
            {member.liked} tables en coups de cœur.
          </p>
        )}
      </section>
    </main>
  )
}
