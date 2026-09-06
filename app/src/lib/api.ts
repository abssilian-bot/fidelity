import { cacheMembers, restaurants as demoRestaurants } from '../data'
import type { HistoryItem, Loyalty, Member, ProgramClient, Restaurant, ScanEvent } from '../data'
import type { Share } from '../nav'
import type { SearchProfile } from './search-profile'
import { WEEK_DAYS } from './search-catalog'

// ─────────────────────────────────────────────────────────────────────────────
// Pont entre le front et l'API Fidelity (backend/).
// - Si l'API est éteinte : l'app continue de fonctionner avec les données démo.
// - Si l'API répond : les écrans affichent les VRAIES données du serveur.
// ─────────────────────────────────────────────────────────────────────────────

// En ligne (app servie par le backend) : même adresse, '' = même origine.
// En dev local : le front (port 3000) tape l'API (port 3001).
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3001' : '')

// Correspondance entre les slugs du backend et les ids utilisés par le front
const SLUG_TO_ID: Record<string, string> = {
  'chez-amina': 'amina',
  'casa-verde': 'casa',
  'atelier-miso': 'miso',
  'le-comptoir-solaire': 'comptoir',
  'riz-rouge': 'rizrouge',
  'braise-basilic': 'braise',
}

type Role = 'member' | 'restaurant'

const DEMO_EMAILS: Record<Role, string> = {
  member: 'camille@fidelity.local',
  restaurant: 'demo-restaurateur@fidelity.local',
}

export interface BackendState {
  connected: boolean
  /** Restaurants réels (fusionnés avec la démo pour garder l'apparence) */
  restaurants: Record<string, Restaurant>
  /** id front → id backend (indispensable pour les écritures) */
  backendIds: Record<string, string>
  /** id front → solde réel du membre connecté */
  balances: Record<string, number>
  memberships: Record<string, ApiMembership>
  membershipsReady: boolean
}

export interface ApiMembership {
  id: string
  publicCode: string
  restaurant: { slug: string }
  balance: number
}

let backendState: BackendState = { connected: false, restaurants: {}, backendIds: {}, balances: {}, memberships: {}, membershipsReady: false }

export const getBackendState = () => backendState

// ---------- Appels HTTP ----------

const tokens: Partial<Record<Role, string>> = {}
const sessionFlights: Partial<Record<Role, Promise<void>>> = {}
let sessionGeneration = 0
let validatedAccountToken = ''
let emailMode: Promise<boolean> | undefined

export interface Account {
  token: string
  user: { id: string; email: string; pseudo: string | null; displayName: string | null; role: string }
}
export interface LoginLinkResponse { message: string; devLink?: string }

const storageGet = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const storageRemove = (key: string) => { try { localStorage.removeItem(key) } catch { /* Navigation privée : aucune session à conserver. */ } }
const tokenExpired = (token: string): boolean => {
  try {
    const body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(body))
    return typeof exp !== 'number' || !Number.isFinite(exp) || exp <= Date.now()
  } catch { return true }
}

export function logoutAccount(): void {
  sessionGeneration++
  validatedAccountToken = ''
  storageRemove('fidelity.account')
  for (const role of ['member', 'restaurant'] as const) {
    storageRemove(`fidelity.token.${role}`)
    delete tokens[role]
    delete sessionFlights[role]
  }
  backendState = { ...backendState, memberships: {}, balances: {}, membershipsReady: false }
}

/** Une déconnexion explicite révoque aussi le Bearer sur le serveur. */
export async function disconnectAccount(): Promise<void> {
  const account = getAccount()
  if (account) {
    tokens.member = account.token
    await apiCall('POST', '/auth/logout', { role: 'member' })
  }
  logoutAccount()
}

export function getAccount(): Account | null {
  const raw = storageGet('fidelity.account')
  if (!raw) return null
  try {
    const account = JSON.parse(raw) as Account
    if (!account || typeof account.token !== 'string' || !account.user || typeof account.user.id !== 'string' || typeof account.user.email !== 'string' || tokenExpired(account.token)) {
      logoutAccount(); return null
    }
    return account
  } catch { logoutAccount(); return null }
}

export async function requestLoginLink(email: string): Promise<LoginLinkResponse> {
  return apiCall<LoginLinkResponse>('POST', '/auth/magic-link', { body: { email: email.trim().toLowerCase() } })
}

// React StrictMode peut relancer l'effet de démarrage : un lien n'est vérifié qu'une fois.
const loginFlights = new Map<string, Promise<Account>>()
export function completeLogin(token: string): Promise<Account> {
  const existing = loginFlights.get(token)
  if (existing) return existing
  const operation = (async () => {
    const account = await apiCall<Account>('GET', `/auth/verify?token=${encodeURIComponent(token)}`)
    if (!account?.user?.id || !account.user.email || typeof account.token !== 'string' || tokenExpired(account.token)) throw new Error('Réponse de connexion invalide.')
    logoutAccount()
    try {
      localStorage.setItem('fidelity.account', JSON.stringify(account))
      localStorage.setItem('fidelity.token.member', account.token)
    } catch {
      logoutAccount()
      throw new Error('Le navigateur ne peut pas conserver ta connexion. Autorise le stockage puis redemande un lien.')
    }
    tokens.member = account.token
    validatedAccountToken = account.token
    return account
  })()
  loginFlights.set(token, operation)
  void operation.catch(() => { loginFlights.delete(token) })
  return operation
}

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

async function apiCall<T = unknown>(
  method: string,
  path: string,
  options: { role?: Role; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = options.body === undefined ? {} : { 'Content-Type': 'application/json' }
  if (options.role && tokens[options.role]) {
    headers.Authorization = `Bearer ${tokens[options.role]}`
  }
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method, headers, cache: 'no-store', referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(10_000),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch { throw new ApiError('Le serveur est indisponible. Tu peux continuer à explorer la démo et réessayer plus tard.', 0) }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    if (res.status === 401 && options.role) {
      const account = getAccount()
      if (account && tokens[options.role] === account.token) {
        logoutAccount()
        window.dispatchEvent(new Event('fidelity:session-expired'))
      } else { delete tokens[options.role]; storageRemove(`fidelity.token.${options.role}`) }
    }
    throw new ApiError(err.error ?? 'La demande n’a pas pu aboutir. Réessaie plus tard.', res.status)
  }
  return res.json() as Promise<T>
}

/** Priorité au compte personnel. Le flux automatique démo reste réservé au serveur sans Resend. */
export async function ensureSession(role: Role): Promise<void> {
  const pending = sessionFlights[role]
  if (pending) return pending
  const operation = establishSession(role)
  sessionFlights[role] = operation
  try { await operation } finally { if (sessionFlights[role] === operation) delete sessionFlights[role] }
}

async function establishSession(role: Role): Promise<void> {
  const account = getAccount()
  const generation = sessionGeneration
  const stillCurrent = () => { if (generation !== sessionGeneration) throw new Error('La session a changé. Réessaie.') }
  if (account) {
    // Un membre connecté ne doit jamais hériter du compte propriétaire de démonstration.
    tokens[role] = account.token
    if (validatedAccountToken !== account.token) {
      await apiCall('GET', '/auth/me', { role })
      stillCurrent()
      validatedAccountToken = account.token
    }
    return
  }
  emailMode ??= apiCall<{ emailEnabled: boolean }>('GET', '/auth/config')
    .then((config) => config.emailEnabled)
    .catch((error) => { emailMode = undefined; if (error instanceof ApiError && error.status === 404) return false; throw error })
  if (await emailMode) throw new Error('Connecte-toi par e-mail depuis les Réglages pour utiliser ton compte.')
  stillCurrent()
  if (tokens[role] && !tokenExpired(tokens[role]!)) return
  const cached = storageGet(`fidelity.token.${role}`)
  if (cached) {
    tokens[role] = cached
    try {
      await apiCall('GET', '/auth/me', { role })
      stillCurrent()
      return
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
      // Token expiré → on en redemande un
      storageRemove(`fidelity.token.${role}`)
      delete tokens[role]
    }
  }
  const { devLink } = await apiCall<LoginLinkResponse>('POST', '/auth/magic-link', {
    body: { email: DEMO_EMAILS[role] },
  })
  stillCurrent()
  if (!devLink) throw new Error('Connecte-toi par e-mail depuis les Réglages.')
  const magicToken = new URL(devLink).searchParams.get('token') ?? ''
  const session = await apiCall<{ token: string }>('GET', `/auth/verify?token=${encodeURIComponent(magicToken)}`)
  stillCurrent()
  tokens[role] = session.token
  try { localStorage.setItem(`fidelity.token.${role}`, session.token) } catch { /* La démo reste accessible en mémoire. */ }
}

// ---------- Adaptateurs backend → formes du front ----------

const priceToString = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`
export const priceToCents = (price: string) =>
  Math.round(Number.parseFloat(price.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100) || 0

interface ApiProgram {
  active?: boolean
  type: 'STAMPS' | 'POINTS'
  title: string
  target: number
  reward: string
  rule: string
  style: 'BRAISE' | 'CREME' | 'ENCRE'
}

interface ApiRestaurant {
  id: string
  slug: string
  name: string
  cuisine: string
  district: string
  address: string
  description: string
  diets: string[]
  foodTags?: string[]
  services?: string[]
  avgPrice?: number
  maxGuests?: number
  hours?: Array<{ day: string; open: string; close: string }>
  program?: ApiProgram | null
  menuItems?: Array<{ name: string; description: string; priceCents: number }>
  reviews?: Array<{ rating: number; text: string; author?: { displayName?: string; pseudo?: string } }>
}

function mergeRestaurant(demo: Restaurant | undefined, api: ApiRestaurant): Restaurant {
  const base: Restaurant =
    demo ??
    ({
      id: api.slug,
      name: api.name,
      cuisine: api.cuisine,
      district: api.district,
      distance: '—',
      rating: '—',
      image: '/images/table.webp',
      address: api.address,
      description: api.description,
      hours: [],
      diets: api.diets,
      open: true,
      avgPrice: 0,
      maxGuests: 0,
      loyalty: {
        type: 'stamps',
        title: 'Programme fidélité',
        current: 0,
        target: 10,
        reward: '',
        rule: '',
        eurosPerStamp: 0,
        tiers: [{ at: 10, reward: '' }],
        style: 'braise',
      },
      menu: [],
      reviews: [],
      offers: [],
    } as Restaurant)

  return {
    ...base,
    loyaltyAvailable: !!api.program && api.program.active !== false,
    name: api.name,
    cuisine: api.cuisine,
    district: api.district,
    address: api.address,
    description: api.description || base.description,
    diets: api.diets ?? base.diets,
    foodTags: api.foodTags ?? base.foodTags,
    services: api.services ?? base.services,
    avgPrice: api.avgPrice ?? base.avgPrice,
    maxGuests: api.maxGuests ?? base.maxGuests,
    ...(Array.isArray(api.hours) ? {
      hours: api.hours.filter((period) => period.open && period.close).map((period) => `${period.day} · ${period.open}–${period.close}`),
      openingHours: WEEK_DAYS.map((name, day) => ({ day,
        intervals: api.hours!.filter((period) => period.day.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr') && period.open && period.close)
          .map((period) => ({ open: period.open, close: period.close })),
      })),
    } : {}),
    loyalty: api.program
      ? {
          type: api.program.type.toLowerCase() as Loyalty['type'],
          title: api.program.title,
          current: 0,
          target: api.program.target,
          reward: api.program.reward,
          rule: api.program.rule,
          pointsPerEuro: base.loyalty.pointsPerEuro,
          eurosPerStamp: base.loyalty.eurosPerStamp,
          tiers: [{ at: api.program.target, reward: api.program.reward }],
          style: api.program.style.toLowerCase() as Loyalty['style'],
        }
      : base.loyalty,
    menu: Array.isArray(api.menuItems)
      ? api.menuItems.map((item) => ({ name: item.name, description: item.description, price: priceToString(item.priceCents) }))
      : base.menu,
    reviews: Array.isArray(api.reviews)
      ? api.reviews.map((review) => ({
          author: review.author?.displayName ?? review.author?.pseudo ?? 'Membre',
          rating: `${review.rating}/5`,
          text: review.text,
        }))
      : base.reviews,
  }
}

// ---------- Chargement initial ----------

/** Charge les restaurants réels + les soldes du membre démo. Ne jette jamais. */
export async function bootstrapBackend(demoRestaurants: Restaurant[]): Promise<BackendState> {
  const state: BackendState = { connected: false, restaurants: {}, backendIds: {}, balances: {}, memberships: {}, membershipsReady: false }

  try {
    const list = await apiCall<ApiRestaurant[]>('GET', '/restaurants')
    // Détail de chaque resto (menu + avis) en parallèle
    const details = await Promise.all(
      list.map((r) => apiCall<ApiRestaurant>('GET', `/restaurants/${r.slug}`).catch(() => r)),
    )
    for (const api of details) {
      const frontId = SLUG_TO_ID[api.slug] ?? api.slug
      state.backendIds[frontId] = api.id
      state.restaurants[frontId] = mergeRestaurant(
        demoRestaurants.find((d) => d.id === frontId),
        api,
      )
    }
    state.connected = true
  } catch {
    backendState = state
    return state // API éteinte → démo pure
  }

  try {
    await ensureSession('member')
    const mine = await apiCall<ApiMembership[]>(
      'GET',
      '/memberships/mine',
      { role: 'member' },
    )
    for (const m of mine) {
      const id = SLUG_TO_ID[m.restaurant.slug] ?? m.restaurant.slug
      state.balances[id] = m.balance
      state.memberships[id] = m
    }
    state.membershipsReady = true
  } catch {
    // Ne jamais faire passer une carte de démonstration pour une adhésion réelle.
  }

  backendState = state
  return state
}

/** Adhésion explicite : un échec réseau ne crée jamais de carte locale de remplacement. */
export async function addMyCard(restaurantId: string): Promise<BackendState> {
  if (!backendState.connected || !backendState.backendIds[restaurantId]) throw new Error('Ce restaurant n’est pas disponible sur le serveur.')
  await ensureSession('member')
  const slug = Object.keys(SLUG_TO_ID).find((key) => SLUG_TO_ID[key] === restaurantId) ?? restaurantId
  const membership = await apiCall<ApiMembership>('POST', '/memberships', { role: 'member', body: { slug } })
  // Ancienne API : récupérer le solde existant au lieu de le remplacer par zéro.
  if (typeof membership.balance !== 'number') return refreshMyCards()
  backendState = { ...backendState,
    memberships: { ...backendState.memberships, [restaurantId]: membership },
    balances: { ...backendState.balances, [restaurantId]: membership.balance },
  }
  return backendState
}

export async function refreshMyCards(): Promise<BackendState> {
  if (!backendState.connected) {
    const restored = await bootstrapBackend(demoRestaurants)
    if (!restored.connected) throw new Error('Connexion au serveur nécessaire pour actualiser tes cartes.')
  }
  await ensureSession('member')
  const mine = await apiCall<ApiMembership[]>('GET', '/memberships/mine', { role: 'member' })
  const memberships: BackendState['memberships'] = {}
  const balances: BackendState['balances'] = {}
  for (const membership of mine) {
    const id = SLUG_TO_ID[membership.restaurant.slug] ?? membership.restaurant.slug
    memberships[id] = membership
    balances[id] = membership.balance
  }
  backendState = { ...backendState, memberships, balances, membershipsReady: true }
  return backendState
}

export async function presentMyCard(frontId: string): Promise<{ code: string; expiresAt: string }> {
  await ensureSession('member')
  const card = backendState.memberships[frontId]
  if (!card) throw new Error('Connecte-toi et ajoute cette carte à ton compte avant de la présenter.')
  return apiCall('POST', `/memberships/${card.id}/presentation`, { role: 'member' })
}

export interface OwnedRestaurant { id: string; frontId: string; name: string; status: string }
export async function fetchOwnedRestaurants(): Promise<OwnedRestaurant[]> {
  await ensureSession('restaurant')
  const list = await apiCall<Array<ApiRestaurant & { status: string }>>('GET', '/owner/restaurants', { role: 'restaurant' })
  for (const restaurant of list) {
    const frontId = SLUG_TO_ID[restaurant.slug] ?? restaurant.slug
    backendState.backendIds[frontId] = restaurant.id
    backendState.restaurants[frontId] = mergeRestaurant(backendState.restaurants[frontId], restaurant)
  }
  return list.map(restaurant => ({ id: restaurant.id, frontId: SLUG_TO_ID[restaurant.slug] ?? restaurant.slug, name: restaurant.name, status: restaurant.status }))
}
export interface ScannedCard {
  membershipId: string; member: { displayName: string | null; pseudo: string | null }
  restaurant: { id: string; name: string }; program: ApiProgram; balance: number; expiresAt: string
}
export async function resolveScannedCard(code: string, restaurantId: string): Promise<ScannedCard> {
  await ensureSession('restaurant')
  return apiCall('GET', `/scan/${encodeURIComponent(code)}?restaurantId=${encodeURIComponent(restaurantId)}`, { role: 'restaurant' })
}
export interface ScanReceipt { id: string; delta: number; balanceAfter: number; createdAt: string; idempotentReplay?: boolean }
export async function commitScan(input: import('./scan').PendingScan): Promise<ScanReceipt> {
  await ensureSession('restaurant')
  return apiCall('POST', `/ledger/${input.operation}`, { role: 'restaurant', body: {
    code: input.code, restaurantId: input.restaurantId, idempotencyKey: input.idempotencyKey,
    ...(input.operation === 'earn' ? { delta: input.delta } : {}),
  } })
}

// ---------- Historique du membre ----------

const KIND_LABEL: Record<string, { title: string; kind: HistoryItem['kind'] }> = {
  EARN: { title: 'Visite enregistrée', kind: 'gain' },
  REDEEM: { title: 'Récompense utilisée', kind: 'spend' },
  ADJUST: { title: 'Ajustement de fidélité', kind: 'adjust' },
  REFUND: { title: 'Ajustement de fidélité', kind: 'spend' },
  FOODSHARE: { title: 'Partage FoodShare', kind: 'gain' },
}

const formatDate = (iso: string) =>
  `${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`

export async function fetchHistory(): Promise<HistoryItem[]> {
  try {
    await ensureSession('member')
    const mine = await apiCall<Array<{ id: string; restaurant: { slug: string } }>>(
      'GET',
      '/memberships/mine',
      { role: 'member' },
    )
    const all: HistoryItem[] = []
    let nextId = 1
    for (const membership of mine) {
      const entries = await apiCall<
        Array<{ id: string; source: string; delta: number; balanceAfter: number; kind: string; note?: string; createdAt: string }>
      >('GET', `/memberships/${membership.id}/history`, { role: 'member' })
      for (const entry of entries) {
        const label = KIND_LABEL[entry.kind] ?? KIND_LABEL.EARN
        all.push({
          id: nextId++,
          serverId: entry.id, createdAt: entry.createdAt, source: entry.source,
          restaurantId: SLUG_TO_ID[membership.restaurant.slug] ?? membership.restaurant.slug,
          title: label.title,
          date: formatDate(entry.createdAt),
          detail: entry.note || 'Scan en restaurant',
          amount: `${entry.delta > 0 ? '+' : ''}${entry.delta}`,
          balance: String(entry.balanceAfter),
          kind: label.kind,
        })
      }
    }
    return all.sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!))
  } catch {
    return []
  }
}

// ---------- Espace restaurateur ----------

const relativeTime = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'À l’instant'
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Il y a ${hours} h`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Hier' : `Il y a ${days} j`
}

export async function fetchClients(frontId: string): Promise<{ clients: ProgramClient[]; scans: ScanEvent[]; stats: { newMembers: number; weeklyCredits: number; totalMembers: number } } | null> {
  const backendId = backendState.backendIds[frontId]
  if (!backendId) return null
  try {
    await ensureSession('restaurant')
    const data = await apiCall<{
      stats: { newMembers: number; weeklyCredits: number; totalMembers: number }
      members: Array<{ membershipId: string; name: string; balance: number; lastActivityAt: string }>
      recent: Array<{ id: string; clientName: string; delta: number; kind: string; createdAt: string }>
    }>('GET', `/restaurants/${backendId}/members`, { role: 'restaurant' })

    const program = backendState.restaurants[frontId]?.loyalty
    const target = program?.target ?? 10
    const unit = program?.type === 'points' ? ('points' as const) : ('coches' as const)

    return {
      stats: data.stats,
      clients: data.members.map((m) => ({
        id: m.membershipId,
        name: m.name,
        initials: m.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
        current: m.balance,
        target,
        unit,
        lastVisit: new Date(m.lastActivityAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
        rewardReady: m.balance >= target,
      })),
      scans: data.recent.map((entry, index) => ({
        id: index + 1,
        clientName: entry.clientName,
        detail:
          entry.kind === 'REDEEM'
            ? 'Récompense utilisée'
            : `${entry.delta > 0 ? '+' : ''}${entry.delta} ${unit === 'coches' ? `coche${Math.abs(entry.delta) > 1 ? 's' : ''}` : 'points'}`,
        time: relativeTime(entry.createdAt),
      })),
    }
  } catch {
    return null
  }
}

/** Publie la façade (profil + menu) d'un restaurant sur le serveur. */
export async function publishProfile(
  frontId: string,
  profile: { name: string; cuisine: string; district: string; address: string; description: string } & SearchProfile,
  menu: Array<{ name: string; description: string; price: string }>,
): Promise<boolean | 'unsupported'> {
  const backendId = backendState.backendIds[frontId]
  if (!backendId) return false
  try {
    await ensureSession('restaurant')
    const saved = await apiCall<{ foodTags?: string[]; services?: string[]; avgPrice?: number; maxGuests?: number }>('PUT', `/restaurants/${backendId}`, {
      role: 'restaurant',
      body: {
        name: profile.name,
        cuisine: profile.cuisine,
        district: profile.district,
        address: profile.address,
        description: profile.description,
        diets: profile.diets,
        foodTags: profile.foodTags,
        services: profile.services,
        avgPrice: profile.avgPrice,
        maxGuests: profile.maxGuests,
        hours: profile.openingHours.flatMap((day) => day.intervals.map((period) => ({ day: WEEK_DAYS[day.day].toLocaleLowerCase('fr'), ...period }))),
      },
    })
    if (!Array.isArray(saved.foodTags) || !Array.isArray(saved.services) || saved.avgPrice === undefined || saved.maxGuests === undefined) return 'unsupported'
    await apiCall('PUT', `/restaurants/${backendId}/menu`, {
      role: 'restaurant',
      body: {
        items: menu
          .filter((item) => item.name.trim())
          .map((item) => ({ name: item.name, description: item.description, priceCents: priceToCents(item.price) })),
      },
    })
    return true
  } catch {
    return false
  }
}

interface ApiMember {
  id: string; displayName: string | null; pseudo: string | null; bio: string | null; avatarUrl: string | null
  posts?: Array<{ imageUrl: string }>; _count?: { posts: number; reviews: number; followers: number; following: number }
}
function mapMember(member: ApiMember): Member {
  const name = member.displayName || member.pseudo || 'Membre Fidelity'
  return { id: member.id, source: 'server', name, handle: member.pseudo ? `@${member.pseudo}` : '', initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2),
    bio: member.bio ?? '', posts: member._count?.posts ?? 0, reviews: member._count?.reviews ?? 0,
    followers: member._count?.followers ?? 0, following: member._count?.following ?? 0,
    liked: 0, visits: 0, likedRestaurants: [], visitList: [], reviewList: [], photos: member.posts?.map((post) => post.imageUrl) ?? [],
  }
}

export async function fetchMemberSearch(query: string, signal: AbortSignal): Promise<Member[] | null> {
  try {
    const response = await fetch(`${API_URL}/members/search?q=${encodeURIComponent(query)}`, { signal })
    if (!response.ok) return null
    const data = await response.json() as ApiMember[]
    const result = data.map(mapMember)
    cacheMembers(result)
    return result
  } catch { return null }
}

export async function fetchPublicMember(id: string, signal: AbortSignal): Promise<Member | null> {
  try {
    const response = await fetch(`${API_URL}/members/${encodeURIComponent(id)}`, { signal })
    if (!response.ok) return null
    const result = mapMember(await response.json() as ApiMember)
    cacheMembers([result])
    return result
  } catch { return null }
}

/** Publie le programme fidélité d'un restaurant sur le serveur. */
export async function publishProgram(frontId: string, loyalty: Loyalty): Promise<boolean> {
  const backendId = backendState.backendIds[frontId]
  if (!backendId) return false
  try {
    await ensureSession('restaurant')
    await apiCall('PUT', `/restaurants/${backendId}/program`, {
      role: 'restaurant',
      body: {
        type: loyalty.type.toUpperCase(),
        title: loyalty.title,
        target: loyalty.target,
        reward: loyalty.reward,
        rule: loyalty.rule,
        style: loyalty.style.toUpperCase(),
        active: true,
      },
    })
    return true
  } catch {
    return false
  }
}

// ---------- FoodShare ----------

const ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_ID).map(([slug, id]) => [id, slug]),
)

interface ApiShare {
  id: string
  imageUrl: string
  caption: string
  rating: number | null
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED'
  createdAt: string
  author?: { id: string; displayName?: string; pseudo?: string; avatarUrl?: string } | null
  restaurant?: { id: string; name: string; slug: string } | null
}

/** Id numérique stable dérivé du cuid backend (clés React côté front). */
const numericId = (backendId: string) => {
  let hash = 0
  for (const char of backendId) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return Math.abs(hash) || 1
}

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

function mapShare(post: ApiShare, restaurantId: string): Share {
  const author = post.author?.displayName ?? post.author?.pseudo ?? 'Membre'
  return {
    id: numericId(post.id),
    backendId: post.id,
    restaurantId,
    memberId: post.author?.id,
    author,
    initials: initialsOf(author),
    image: post.imageUrl,
    caption: post.caption,
    rating: post.rating ?? 5,
    time: relativeTime(post.createdAt),
    status: post.status.toLowerCase() as Share['status'],
  }
}

/**
 * Le membre publie un FoodShare (photo + note + commentaire).
 * Renvoie le partage créé, 'forbidden' si aucune commande chez ce restaurant,
 * null si l'API est injoignable (repli démo côté appelant).
 */
export async function publishShareApi(
  frontId: string,
  input: { image: string; caption: string; rating: number },
): Promise<Share | 'forbidden' | null> {
  const slug = ID_TO_SLUG[frontId]
  if (!slug || !backendState.connected) return null
  try {
    await ensureSession('member')
    const post = await apiCall<ApiShare>('POST', '/shares', {
      role: 'member',
      body: { slug, imageUrl: input.image, caption: input.caption, rating: input.rating },
    })
    return mapShare(post, frontId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('première commande')) return 'forbidden'
    return null
  }
}

/** Partages du membre connecté (tous statuts) — visibles sur son profil. */
export async function fetchMyShares(): Promise<Share[] | null> {
  if (!backendState.connected) return null
  try {
    await ensureSession('member')
    const posts = await apiCall<ApiShare[]>('GET', '/shares/mine', { role: 'member' })
    return posts.map((post) => {
      const slug = post.restaurant?.slug ?? ''
      return mapShare(post, SLUG_TO_ID[slug] ?? slug)
    })
  } catch {
    return null
  }
}

/** File de validation FoodShare du restaurateur pour un établissement. */
export async function fetchPendingShares(frontId: string): Promise<Share[] | null> {
  const backendId = backendState.backendIds[frontId]
  if (!backendId) return null
  try {
    await ensureSession('restaurant')
    const posts = await apiCall<ApiShare[]>('GET', `/restaurants/${backendId}/shares?status=PENDING`, {
      role: 'restaurant',
    })
    return posts.map((post) => mapShare(post, frontId))
  } catch {
    return null
  }
}

/** Décision du restaurateur : republier (crédit ledger) ou refuser. */
export async function decideShareApi(shareBackendId: string, publish: boolean, rewardDelta: number): Promise<boolean> {
  try {
    await ensureSession('restaurant')
    await apiCall('POST', `/shares/${shareBackendId}/decide`, {
      role: 'restaurant',
      body: { publish, rewardDelta },
    })
    return true
  } catch {
    return false
  }
}
