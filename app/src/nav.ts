import type { Restaurant, SharedPost, UserReview } from './data'

export type ShareStatus = 'pending' | 'published' | 'rejected'
export type Share = SharedPost & { status: ShareStatus }

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
  | 'restoClients'
  | 'restoFacade'
  | 'restoFoodshare'
  | 'restoPlaces'

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
  switchRole?: (role: AppRole) => void
  sharedPosts?: Share[]
  publishShare?: (input: { restaurantId: string; image: string; caption: string; rating: number }) => void
  decideShare?: (id: number, publish: boolean) => void
  myReviews?: UserReview[]
}

export interface SearchFilters {
  query: string
  location: string
  time: string
  diets: string[]
  distance: number
}
