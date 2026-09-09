import type { Restaurant, SharedPost, UserReview } from './data'

export type ShareStatus = 'pending' | 'published' | 'rejected'
export type Share = SharedPost & { status: ShareStatus; backendId?: string }

export type RouteName =
  | 'home'
  | 'search'
  | 'time'
  | 'results'
  | 'discovery'
  | 'story'
  | 'restaurant'
  | 'card'
  | 'loyalty'
  | 'transaction'
  | 'settings'
  | 'userProfile'
  | 'loyaltyEditor'
  | 'qrPoster'
  | 'likedRestaurants'
  | 'visits'
  | 'myReviews'
  | 'memberProfile'
  | 'foodshareCompose'
  | 'rolePicker'
  | 'restoDashboard'
  | 'restoScan'
  | 'restoClients'
  | 'restoFacade'
  | 'restoFoodshare'
  | 'restoPlaces'
  | 'restoRegistration'
  | 'adminRestaurants'

export type AppRole = 'member' | 'restaurant'

export interface Route {
  name: RouteName
  restaurantId?: string
  transactionId?: number
  storyIndex?: number
  memberId?: string
}

export type Go = (name: RouteName, params?: Omit<Route, 'name'>) => void

export interface CommonProps {
  go: Go
  goBack: () => void
  favorites: Set<string>
  toggleFavorite: (id: string) => void
  resolveRestaurant: (id: string) => Restaurant
  notify: (message: string) => void
  hasCard: (restaurantId: string) => boolean
  addCard: (restaurantId: string) => Promise<void>
  isAddingCard: (restaurantId: string) => boolean
  cardsLoading: boolean
  cardsUnavailable: boolean
  reloadCards: () => Promise<void>
  syncCards?: (state: import('./lib/api').BackendState) => void
  switchRole?: (role: AppRole) => void
  sharedPosts?: Share[]
  publishShare?: (input: { restaurantId: string; image: string; caption: string; rating: number }) => Promise<boolean> | void
  decideShare?: (id: number, publish: boolean, rewardDelta?: number) => Promise<boolean>
  myReviews?: UserReview[]
}

export interface SearchFilters {
  query: string
  location: string
  /** Créneaux horaires choisis — multi-sélection. Vide = peu importe. */
  times: string[]
  diets: string[]
  categories: string[]
  services: string[]
  distance: number
  /** Nombre de personnes à table. */
  guests: number
  /** Prix moyen maximum par personne, en euros. 0 = peu importe. */
  maxPrice: number
  sort: 'relevance' | 'distance' | 'price'
}
