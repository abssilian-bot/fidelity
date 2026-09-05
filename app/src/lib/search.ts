import type { Member, Restaurant } from '../data'
import type { SearchFilters } from '../nav'
import { DIET_FILTERS, FOOD_CATEGORIES, SERVICE_FILTERS, WEEK_DAYS } from './search-catalog.ts'

/** Le nom, le menu et les métadonnées alimentent un seul index, réutilisable sans React. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

const STOP_WORDS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'a', 'au', 'aux', 'et', 'en', 'pour', 'avec', 'restaurant', 'restaurants', 'resto', 'restos', 'cuisine', 'manger'])
const tokensOf = (value: string) => normalizeSearch(value).split(' ').filter(Boolean)
const placeText = (value: string) => {
  const normalized = normalizeSearch(value).replace(/\b(\d{1,2})(?:eme|er|e)\b/g, '$1')
  const district = normalized.match(/\bparis\s+(\d{1,2})\b/)
  return district && Number(district[1]) >= 1 && Number(district[1]) <= 20 ? `${normalized} 750${district[1].padStart(2, '0')}` : normalized
}
const containsPhrase = (text: string, phrase: string) => ` ${text} `.includes(` ${normalizeSearch(phrase)} `)
const CUISINE_SYNONYMS = new Map<string, string[]>()
for (const category of FOOD_CATEGORIES) {
  const words = category.aliases.map(normalizeSearch).filter((alias) => !alias.includes(' '))
  for (const word of words) CUISINE_SYNONYMS.set(word, [...new Set([...(CUISINE_SYNONYMS.get(word) ?? []), ...words])])
}

/** Damerau-Levenshtein : une inversion de lettres compte comme une seule faute. */
export function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
    }
  }
  return rows[a.length][b.length]
}

interface Field { text: string; tokens: string[]; weight: number }
const field = (text: string, weight: number): Field => ({ text: normalizeSearch(text), tokens: tokensOf(text), weight })

function tokenQuality(query: string, word: string): number {
  if (query === word) return 1
  if (query.length >= 2 && !/\d/.test(query) && word.startsWith(query)) return 0.78
  // Aucun rapprochement approximatif des nombres ou des mots très courts.
  if (query.length < 4 || /\d/.test(query) || Math.abs(query.length - word.length) > 2) return 0
  const max = query.length >= 8 ? 2 : 1
  if (Math.abs(query.length - word.length) > max) return 0
  return editDistance(query, word) <= max ? 0.45 : 0
}

function scoreFields(fields: Field[], query: string, expandCuisine: boolean, cache = new Map<string, number>()): number {
  const normalized = normalizeSearch(query)
  const tokens = tokensOf(query).filter((token) => !STOP_WORDS.has(token)).slice(0, 12)
  if (!tokens.length) return 1
  let score = 0
  for (const token of tokens) {
    const aliases = expandCuisine ? CUISINE_SYNONYMS.get(token) ?? [] : []
    let best = 0
    for (const entry of fields) {
      for (const word of entry.tokens) {
        const key = `${token}\0${word}`
        let quality = cache.get(key)
        if (quality === undefined) {
          quality = Math.max(tokenQuality(token, word), aliases.includes(word) ? 0.9 : 0)
          cache.set(key, quality)
        }
        best = Math.max(best, quality * entry.weight)
      }
    }
    if (best === 0) return 0 // Chaque terme doit être satisfait, y compris lorsqu'il est dans un autre champ.
    score += best
  }
  for (const entry of fields) {
    if (entry.text === normalized) score += entry.weight * 2
    else if (entry.text.startsWith(normalized)) score += entry.weight * 0.6
    else if (containsPhrase(entry.text, normalized)) score += entry.weight * 0.3
  }
  return score
}

export function restaurantCategories(restaurant: Restaurant): string[] {
  const text = normalizeSearch([restaurant.cuisine, ...restaurant.menu.map((item) => item.name)].join(' '))
  const categories: string[] = [...new Set([
    ...(restaurant.foodTags ?? []),
    ...FOOD_CATEGORIES.filter((category) => category.aliases.some((alias) => containsPhrase(text, alias))).map((category) => category.id),
  ])]
  if (categories.some((id) => ['japonais', 'sushi', 'ramen'].includes(id))) categories.push('asiatique')
  return [...new Set(categories)]
}

/** Un régime n'est jamais déduit d'un nom de plat ou d'une origine culinaire. */
export function hasDiet(restaurant: Restaurant, diet: string): boolean {
  const declared = restaurant.diets.map(normalizeSearch)
  return declared.includes(normalizeSearch(diet)) || (diet === 'Végétarien' && declared.includes('vegan'))
}

export function distanceKm(value: string): number {
  const match = value.trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(km|m)$/i)
  return match ? Number(match[1]) / (match[2].toLowerCase() === 'm' ? 1000 : 1) : Number.POSITIVE_INFINITY
}

export interface OpeningInterval { open: string; close: string }
export interface OpeningDay { day: number; intervals: OpeningInterval[] }

export function openingHoursOf(restaurant: Restaurant): OpeningDay[] {
  if (restaurant.openingHours) return restaurant.openingHours
  return restaurant.hours.flatMap((line) => {
    const normalized = normalizeSearch(line)
    const days = normalized.startsWith('tous les jours') ? WEEK_DAYS.map((_, day) => day)
      : WEEK_DAYS.flatMap((name, day) => normalized.startsWith(normalizeSearch(name)) ? [day] : [])
    const periods = [...line.matchAll(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/g)].map((match) => ({ open: match[1].padStart(5, '0'), close: match[2].padStart(5, '0') }))
    return days.map((day) => ({ day, intervals: periods }))
  })
}

const minutesOf = (value: string) => {
  const match = value.match(/^(\d{1,2}):([0-5]\d)$/)
  return match && Number(match[1]) < 24 ? Number(match[1]) * 60 + Number(match[2]) : NaN
}

export function parisClock(date = new Date()): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return { day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(value('weekday')), minutes: Number(value('hour')) * 60 + Number(value('minute')) }
}

export function isOpenAt(restaurant: Restaurant, day: number, minutes: number): boolean {
  return openingHoursOf(restaurant).some((schedule) => schedule.intervals.some((period) => {
    const open = minutesOf(period.open), close = minutesOf(period.close)
    if (!Number.isFinite(open) || !Number.isFinite(close)) return false
    if (close > open) return schedule.day === day && minutes >= open && minutes < close
    if (close === open) return false
    return (schedule.day === day && minutes >= open) || ((schedule.day + 1) % 7 === day && minutes < close)
  }))
}

function parseIntent(query: string) {
  let remaining = normalizeSearch(query).slice(0, 160)
  const diets: string[] = [], services: string[] = []
  for (const option of [...DIET_FILTERS, ...SERVICE_FILTERS]) {
    for (const alias of [...option.aliases].sort((a, b) => b.length - a.length)) {
      if (containsPhrase(remaining, alias)) {
        if ('value' in option) diets.push(option.value)
        else services.push(option.id)
        remaining = ` ${remaining} `.replaceAll(` ${normalizeSearch(alias)} `, ' ').trim()
      }
    }
  }
  const openNow = /\bouvert(?:s|e|es)?(?: maintenant)?\b/.test(remaining)
  remaining = remaining.replace(/\bouvert(?:s|e|es)?(?: maintenant)?\b/g, '').trim()
  return { text: remaining, diets, services, openNow }
}

export function defaultSearchFilters(): SearchFilters {
  return { query: '', location: '', times: [], diets: [], categories: [], services: [], distance: 0, guests: 1, maxPrice: 0, sort: 'relevance' }
}

export function activeFilterCount(filters: SearchFilters): number {
  return filters.categories.length + filters.diets.length + filters.services.length + Number(!!filters.location.trim())
    + Number(filters.times.length > 0) + Number(filters.distance > 0) + Number(filters.guests > 1) + Number(filters.maxPrice > 0)
}

export function toggleQuickFilter(filters: SearchFilters, id: string): SearchFilters {
  const diet = DIET_FILTERS.find((option) => option.id === id)
  const service = SERVICE_FILTERS.find((option) => option.id === id)
  const key = diet ? 'diets' : service ? 'services' : 'categories'
  const value = diet?.value ?? id
  return { ...filters, [key]: filters[key].includes(value) ? filters[key].filter((item) => item !== value) : [...filters[key], value] }
}

export interface SearchHit<T> { item: T; score: number }
export function createRestaurantIndex(restaurants: Restaurant[]) {
  return restaurants.map((item) => {
    const categories = restaurantCategories(item)
    const categoryNames = FOOD_CATEGORIES.filter((category) => categories.includes(category.id)).map((category) => category.label).join(' ')
    return {
      item, categories,
      fields: [field(item.name, 12), field(`${item.cuisine} ${categoryNames}`, 8),
        field(item.menu.map((dish) => dish.name).join(' '), 6), field(placeText(`${item.district} ${item.address}`), 5),
        field(item.description, 2), field(item.menu.map((dish) => dish.description).join(' '), 1)],
    }
  })
}

export function searchRestaurants(index: ReturnType<typeof createRestaurantIndex>, filters: SearchFilters, date = new Date()): SearchHit<Restaurant>[] {
  if (filters.query.trim().startsWith('@')) return []
  const intent = parseIntent(filters.query)
  const location = placeText(filters.location)
  const clock = parisClock(date)
  const hits: SearchHit<Restaurant>[] = []
  const matchCache = new Map<string, number>()
  for (const entry of index) {
    const restaurant = entry.item
    if (filters.categories.length && !filters.categories.some((id) => entry.categories.includes(id))) continue
    if (![...filters.diets, ...intent.diets].every((diet) => hasDiet(restaurant, diet))) continue
    if (![...filters.services, ...intent.services].every((service) => restaurant.services?.includes(service))) continue
    if (location && location !== 'paris et alentours' && !tokensOf(location).every((token) => tokensOf(placeText(`${restaurant.district} ${restaurant.address}`)).some((word) => word === token || (!/\d/.test(token) && word.startsWith(token))))) continue
    if (filters.distance && distanceKm(restaurant.distance) > filters.distance) continue
    if (filters.guests > 1 && (!Number.isFinite(restaurant.maxGuests) || restaurant.maxGuests < filters.guests)) continue
    if (filters.maxPrice && (!Number.isFinite(restaurant.avgPrice) || restaurant.avgPrice <= 0 || restaurant.avgPrice > filters.maxPrice)) continue
    if (intent.openNow && !isOpenAt(restaurant, clock.day, clock.minutes)) continue
    if (filters.times.length && !filters.times.some((time) => {
      const match = time.match(/^(\d{1,2}) h(?: (\d{2}))?$/)
      const minutes = time === 'Maintenant' ? clock.minutes : match ? Number(match[1]) * 60 + Number(match[2] ?? 0) : NaN
      return isOpenAt(restaurant, clock.day, minutes)
    })) continue
    const score = scoreFields(entry.fields, intent.text.replace(/\b(\d{1,2})(?:eme|er|e)\b/g, '$1'), true, matchCache)
    if (score > 0) hits.push({ item: restaurant, score })
  }
  const price = (restaurant: Restaurant) => restaurant.avgPrice > 0 ? restaurant.avgPrice : Infinity
  return hits.sort((a, b) => {
    if (filters.sort === 'distance') return distanceKm(a.item.distance) - distanceKm(b.item.distance) || b.score - a.score || a.item.name.localeCompare(b.item.name, 'fr')
    if (filters.sort === 'price') return price(a.item) - price(b.item) || b.score - a.score || a.item.name.localeCompare(b.item.name, 'fr')
    return b.score - a.score || a.item.name.localeCompare(b.item.name, 'fr')
  })
}

export function searchMembers(members: Member[], query: string): SearchHit<Member>[] {
  const handleOnly = query.trim().startsWith('@')
  const text = handleOnly ? normalizeSearch(query.slice(1)).replace(/ /g, '') : query
  if (normalizeSearch(text).length < 2) return []
  return members.map((item) => ({ item, score: scoreFields(handleOnly ? [field(item.handle.replace(/[^\p{L}\d]/gu, ''), 16)] : [field(item.handle, 16), field(item.name, 12)], text, false) }))
    .filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, 'fr'))
}
