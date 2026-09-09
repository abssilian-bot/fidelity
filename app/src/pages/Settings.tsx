import { useState } from 'react'
import { ChevronRight, Database, ShieldCheck, Star, Store, Trash2 } from 'lucide-react'
import { getMember, userReviews, userVisits } from '../data'
import type { CommonProps } from '../nav'
import { Tabs } from '../components/kit'
import { AccountSection } from '../components/AccountSection'
import { ProfileStats } from '../components/ProfileStats'
import { getAccount } from '../lib/api'

function UserProfileSummary({ onOpen, liked = 3, visits = 15, reviews = 2, onOpenLiked, onOpenVisits, onOpenReviews }: {
  onOpen?: () => void
  liked?: number
  visits?: number
  reviews?: number
  onOpenLiked?: () => void
  onOpenVisits?: () => void
  onOpenReviews?: () => void
}) {
  const [tab, setTab] = useState('Publications')
  const Identity = onOpen ? 'button' : 'div'
  return (
    <section className="profile-summary">
      <h2 style={{ margin: 0 }}>Profil utilisateur</h2>
      <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
        Ce que les autres membres voient lorsqu’ils ouvrent votre profil.
      </p>
      <Identity className="profile-identity" onClick={onOpen}>
        <span className="profile-avatar">CR</span>
        <span>
          <strong>Camille Robert</strong>
          <small>@camilleatable</small>
          <em>Camille · Robert</em>
        </span>
      </Identity>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>
        Toujours partante pour une grande tablée, un bouillon réconfortant et les adresses qui prennent soin des
        végétariens.
      </p>
      <ProfileStats stats={[
        { label: 'publications', value: 3 },
        { label: 'abonnés', value: getMember('camille')?.followers ?? 0 },
        { label: 'abonnements', value: getMember('camille')?.following ?? 0 },
        { label: 'restaurants', value: liked, onClick: onOpenLiked },
        { label: 'visites', value: visits, onClick: onOpenVisits },
        { label: 'avis', value: reviews, onClick: onOpenReviews },
      ]} />
      <Tabs values={['Publications', 'À propos']} active={tab} onChange={setTab} />
      {tab === 'Publications' ? <div className="profile-grid">
        <img src="/images/table.webp" alt="" />
        <img src="/images/ramen.webp" alt="" />
        <img src="/images/tacos.webp" alt="" />
      </div> : <p className="muted">Cuisine végétarienne, tables conviviales et bonnes adresses parisiennes. Profil de démonstration.</p>}
    </section>
  )
}

export function SettingsPage({ go, favorites, toggleFavorite, resolveRestaurant, switchRole, myReviews = userReviews }: CommonProps) {
  const savedRestaurants = [...favorites].map((id) => resolveRestaurant(id))
  const totalVisits = userVisits.reduce((sum, visit) => sum + visit.count, 0)

  return (
    <main className="page page-with-nav">
      <h1 style={{ margin: '0 0 6px' }}>Réglages</h1>
      <p className="lead" style={{ margin: 0 }}>
        Votre profil membre, vos restaurants likés et les préférences de l’application.
      </p>

      <AccountSection />
      {getAccount()?.user.role === 'ADMIN' && <button className="settings-row" type="button" onClick={() => go('adminRestaurants')}><ShieldCheck size={20} /><span><strong>Valider les restaurants</strong><small>Examiner les dossiers d’inscription</small></span></button>}

      {!getAccount() && <UserProfileSummary
        onOpen={() => go('userProfile')}
        liked={favorites.size}
        visits={totalVisits}
        reviews={myReviews.length}
        onOpenLiked={() => go('likedRestaurants')}
        onOpenVisits={() => go('visits')}
        onOpenReviews={() => go('myReviews')}
      />}

      <section style={{ marginTop: 26 }}>
        <h2 style={{ margin: '0 0 4px' }}>Restaurants likés</h2>
        <p className="muted" style={{ margin: '0 0 4px', fontSize: 13 }}>
          Les restaurants que vous avez enregistrés sur cet appareil.
        </p>
        <div className="saved-restaurants">
          {savedRestaurants.map((saved) => (
            <div key={saved.id}>
              <button className="row-main" type="button" onClick={() => go('restaurant', { restaurantId: saved.id })}>
                <strong>{saved.name}</strong>
                <small>
                  {saved.cuisine} · {saved.district}
                </small>
              </button>
              <button className="outline-button" type="button" onClick={() => toggleFavorite(saved.id)}>
                <Trash2 size={15} /> Retirer
              </button>
            </div>
          ))}
          {!savedRestaurants.length && (
            <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0' }}>
              Aucun restaurant enregistré pour le moment — touchez le cœur sur la page d’un restaurant.
            </p>
          )}
        </div>
      </section>

      <button className="settings-row" type="button" onClick={() => go('discovery')}><span><ChevronRight size={18} /></span><span><strong>Préférences de découverte</strong><small>Choisir une distance, une cuisine ou un régime.</small></span></button>

      <section style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Espace restaurateur</h2>
        <button className="settings-row" type="button" onClick={() => switchRole?.('restaurant')}>
          <span>
            <Store size={18} />
          </span>
          <span>
            <strong style={{ fontSize: 14.5 }}>Mon espace restaurateur</strong>
            <small>Me connecter, inscrire ou gérer mon restaurant.</small>
          </span>
          <ChevronRight size={18} color="var(--muted-soft)" />
        </button>
      </section>

      <section style={{ marginTop: 26 }}>
        <h2 style={{ margin: '0 0 10px' }}>Données locales</h2>
        <button className="outline-button full" type="button" onClick={() => window.location.reload()}>
          <Database size={17} /> Actualiser les données
        </button>
      </section>
    </main>
  )
}

export function UserProfilePage({ go, favorites, toggleFavorite, resolveRestaurant, sharedPosts = [], myReviews = userReviews }: CommonProps) {
  const liked = [...favorites].map((id) => resolveRestaurant(id))
  const totalVisits = userVisits.reduce((sum, visit) => sum + visit.count, 0)
  const myShares = sharedPosts.filter((share) => share.author === 'Camille Robert')

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Profil membre</span>
          <h1 style={{ margin: '6px 0 0' }}>Camille Robert</h1>
        </div>
      </div>
      <UserProfileSummary
        liked={favorites.size}
        visits={totalVisits}
        reviews={myReviews.length}
        onOpenLiked={() => go('likedRestaurants')}
        onOpenVisits={() => go('visits')}
        onOpenReviews={() => go('myReviews')}
      />
      {myShares.length > 0 && (
        <section style={{ marginTop: 26 }}>
          <h2 style={{ margin: '0 0 4px' }}>Mes partages FoodShare</h2>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
            Visibles ici immédiatement — dans le fil public après validation du restaurant.
          </p>
          <div className="dashboard-list">
            {myShares.map((share) => {
              const restaurant = resolveRestaurant(share.restaurantId)
              return (
                <article className="share-card" key={share.id}>
                  <img className="share-photo" src={share.image} alt="" />
                  <div className="share-body">
                    <div className="share-head">
                      <span className="visit-copy">
                        <strong>{restaurant.name}</strong>
                        <small className="share-stars">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star key={index} size={12} fill={index < share.rating ? 'currentColor' : 'none'} strokeWidth={1.8} />
                          ))}
                        </small>
                      </span>
                      <span className={`share-badge ${share.status}`}>
                        {share.status === 'pending' ? 'En attente' : share.status === 'published' ? 'En ligne' : 'Non retenu'}
                      </span>
                    </div>
                    {share.caption && <p className="share-caption">{share.caption}</p>}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
      <section style={{ marginTop: 26 }}>
        <h2 style={{ margin: '0 0 10px' }}>Restaurants likés</h2>
        <div className="saved-restaurants">
          {liked.map((restaurant) => (
            <div key={restaurant.id}>
              <button className="row-main" type="button" onClick={() => go('restaurant', { restaurantId: restaurant.id })}>
                <strong>{restaurant.name}</strong>
                <small>
                  {restaurant.cuisine} · {restaurant.district}
                </small>
              </button>
              <button className="outline-button" type="button" onClick={() => toggleFavorite(restaurant.id)}>
                <Trash2 size={15} /> Retirer
              </button>
            </div>
          ))}
          {!liked.length && (
            <p className="muted" style={{ fontSize: 13.5, margin: '6px 0 0' }}>
              Aucun restaurant liké pour le moment.
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
