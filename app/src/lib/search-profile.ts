import { z } from 'zod'
import { FOOD_CATEGORIES, SERVICE_FILTERS } from './search-catalog.ts'
import type { Restaurant } from '../data'
import { openingHoursOf, restaurantCategories } from './search.ts'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const searchProfileSchema = z.object({
  foodTags: z.array(z.string().refine((id) => FOOD_CATEGORIES.some((item) => item.id === id))).max(8),
  services: z.array(z.string().refine((id) => SERVICE_FILTERS.some((item) => item.id === id))).max(3),
  avgPrice: z.number().min(0).max(1000),
  maxGuests: z.number().int().min(0).max(200),
  diets: z.array(z.string().refine((value) => ['Halal', 'Végétarien', 'Végan', 'Sans gluten'].includes(value))).max(4),
  openingHours: z.array(z.object({ day: z.number().int().min(0).max(6), intervals: z.array(z.object({ open: time, close: time })
    .refine((period) => period.open !== period.close, 'Les heures d’ouverture et de fermeture doivent être différentes.')).max(2) })).max(7),
})
export type SearchProfile = z.infer<typeof searchProfileSchema>
const STORAGE_KEY = 'fidelity.search-profiles.v1'

export function searchProfileOf(restaurant: Restaurant): SearchProfile {
  return { foodTags: restaurantCategories(restaurant).slice(0, 8), services: restaurant.services ?? [], avgPrice: restaurant.avgPrice,
    maxGuests: restaurant.maxGuests, diets: restaurant.diets, openingHours: openingHoursOf(restaurant) }
}

export function readSearchProfiles(): Record<string, SearchProfile> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    const parsed = z.record(z.string(), searchProfileSchema).safeParse(value)
    return parsed.success ? parsed.data : {}
  } catch { return {} }
}

export function saveSearchProfiles(profiles: Record<string, SearchProfile>): boolean {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles)); return true } catch { return false }
}
