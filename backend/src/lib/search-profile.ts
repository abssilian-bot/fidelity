import { z } from 'zod'

export const foodCategoryIds = ['burger', 'pizza', 'sushi', 'ramen', 'brunch', 'tacos', 'kebab', 'grillades', 'italien', 'japonais', 'asiatique', 'indien', 'libanais', 'marocain', 'couscous', 'mexicain', 'francais', 'mediterraneen', 'salades', 'cafe', 'desserts'] as const
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const searchProfileFields = {
  foodTags: z.array(z.enum(foodCategoryIds)).max(8).transform((items) => [...new Set(items)]),
  services: z.array(z.enum(['terrasse', 'emporter', 'livraison'])).max(3).transform((items) => [...new Set(items)]),
  avgPrice: z.number().min(0).max(1000),
  maxGuests: z.number().int().min(0).max(200),
  hours: z.array(z.object({ day: z.enum(['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']), open: time, close: time })
    .refine((period) => period.open !== period.close, 'Les heures d’ouverture et de fermeture doivent être différentes.')).max(14),
}

export function normalizeMemberQuery(query: string): string {
  return query.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}
