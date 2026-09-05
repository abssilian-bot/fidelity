import { extraDemoRestaurants } from './demo-restaurants.ts'

export type LoyaltyStyle = 'braise' | 'creme' | 'encre'
export type LoyaltyType = 'stamps' | 'points'

/** Un palier de récompense : à « at » coches/points, le client débloque « reward ». */
export interface RewardTier {
  at: number
  reward: string
}

export interface Loyalty {
  type: LoyaltyType
  title: string
  current: number
  /** Dernier palier (dérivé de `tiers`). */
  target: number
  /** Récompense du dernier palier (dérivée de `tiers`). */
  reward: string
  /** Règle de gain lisible, dérivée des réglages ci-dessous. */
  rule: string
  /** Programme à points : combien de points par euro dépensé. */
  pointsPerEuro?: number
  /** Programme à coches : 1 coche tous les X € dépensés. 0 ou absent = une coche par visite. */
  eurosPerStamp?: number
  /** Paliers de récompenses, triés par seuil croissant. */
  tiers: RewardTier[]
  style: LoyaltyStyle
}

/** Génère la règle de gain lisible à partir des réglages. */
export function loyaltyRule(loyalty: Pick<Loyalty, 'type' | 'pointsPerEuro' | 'eurosPerStamp'>): string {
  if (loyalty.type === 'points') return `${loyalty.pointsPerEuro ?? 10} points par euro dépensé.`
  return loyalty.eurosPerStamp
    ? `Une coche tous les ${loyalty.eurosPerStamp} € dépensés.`
    : 'Une coche par visite, hors boissons.'
}

export interface MenuItem {
  name: string
  description: string
  price: string
}

export interface Review {
  author: string
  rating: string
  text: string
}

export interface Offer {
  id: number
  /** happyhour = happy hour, duo = 1 acheté = 1 offert, discount = promo, special = offre du moment */
  kind: 'happyhour' | 'duo' | 'discount' | 'special'
  title: string
  detail: string
  /** Affichage brut, ex. « Lun–Ven · 17h–19h » */
  schedule: string
  /** Badge « En ce moment » : jours (0 = dimanche) + plage horaire. Optionnel. */
  days?: number[]
  startHour?: number
  endHour?: number
}

export interface Restaurant {
  id: string
  name: string
  cuisine: string
  /** Spécialités et services déclarés dans la Façade. */
  foodTags?: string[]
  services?: string[]
  openingHours?: Array<{ day: number; intervals: Array<{ open: string; close: string }> }>
  district: string
  distance: string
  rating: string
  image: string
  address: string
  description: string
  hours: string[]
  diets: string[]
  open: boolean
  /** Prix moyen d'un repas par personne, en euros. */
  avgPrice: number
  /** Taille maximale de table acceptée. */
  maxGuests: number
  loyalty: Loyalty
  /** False lorsqu'aucun programme actif n'est publié par le restaurant. */
  loyaltyAvailable?: boolean
  menu: MenuItem[]
  reviews: Review[]
  /** Offres ponctuelles (happy hour, 1+1…) — DISTINCTES du programme de fidélité. */
  offers: Offer[]
}

export interface FeedPost {
  id: number
  restaurantId: string
  author: string
  handle?: string
  verified: boolean
  image: string
  likes: number
  text: string
  time: string
}

export interface Story {
  author: string
  meta: string
  image: string
  caption: string
  restaurantId?: string
  memberId?: string
}

export interface HistoryItem {
  id: number
  restaurantId: string
  title: string
  date: string
  detail: string
  amount: string
  balance: string
  kind: 'gain' | 'spend' | 'adjust' | 'order'
}

export const restaurants: Restaurant[] = [
  {
    id: 'amina',
    name: 'Chez Amina',
    cuisine: 'Cuisine marocaine',
    district: 'Paris 11e',
    distance: '800 m',
    rating: '4,9',
    image: '/images/table.webp',
    address: '18 rue des Trois-Bornes, Paris 11e',
    description: 'Une table de quartier chaleureuse pour les tajines, couscous et légumes aux épices douces.',
    hours: ['Vendredi · 11:30–23:00', 'Samedi · 12:00–23:30'],
    diets: ['Halal', 'Végétarien'],
    open: true,
    avgPrice: 19,
    maxGuests: 6,
    loyalty: {
      type: 'stamps',
      title: 'Les saveurs d’Amina',
      current: 9,
      target: 10,
      reward: 'Un plat signature offert',
      rule: 'Une coche par visite, hors boissons.',
      eurosPerStamp: 0,
      tiers: [
        { at: 4, reward: 'Des carottes à la chermoula offertes' },
        { at: 7, reward: 'Un dessert offert' },
        { at: 10, reward: 'Un plat signature offert' },
      ],
      style: 'braise',
    },
    menu: [
      { name: 'Couscous du vendredi', description: 'Semoule fine, légumes confits et poulet aux épices douces.', price: '18,50 €' },
      { name: 'Tajine citron', description: 'Poulet fermier, citron confit et olives violettes.', price: '19,50 €' },
      { name: 'Carottes à la chermoula', description: 'Entrée fraîche aux herbes, cumin et agrumes.', price: '7,50 €' },
    ],
    reviews: [
      { author: 'Sarah L.', rating: '5/5', text: 'Une cuisine généreuse et un accueil qui donne envie de revenir.' },
      { author: 'Mehdi B.', rating: '5/5', text: 'Le couscous du vendredi est devenu un rituel. Carte de fidélité très simple à utiliser.' },
    ],
    offers: [
      {
        id: 1,
        kind: 'happyhour',
        title: 'Thé & douceurs à −30 %',
        detail: 'Thé à la menthe et cornes de gazelle, en salle uniquement.',
        schedule: 'Lun–Ven · 15h–18h',
        days: [1, 2, 3, 4, 5],
        startHour: 15,
        endHour: 18,
      },
      {
        id: 2,
        kind: 'duo',
        title: '1 couscous acheté = 1 dessert offert',
        detail: 'Tous les vendredis soir, sur présentation de votre carte Fidelity.',
        schedule: 'Ven · 19h–23h',
        days: [5],
        startHour: 19,
        endHour: 23,
      },
    ],
  },
  {
    id: 'casa',
    name: 'Casa Verde',
    cuisine: 'Cuisine mexicaine',
    district: 'Paris 11e',
    distance: '1,1 km',
    rating: '4,6',
    image: '/images/tacos.webp',
    address: '22 rue Oberkampf, Paris 11e',
    description: 'Tortillas pressées chaque matin, légumes rôtis, salsa verde et citron frais.',
    hours: ['Vendredi · 12:00–23:00', 'Samedi · 12:00–00:00'],
    diets: ['Végétarien', 'Végan'],
    open: true,
    avgPrice: 14,
    maxGuests: 4,
    loyalty: {
      type: 'stamps',
      title: 'La mesa verde',
      current: 6,
      target: 8,
      reward: 'Un dessert maison offert',
      rule: 'Une coche par passage.',
      eurosPerStamp: 0,
      tiers: [
        { at: 4, reward: 'Une boisson offerte' },
        { at: 8, reward: 'Un dessert maison offert' },
      ],
      style: 'braise',
    },
    menu: [
      { name: 'Tacos de légumes rôtis', description: 'Salsa verde, avocat et citron vert.', price: '14,00 €' },
      { name: 'Quesadilla maison', description: 'Fromage fumé, haricots noirs et coriandre.', price: '13,50 €' },
    ],
    reviews: [
      { author: 'Léa P.', rating: '4/5', text: 'Salsa verde excellente, salle un peu bruyante le samedi.' },
    ],
    offers: [
      {
        id: 1,
        kind: 'happyhour',
        title: 'Happy hour tacos',
        detail: 'Le taco du jour à 9 € au lieu de 14 €, au comptoir.',
        schedule: 'Mar–Jeu · 17h–19h',
        days: [2, 3, 4],
        startHour: 17,
        endHour: 19,
      },
      {
        id: 2,
        kind: 'duo',
        title: '1 quesadilla achetée = 1 offerte',
        detail: 'Tous les mardis, à table ou à emporter.',
        schedule: 'Mardi · toute la journée',
        days: [2],
      },
    ],
  },
  {
    id: 'miso',
    name: 'Atelier Miso',
    cuisine: 'Cuisine japonaise',
    district: 'Paris 10e',
    distance: '1,4 km',
    rating: '4,8',
    image: '/images/ramen.webp',
    address: '7 passage du Marché, Paris 10e',
    description: 'Ramen, bols et petites assiettes japonaises cuisinés dans un atelier calme et végétal.',
    hours: ['Vendredi · 18:00–23:00', 'Samedi · 12:00–23:00'],
    diets: ['Végétarien', 'Végan', 'Sans gluten'],
    open: false,
    avgPrice: 18,
    maxGuests: 4,
    loyalty: {
      type: 'points',
      title: 'Le cercle Miso',
      current: 740,
      target: 800,
      reward: 'Un menu midi offert',
      rule: 'Dix points par euro dépensé.',
      pointsPerEuro: 10,
      tiers: [
        { at: 200, reward: 'Des gyozas de saison offerts' },
        { at: 400, reward: 'Un donburi aubergine offert' },
        { at: 800, reward: 'Un menu midi offert' },
      ],
      style: 'braise',
    },
    menu: [
      { name: 'Ramen miso blanc', description: 'Bouillon végétal, nouilles, shiitakés et œuf mariné.', price: '17,90 €' },
      { name: 'Donburi aubergine', description: 'Riz vinaigré, aubergine laquée et pickles maison.', price: '16,50 €' },
      { name: 'Gyozas de saison', description: 'Légumes, ponzu et huile de sésame.', price: '8,50 €' },
    ],
    reviews: [
      { author: 'Eliott M.', rating: '5/5', text: 'Un bouillon végétal délicat et les options végétales sont très claires.' },
    ],
    offers: [
      {
        id: 1,
        kind: 'discount',
        title: 'Menu midi à −20 %',
        detail: 'Sur la formule du midi, en semaine, dans la limite des places de l’atelier.',
        schedule: 'Lun–Ven · 12h–14h',
        days: [1, 2, 3, 4, 5],
        startHour: 12,
        endHour: 14,
      },
    ],
  },
  {
    id: 'comptoir',
    name: 'Le Comptoir Solaire',
    cuisine: 'Brunch méditerranéen',
    district: 'Paris 2e',
    distance: '2 km',
    rating: '4,7',
    image: '/images/table.webp',
    address: '8 rue du Nil, Paris 2e',
    description: 'Assiettes de saison, café de spécialité et grandes tablées.',
    hours: ['Tous les jours · 09:00–18:00'],
    diets: ['Végétarien'],
    open: true,
    avgPrice: 16,
    maxGuests: 8,
    loyalty: {
      type: 'points',
      title: 'Les matins solaires',
      current: 320,
      target: 500,
      reward: 'Un brunch offert',
      rule: 'Cinq points par euro dépensé.',
      pointsPerEuro: 5,
      tiers: [
        { at: 150, reward: 'Un granola maison offert' },
        { at: 300, reward: 'Un café de spécialité offert' },
        { at: 500, reward: 'Un brunch offert' },
      ],
      style: 'creme',
    },
    menu: [
      { name: 'Assiette solaire', description: 'Œufs, légumes rôtis et labneh.', price: '17,00 €' },
      { name: 'Granola maison', description: 'Yaourt, fruits de saison et miel.', price: '9,50 €' },
    ],
    reviews: [],
    offers: [
      {
        id: 1,
        kind: 'discount',
        title: 'Grandes tablées : −15 % dès 6 personnes',
        detail: 'Sur l’ensemble des assiettes, le week-end, pour les tables de 6 et plus.',
        schedule: 'Sam–Dim · 10h–15h',
        days: [0, 6],
        startHour: 10,
        endHour: 15,
      },
    ],
  },
  {
    id: 'rizrouge',
    name: 'Riz Rouge',
    cuisine: 'Cuisine vietnamienne',
    district: 'Paris 10e',
    distance: '2,8 km',
    rating: '4,4',
    image: '/images/ramen.webp',
    address: '14 rue du Faubourg, Paris 10e',
    description: 'Bols parfumés, herbes fraîches et assiettes à partager dans une salle lumineuse.',
    hours: ['Vendredi · 12:00–22:30', 'Samedi · 12:00–23:00'],
    diets: ['Végétarien', 'Sans gluten'],
    open: false,
    avgPrice: 15,
    maxGuests: 6,
    loyalty: {
      type: 'points',
      title: 'Le carnet rouge',
      current: 410,
      target: 1000,
      reward: 'Un grand bol au choix offert',
      rule: 'Dix points par euro dépensé.',
      pointsPerEuro: 10,
      tiers: [
        { at: 250, reward: 'Un dessert offert' },
        { at: 500, reward: 'Un bò bún maison offert' },
        { at: 1000, reward: 'Un grand bol au choix offert' },
      ],
      style: 'braise',
    },
    menu: [
      { name: 'Riz rouge tofu tamarin', description: 'Pickles minute et beaucoup d’herbes croquantes.', price: '14,90 €' },
      { name: 'Bò bún maison', description: 'Bœuf mariné, vermicelles et cacahuètes.', price: '15,50 €' },
    ],
    reviews: [],
    offers: [
      {
        id: 1,
        kind: 'special',
        title: 'Bò bún du marché à 12 €',
        detail: 'Tous les midis, jusqu’à épuisement du plat du marché.',
        schedule: 'Lun–Sam · 12h–14h30',
        days: [1, 2, 3, 4, 5, 6],
        startHour: 12,
        endHour: 14.5,
      },
    ],
  },
  {
    id: 'braise',
    name: 'Braise & Basilic',
    cuisine: 'Cuisine au feu',
    district: 'Paris 3e',
    distance: '1,7 km',
    rating: '4,5',
    image: '/images/tacos.webp',
    address: '5 rue de Bretagne, Paris 3e',
    description: 'Cuissons au feu, légumes de saison et grandes assiettes méditerranéennes.',
    hours: ['Vendredi · 12:00–23:00', 'Samedi · 12:00–23:30'],
    diets: ['Halal', 'Végétarien'],
    open: true,
    avgPrice: 21,
    maxGuests: 6,
    loyalty: {
      type: 'stamps',
      title: 'Les braises fidèles',
      current: 3,
      target: 6,
      reward: 'Une assiette braisée offerte',
      rule: 'Une coche par passage.',
      eurosPerStamp: 0,
      tiers: [
        { at: 3, reward: 'Une boisson offerte' },
        { at: 6, reward: 'Une assiette braisée offerte' },
      ],
      style: 'encre',
    },
    menu: [
      { name: 'Poulet braisé', description: 'Basilic frais, citron confit et jus réduit.', price: '19,00 €' },
      { name: 'Aubergine braisée', description: 'Yaourt citronné, herbes et noisettes.', price: '15,00 €' },
    ],
    reviews: [],
    offers: [
      {
        id: 1,
        kind: 'happyhour',
        title: 'Happy hour au feu',
        detail: 'Planches braisées à −25 % en début de soirée, au comptoir.',
        schedule: 'Mer–Sam · 18h–20h',
        days: [3, 4, 5, 6],
        startHour: 18,
        endHour: 20,
      },
    ],
  },
  ...extraDemoRestaurants,
]

export const feedPosts: FeedPost[] = [
  {
    id: 1,
    restaurantId: 'casa',
    author: 'Casa Verde',
    verified: true,
    image: '/images/tacos.webp',
    likes: 285,
    text: 'Les tortillas sont pressées chaque matin. Aujourd’hui : légumes rôtis, salsa verde et citron frais.',
    time: 'Il y a 18 min',
  },
  {
    id: 2,
    restaurantId: 'amina',
    author: 'Camille R.',
    handle: '@camilleatable · Chez Amina',
    verified: false,
    image: '/images/table.webp',
    likes: 126,
    text: 'Le couscous du vendredi qui met tout le monde d’accord. J’ai aussi avancé ma carte fidélité.',
    time: 'Il y a 1 h',
  },
  {
    id: 3,
    restaurantId: 'miso',
    author: 'Atelier Miso',
    verified: true,
    image: '/images/ramen.webp',
    likes: 173,
    text: 'Un bouillon végétal précis et généreux, servi ce soir à l’atelier.',
    time: 'Il y a 2 h',
  },
  {
    id: 4,
    restaurantId: 'rizrouge',
    author: 'Riz Rouge',
    verified: true,
    image: '/images/ramen.webp',
    likes: 217,
    text: 'Riz rouge, tofu tamarin, pickles minute et beaucoup d’herbes croquantes.',
    time: 'Il y a 2 j',
  },
  {
    id: 5,
    restaurantId: 'braise',
    author: 'Braise & Basilic',
    verified: true,
    image: '/images/tacos.webp',
    likes: 98,
    text: 'Le poulet braisé sort du feu avec basilic frais, citron confit et jus réduit.',
    time: 'Hier',
  },
]

export const stories: Story[] = [
  { author: 'Casa Verde', meta: 'Il y a 12 min · 2 sur 4', image: '/images/tacos.webp', caption: 'Les tacos du soir sortent de cuisine, avec légumes rôtis et citron vert.', restaurantId: 'casa' },
  { author: 'Atelier Miso', meta: 'Il y a 5 min · 4 sur 4', image: '/images/ramen.webp', caption: 'Le bouillon mijote depuis ce matin, avec un nouveau condiment maison.', restaurantId: 'miso' },
  { author: 'Camille R.', meta: 'Il y a 48 min · 1 sur 2', image: '/images/table.webp', caption: 'Une table généreuse et une nouvelle coche sur ma carte Chez Amina.', memberId: 'camille' },
]

export let historyItems: HistoryItem[] = [
  { id: 1, restaurantId: 'amina', title: 'Points de commande', date: '9 juil. 2026 à 20:15', detail: '2 articles · 27,00 €', amount: '+1', balance: '9', kind: 'gain' },
  { id: 2, restaurantId: 'miso', title: 'Points de commande', date: '8 juil. 2026 à 13:05', detail: '1 article · 16,50 €', amount: '+100', balance: '740', kind: 'order' },
  { id: 3, restaurantId: 'amina', title: 'Ajustement de fidélité', date: '5 juil. 2026 à 09:00', detail: 'Correction d’une visite oubliée', amount: '+1', balance: '8', kind: 'adjust' },
  { id: 4, restaurantId: 'miso', title: 'Ajustement de fidélité', date: '4 juil. 2026 à 10:06', detail: 'Annulation d’un article remboursé', amount: '-50', balance: '640', kind: 'spend' },
  { id: 5, restaurantId: 'amina', title: 'Points de commande', date: '4 juil. 2026 à 20:41', detail: '2 articles · 37,00 €', amount: '+2', balance: '7', kind: 'order' },
  { id: 6, restaurantId: 'miso', title: 'Visite enregistrée', date: '3 juil. 2026 à 21:10', detail: 'Scan à table', amount: '+220', balance: '500', kind: 'gain' },
  { id: 7, restaurantId: 'amina', title: 'Visite enregistrée', date: '2 juil. 2026 à 20:10', detail: 'Scan à table', amount: '+2', balance: '3', kind: 'gain' },
]

export const getRestaurant = (id: string): Restaurant =>
  restaurants.find((restaurant) => restaurant.id === id) || restaurants[0]

/** Remplace l'historique par les vrais mouvements du backend (appelé au démarrage). */
export const setHistoryItems = (items: HistoryItem[]) => {
  historyItems = items
}

/* ---------- Données sociales de démonstration ---------- */

export interface Visit {
  restaurantId: string
  count: number
  topDish: string
}

export interface UserReview {
  id: number
  restaurantId: string
  rating: string
  date: string
  text: string
}

export interface Member {
  id: string
  source?: 'server'
  name: string
  handle: string
  initials: string
  bio: string
  posts: number
  liked: number
  visits: number
  reviews: number
  likedRestaurants: string[]
  visitList: Visit[]
  reviewList: UserReview[]
  photos: string[]
}

/** Visites de Camille (profil utilisateur de la démonstration). */
export const userVisits: Visit[] = [
  { restaurantId: 'amina', count: 7, topDish: 'Couscous du vendredi' },
  { restaurantId: 'miso', count: 5, topDish: 'Ramen miso blanc' },
  { restaurantId: 'comptoir', count: 3, topDish: 'Assiette solaire' },
]

/** Avis déposés par Camille. */
export const userReviews: UserReview[] = [
  {
    id: 1,
    restaurantId: 'amina',
    rating: '5/5',
    date: '9 juil. 2026',
    text: 'Le couscous du vendredi est devenu un rituel. Carte de fidélité très simple à utiliser.',
  },
  {
    id: 2,
    restaurantId: 'miso',
    rating: '5/5',
    date: '3 juil. 2026',
    text: 'Un bouillon végétal délicat, service calme et attentionné. Je reviens chaque semaine.',
  },
]

/** Membres recherchables depuis Discovery. */
export const members: Member[] = [
  {
    id: 'camille',
    name: 'Camille Robert',
    handle: '@camilleatable',
    initials: 'CR',
    bio: 'Toujours partante pour une grande tablée, un bouillon réconfortant et les adresses qui prennent soin des végétariens.',
    posts: 3,
    liked: 3,
    visits: 15,
    reviews: 2,
    likedRestaurants: ['amina', 'comptoir', 'miso'],
    visitList: [
      { restaurantId: 'amina', count: 7, topDish: 'Couscous du vendredi' },
      { restaurantId: 'miso', count: 5, topDish: 'Ramen miso blanc' },
      { restaurantId: 'comptoir', count: 3, topDish: 'Assiette solaire' },
    ],
    reviewList: [
      { id: 1, restaurantId: 'amina', rating: '5/5', date: '9 juil. 2026', text: 'Le couscous du vendredi est devenu un rituel. Carte de fidélité très simple à utiliser.' },
      { id: 2, restaurantId: 'miso', rating: '5/5', date: '3 juil. 2026', text: 'Un bouillon végétal délicat, service calme et attentionné. Je reviens chaque semaine.' },
    ],
    photos: ['/images/table.webp', '/images/ramen.webp', '/images/tacos.webp'],
  },
  {
    id: 'sarah',
    name: 'Sarah L.',
    handle: '@sarahatable',
    initials: 'SL',
    bio: 'Chasseuse de tajines et de brunchs au soleil.',
    posts: 8,
    liked: 2,
    visits: 23,
    reviews: 2,
    likedRestaurants: ['amina', 'braise'],
    visitList: [
      { restaurantId: 'casa', count: 10, topDish: 'Tacos de légumes rôtis' },
      { restaurantId: 'amina', count: 9, topDish: 'Tajine citron' },
      { restaurantId: 'braise', count: 4, topDish: 'Poulet braisé' },
    ],
    reviewList: [
      { id: 1, restaurantId: 'amina', rating: '5/5', date: '12 juil. 2026', text: 'Une cuisine généreuse et un accueil qui donne envie de revenir.' },
      { id: 2, restaurantId: 'braise', rating: '4/5', date: '28 juin 2026', text: 'Belles cuissons au feu, le poulet braisé est très bien assaisonné.' },
    ],
    photos: ['/images/tacos.webp', '/images/table.webp'],
  },
  {
    id: 'mehdi',
    name: 'Mehdi B.',
    handle: '@mehdibouge',
    initials: 'MB',
    bio: 'Paris 11e, couscous le vendredi, ramen le dimanche.',
    posts: 5,
    liked: 4,
    visits: 19,
    reviews: 1,
    likedRestaurants: ['amina', 'miso', 'casa', 'rizrouge'],
    visitList: [
      { restaurantId: 'amina', count: 11, topDish: 'Couscous du vendredi' },
      { restaurantId: 'miso', count: 8, topDish: 'Ramen miso blanc' },
    ],
    reviewList: [
      { id: 1, restaurantId: 'amina', rating: '5/5', date: '2 juil. 2026', text: 'Le couscous du vendredi est devenu un rituel. Carte de fidélité très simple à utiliser.' },
    ],
    photos: ['/images/table.webp', '/images/ramen.webp'],
  },
  {
    id: 'lea',
    name: 'Léa P.',
    handle: '@leagoutte',
    initials: 'LP',
    bio: 'Végétarienne curieuse, toujours un avis à partager.',
    posts: 12,
    liked: 3,
    visits: 31,
    reviews: 3,
    likedRestaurants: ['miso', 'comptoir', 'rizrouge'],
    visitList: [
      { restaurantId: 'miso', count: 12, topDish: 'Donburi aubergine' },
      { restaurantId: 'comptoir', count: 10, topDish: 'Granola maison' },
      { restaurantId: 'casa', count: 9, topDish: 'Quesadilla maison' },
    ],
    reviewList: [
      { id: 1, restaurantId: 'casa', rating: '4/5', date: '10 juil. 2026', text: 'Salsa verde excellente, salle un peu bruyante le samedi.' },
      { id: 2, restaurantId: 'miso', rating: '5/5', date: '6 juil. 2026', text: 'Options végétales claires et bouillon très délicat.' },
      { id: 3, restaurantId: 'comptoir', rating: '5/5', date: '30 juin 2026', text: 'Le brunch du dimanche préféré de la rue du Nil.' },
    ],
    photos: ['/images/ramen.webp', '/images/tacos.webp', '/images/table.webp'],
  },
  {
    id: 'eliott',
    name: 'Eliott M.',
    handle: '@eliottmange',
    initials: 'EM',
    bio: 'Ramen, bols et tout ce qui mijote doucement.',
    posts: 4,
    liked: 2,
    visits: 12,
    reviews: 1,
    likedRestaurants: ['miso', 'rizrouge'],
    visitList: [
      { restaurantId: 'miso', count: 8, topDish: 'Ramen miso blanc' },
      { restaurantId: 'rizrouge', count: 4, topDish: 'Bò bún maison' },
    ],
    reviewList: [
      { id: 1, restaurantId: 'miso', rating: '5/5', date: '8 juil. 2026', text: 'Un bouillon végétal délicat et les options végétales sont très claires.' },
    ],
    photos: ['/images/ramen.webp'],
  },
]

const serverMembers = new Map<string, Member>()
export const cacheMembers = (items: Member[]) => items.forEach((member) => serverMembers.set(member.id, member))
export const getMember = (id: string): Member | undefined => serverMembers.get(id) ?? members.find((member) => member.id === id)

/* ---------- Espace restaurateur (démonstration) ---------- */

export interface ProgramClient {
  id: string
  name: string
  initials: string
  current: number
  target: number
  unit: 'coches' | 'points'
  lastVisit: string
  rewardReady: boolean
}

export let programClients: ProgramClient[] = [
  { id: 'camille', name: 'Camille Robert', initials: 'CR', current: 9, target: 10, unit: 'coches', lastVisit: '9 juil. 2026', rewardReady: false },
  { id: 'sarah', name: 'Sarah L.', initials: 'SL', current: 10, target: 10, unit: 'coches', lastVisit: '12 juil. 2026', rewardReady: true },
  { id: 'mehdi', name: 'Mehdi B.', initials: 'MB', current: 7, target: 10, unit: 'coches', lastVisit: '11 juil. 2026', rewardReady: false },
  { id: 'lea', name: 'Léa P.', initials: 'LP', current: 4, target: 10, unit: 'coches', lastVisit: '8 juil. 2026', rewardReady: false },
  { id: 'eliott', name: 'Eliott M.', initials: 'EM', current: 10, target: 10, unit: 'coches', lastVisit: '10 juil. 2026', rewardReady: true },
  { id: 'nina', name: 'Nina K.', initials: 'NK', current: 2, target: 10, unit: 'coches', lastVisit: '5 juil. 2026', rewardReady: false },
  { id: 'hugo', name: 'Hugo D.', initials: 'HD', current: 5, target: 10, unit: 'coches', lastVisit: '3 juil. 2026', rewardReady: false },
]

export interface ScanEvent {
  id: number
  clientName: string
  detail: string
  time: string
}

export let recentScans: ScanEvent[] = [
  { id: 1, clientName: 'Sarah L.', detail: '+1 coche · récompense atteinte', time: 'Il y a 25 min' },
  { id: 2, clientName: 'Camille Robert', detail: '+1 coche', time: 'Il y a 2 h' },
  { id: 3, clientName: 'Nina K.', detail: 'Nouvelle membre · carte créée', time: 'Il y a 3 h' },
  { id: 4, clientName: 'Mehdi B.', detail: '+1 coche', time: 'Hier à 20:41' },
  { id: 5, clientName: 'Eliott M.', detail: '+1 coche · récompense atteinte', time: 'Hier à 13:12' },
]

/** Données restaurateur réelles (clients + activité), injectées au démarrage. */
export const setProgramClients = (clients: ProgramClient[]) => {
  programClients = clients
}
export const setRecentScans = (scans: ScanEvent[]) => {
  recentScans = scans
}

export interface SharedPost {
  id: number
  restaurantId: string
  author: string
  initials: string
  image: string
  caption: string
  rating: number
  time: string
}

/** Partages FoodShare de démonstration — en attente de validation restaurateur. */export const pendingSharesSeed: SharedPost[] = [
  { id: 1, restaurantId: 'amina', author: 'Camille Robert', initials: 'CR', image: '/images/table.webp', caption: 'Le couscous du vendredi qui met tout le monde d’accord.', rating: 5, time: 'Il y a 1 h' },
  { id: 2, restaurantId: 'amina', author: 'Léa P.', initials: 'LP', image: '/images/tacos.webp', caption: 'Une table de quartier comme on les aime.', rating: 4, time: 'Il y a 4 h' },
  { id: 3, restaurantId: 'amina', author: 'Hugo D.', initials: 'HD', image: '/images/ramen.webp', caption: 'Tajine citron validé à 100 %.', rating: 5, time: 'Hier à 21:03' },
]
