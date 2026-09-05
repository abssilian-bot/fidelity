import type { Restaurant, Visit } from '../data'

export const MY_CARDS_KEY = 'fidelity.demo.my-cards.v1'

/** Les cartes déjà utilisées restent détenues, même après avoir dépensé leur solde. */
export function usedCardIds(restaurants: Restaurant[], visits: Visit[]): string[] {
  return [...new Set([
    ...restaurants.filter((restaurant) => restaurant.loyalty.current > 0).map((restaurant) => restaurant.id),
    ...visits.filter((visit) => visit.count > 0).map((visit) => visit.restaurantId),
  ])]
}

export function readMyCards(defaultIds: string[]): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(MY_CARDS_KEY) ?? '[]')
    const ids = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 120) : []
    return new Set([...defaultIds, ...ids])
  } catch {
    return new Set(defaultIds)
  }
}

export function saveMyCards(ids: Set<string>): void {
  // Échouer explicitement si le navigateur ne peut pas conserver l'ajout.
  localStorage.setItem(MY_CARDS_KEY, JSON.stringify([...ids]))
}
