import { useState } from 'react'
import { Check, LoaderCircle, Plus, Wallet } from 'lucide-react'
import type { CommonProps } from '../nav'
import type { Restaurant } from '../data'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog'

/** Point d'entrée Wallet, en attente de l'activation du service Apple après le front. */
export function AppleWalletButton({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="wallet-button full" type="button">
          <Wallet size={23} aria-hidden="true" />
          <span>Ajouter à Apple Wallet<small>Bientôt disponible</small></span>
        </button>
      </DialogTrigger>
      <DialogContent className="wallet-dialog" showCloseButton={false}>
        <span className="wallet-dialog-icon"><Wallet size={30} aria-hidden="true" /></span>
        <DialogTitle>Votre carte dans Apple Wallet</DialogTitle>
        <DialogDescription>
          L’ajout à Apple Wallet sera bientôt disponible. Votre carte {restaurant.name} est déjà enregistrée dans « Mes cartes » et reste accessible dans Fidelity.
        </DialogDescription>
        <DialogClose asChild><button className="primary-button full" type="button">Compris</button></DialogClose>
      </DialogContent>
    </Dialog>
  )
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
