import { useState } from 'react'
import { Gift, Plus, ShoppingBasket, SlidersHorizontal } from 'lucide-react'
import { getRestaurant, historyItems } from '../data'
import type { Restaurant } from '../data'
import type { CommonProps } from '../nav'
import { LoyaltyCard, Notice, Tabs } from '../components/kit'

const KIND_ICONS = {
  gain: Plus,
  spend: SlidersHorizontal,
  adjust: SlidersHorizontal,
  order: ShoppingBasket,
}

export function LoyaltyPage({ go, restaurants }: CommonProps & { restaurants: Restaurant[] }) {
  const [activeTab, setActiveTab] = useState('Mes cartes')
  const myCards = [restaurants[0], restaurants[2]]

  return (
    <main className="page page-with-nav">
      <h1 style={{ margin: '0 0 6px' }}>Fidélité</h1>
      <p className="lead" style={{ margin: 0 }}>
        Vos cartes de fidélité et tous vos mouvements, réunis.
      </p>

      <Tabs values={['Mes cartes', 'Historique']} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'Mes cartes' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 18 }}>
          {myCards.map((restaurant) => (
            <div key={restaurant.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <LoyaltyCard restaurant={restaurant} compact />
              <button className="outline-button full" type="button" onClick={() => go('card', { restaurantId: restaurant.id })}>
                <Gift size={18} /> Voir la carte {restaurant.name}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="history-list">
          {historyItems.map((item) => {
            const restaurant = getRestaurant(item.restaurantId)
            const negative = item.amount.startsWith('-')
            const Icon = KIND_ICONS[item.kind]
            return (
              <button type="button" key={item.id} onClick={() => go('transaction', { transactionId: item.id })}>
                <span className={`h-icon ${negative ? 'negative' : ''}`}>
                  <Icon size={19} />
                </span>
                <span className="h-mid">
                  <strong>
                    {restaurant.name} · {item.title}
                  </strong>
                  <small>{item.date}</small>
                </span>
                <b className={negative ? 'negative' : 'positive'}>{item.amount}</b>
              </button>
            )
          })}
        </div>
      )}
    </main>
  )
}

export function TransactionPage({ go, transactionId }: CommonProps & { transactionId?: number }) {
  const item = historyItems.find((entry) => entry.id === transactionId) || historyItems[0]
  const restaurant = getRestaurant(item.restaurantId)

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Historique</span>
          <h1 style={{ margin: '6px 0 4px' }}>{item.title}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            Mouvement local associé à une commande de démonstration.
          </p>
        </div>
      </div>

      <Notice title="Registre de fidélité">
        Ce mouvement appartient uniquement à la session locale de démonstration.
      </Notice>

      <dl className="transaction-details">
        <div>
          <dt>Restaurant</dt>
          <dd>{restaurant.name}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{item.date}</dd>
        </div>
        <div>
          <dt>Détail</dt>
          <dd>{item.detail}</dd>
        </div>
        <div>
          <dt>Mouvement</dt>
          <dd>{item.amount}</dd>
        </div>
        <div>
          <dt>Origine</dt>
          <dd>Commande locale</dd>
        </div>
        <div>
          <dt>Solde après opération</dt>
          <dd>{item.balance}</dd>
        </div>
      </dl>

      <button className="primary-button full" type="button" onClick={() => go('card', { restaurantId: item.restaurantId })}>
        Voir la carte de fidélité
      </button>
    </main>
  )
}
