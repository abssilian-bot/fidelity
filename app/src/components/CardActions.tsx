import { useEffect, useState } from 'react'
import { Check, LoaderCircle, Plus, Wallet } from 'lucide-react'
import type { CommonProps } from '../nav'
import type { Restaurant } from '../data'
import { fetchWalletStatus, requestWalletDownload } from '../lib/api'

export function AppleWalletButton({ restaurant }: { restaurant: Restaurant }) {
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let cancelled = false; void fetchWalletStatus().then(value => { if (!cancelled) setAvailable(value) }); return () => { cancelled = true } }, [])
  async function download() {
    if (busy) return
    setBusy(true); setError('')
    try { window.location.assign(await requestWalletDownload(restaurant.id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’ouvrir Apple Wallet. Réessaie.') }
    finally { setBusy(false) }
  }
  if (!available) return <p className="card-action-hint">Votre carte et son QR sont disponibles dans Fidelity. L’export Apple Wallet n’est pas activé sur ce serveur.</p>
  return <>
    <button className="wallet-button full" type="button" disabled={busy} onClick={() => void download()}>
      {busy ? <LoaderCircle className="animate-spin" size={23} aria-hidden="true" /> : <Wallet size={23} aria-hidden="true" />}
      <span>{busy ? 'Préparation de la carte…' : 'Ajouter à Apple Wallet'}<small>Le solde se met à jour après chaque visite</small></span>
    </button>
    {error && <p className="card-action-error" role="alert">{error}</p>}
  </>
}

export function CardActions({ restaurant, hasCard, addCard, isAddingCard, cardsLoading }: Pick<CommonProps, 'hasCard' | 'addCard' | 'isAddingCard' | 'cardsLoading'> & { restaurant: Restaurant }) {
  const [error, setError] = useState('')
  const owned = hasCard(restaurant.id)
  const pending = isAddingCard(restaurant.id)

  async function add() {
    setError('')
    try {
      await addCard(restaurant.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible d’ajouter cette carte. Réessayez.')
    }
  }

  return (
    <div className="card-actions">
      {owned ? (
        <>
          <p className="card-owned"><Check size={16} aria-hidden="true" /> Dans mes cartes</p>
          <AppleWalletButton restaurant={restaurant} />
        </>
      ) : (
        <>
          <button className="primary-button full" type="button" disabled={pending || cardsLoading || restaurant.loyaltyAvailable === false} onClick={() => void add()}>
            {pending || cardsLoading ? <LoaderCircle className="animate-spin" size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
            {cardsLoading ? 'Chargement de mes cartes…' : pending ? 'Ajout en cours…' : restaurant.loyaltyAvailable === false ? 'Programme indisponible' : 'Ajouter à mes cartes'}
          </button>
          <p className="card-action-hint">Retrouvez votre carte ici à chaque visite.</p>
        </>
      )}
      {error && <p className="card-action-error" role="alert">{error}</p>}
    </div>
  )
}
