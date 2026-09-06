import { useEffect, useState } from 'react'
import { CreditCard, Gift, LoaderCircle, Plus, ShoppingBasket, SlidersHorizontal } from 'lucide-react'
import { getRestaurant, historyItems, setHistoryItems } from '../data'
import type { Restaurant } from '../data'
import type { CommonProps } from '../nav'
import { LoyaltyCard, Notice, Tabs } from '../components/kit'
import { AppleWalletButton } from '../components/CardActions'
import { fetchHistory, getBackendState } from '../lib/api'

const KIND_ICONS = {
  gain: Plus,
  spend: SlidersHorizontal,
  adjust: SlidersHorizontal,
  order: ShoppingBasket,
}

export function LoyaltyPage({ go, restaurants, hasCard, cardsLoading, cardsUnavailable, reloadCards }: CommonProps & { restaurants: Restaurant[] }) {
  const [activeTab, setActiveTab] = useState('Mes cartes')
  const [, update] = useState(0)
  useEffect(() => {
    if (!getBackendState().connected || !getBackendState().membershipsReady) return
    let cancelled = false
    const refresh = async () => {
      if (document.hidden) return
      await reloadCards()
      const history = await fetchHistory()
      if (!cancelled) { setHistoryItems(history); update(value => value + 1) }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 15_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])
  const myCards = restaurants.filter((restaurant) => hasCard(restaurant.id))

  return (
    <main className="page page-with-nav">
      <h1 style={{ margin: '0 0 6px' }}>Fidélité</h1>
      <p className="lead" style={{ margin: 0 }}>
        Vos cartes de fidélité et tous vos mouvements, réunis.
      </p>

      <Tabs values={['Mes cartes', 'Historique']} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'Mes cartes' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 18 }}>
          {cardsLoading ? (
            <p className="card-owned" role="status"><LoaderCircle size={18} className="animate-spin" /> Chargement de vos cartes…</p>
          ) : cardsUnavailable ? (
            <div className="empty-state">
              <p>Impossible de charger vos cartes pour le moment.</p>
              <button className="outline-button full" type="button" onClick={() => void reloadCards()}>Réessayer</button>
            </div>
          ) : myCards.length === 0 && (
            <div className="empty-state">
              <CreditCard size={28} />
              <h2>Votre première carte vous attend</h2>
              <p>Choisissez un restaurant et appuyez sur « Ajouter à mes cartes ».</p>
            </div>
          )}
          {myCards.map((restaurant) => (
            <div key={restaurant.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <LoyaltyCard restaurant={restaurant} compact />
              <AppleWalletButton restaurant={restaurant} />
              <button className="outline-button full" type="button" onClick={() => go('card', { restaurantId: restaurant.id })}>
                <Gift size={18} /> Voir la carte {restaurant.name}
              </button>
            </div>
          ))}
          <button className="outline-button full" type="button" onClick={() => go('discovery')}><Plus size={18} /> Découvrir d’autres cartes</button>
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
  if (!item) return <main className="page"><h1>Aucun mouvement</h1><p>Les transactions confirmées apparaîtront ici.</p></main>
  const restaurant = getRestaurant(item.restaurantId)

  return (
    <main className="page">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Historique</span>
          <h1 style={{ margin: '6px 0 4px' }}>{item.title}</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            {item.serverId ? 'Mouvement confirmé dans le registre du restaurant.' : 'Mouvement de démonstration.'}
          </p>
        </div>
      </div>

      <Notice title="Registre de fidélité">
        {item.serverId ? `Référence serveur : ${item.serverId}` : 'Ce mouvement appartient uniquement à la session locale de démonstration.'}
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
          <dd>{item.serverId ? item.source === 'scan' ? 'Scan en caisse' : item.source === 'foodshare' ? 'FoodShare validé' : 'Correction du restaurant' : 'Démonstration'}</dd>
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
