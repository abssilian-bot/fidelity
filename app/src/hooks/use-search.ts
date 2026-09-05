import { useEffect, useMemo, useState } from 'react'
import type { Restaurant } from '../data'
import type { SearchFilters } from '../nav'
import { createRestaurantIndex, searchRestaurants } from '../lib/search'

/** Un seul index par jeu de données ; les horaires sont réévalués chaque minute. */
export function useRestaurantSearch(restaurants: Restaurant[], filters: SearchFilters) {
  const index = useMemo(() => createRestaurantIndex(restaurants), [restaurants])
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return useMemo(() => searchRestaurants(index, filters, now).map((hit) => hit.item), [index, filters, now])
}
