import type { HistoryItem, Loyalty, ProgramClient, Restaurant, ScanEvent } from '../data'

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
}

let backendState: BackendState = { connected: false, restaurants: {}, backendIds: {}, balances: {} }

export const getBackendState = () => backendState

// ---------- Appels HTTP ----------

const tokens: Partial<Record<Role, string>> = {}

async function apiCall<T = unknown>(
  method: string,
  path: string,
  options: { role?: Role; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.role && tokens[options.role]) {
    headers.Authorization = `Bearer ${tokens[options.role]}`
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/** Connexion démo : récupère un token de session via le lien magique (mode dev). */
export async function ensureSession(role: Role): Promise<void> {
  if (tokens[role]) return
  const cached = localStorage.getItem(`fidelity.token.${role}`)
  if (cached) {
    tokens[role] = cached
    try {
      await apiCall('GET', '/auth/me', { role })
      return
    } catch {
      // Token expiré → on en redemande un
      localStorage.removeItem(`fidelity.token.${role}`)
      delete tokens[role]
    }
  }
  const { devLink } = await apiCall<{ devLink: string }>('POST', '/auth/magic-link', {
    body: { email: DEMO_EMAILS[role] },
  })
  const magicToken = new URL(devLink).searchParams.get('token') ?? ''
  const session = await apiCall<{ token: string }>('GET', `/auth/verify?token=${magicToken}`)
  tokens[role] = session.token
  localStorage.setItem(`fidelity.token.${role}`, session.token)
}

// ---------- Adaptateurs backend → formes du front ----------

const priceToString = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`
export const priceToCents = (price: string) =>
  Math.round(Number.parseFloat(price.replace(/[^\d,.-]/g, '').replace(',', '.')) * 100) || 0

interface ApiProgram {
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
      loyalty: { type: 'stamps', title: 'Programme fidélité', current: 0, target: 10, reward: '', rule: '', style: 'braise' },
      menu: [],
      reviews: [],
    } as Restaurant)

  return {
    ...base,
    name: api.name,
    cuisine: api.cuisine,
    district: api.district,
    address: api.address,
    description: api.description || base.description,
    diets: api.diets?.length ? api.diets : base.diets,
    loyalty: api.program
      ? {
          type: api.program.type.toLowerCase() as Loyalty['type'],
          title: api.program.title,
          current: base.loyalty.current,
          target: api.program.target,
          reward: api.program.reward,
          rule: api.program.rule,
          style: api.program.style.toLowerCase() as Loyalty['style'],
        }
      : base.loyalty,
    menu: api.menuItems?.length
      ? api.menuItems.map((item) => ({ name: item.name, description: item.description, price: priceToString(item.priceCents) }))
      : base.menu,
    reviews: api.reviews?.length
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
  const state: BackendState = { connected: false, restaurants: {}, backendIds: {}, balances: {} }

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
    const mine = await apiCall<Array<{ restaurant: { slug: string }; balance: number }>>(
      'GET',
      '/memberships/mine',
      { role: 'member' },
    )
    for (const m of mine) {
      state.balances[SLUG_TO_ID[m.restaurant.slug] ?? m.restaurant.slug] = m.balance
    }
  } catch {
    // Pas de session → soldes démo conservés
  }

  backendState = state
  return state
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
        Array<{ delta: number; balanceAfter: number; kind: string; note?: string; createdAt: string }>
      >('GET', `/memberships/${membership.id}/history`, { role: 'member' })
      for (const entry of entries) {
        const label = KIND_LABEL[entry.kind] ?? KIND_LABEL.EARN
        all.push({
          id: nextId++,
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
    return all.sort((a, b) => b.id - a.id)
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

export async function fetchClients(frontId: string): Promise<{ clients: ProgramClient[]; scans: ScanEvent[] } | null> {
  const backendId = backendState.backendIds[frontId]
  if (!backendId) return null
  try {
    await ensureSession('restaurant')
    const data = await apiCall<{
      members: Array<{ membershipId: string; name: string; balance: number; lastActivityAt: string }>
      recent: Array<{ id: string; clientName: string; delta: number; kind: string; createdAt: string }>
    }>('GET', `/restaurants/${backendId}/members`, { role: 'restaurant' })

    const program = backendState.restaurants[frontId]?.loyalty
    const target = program?.target ?? 10
    const unit = program?.type === 'points' ? ('points' as const) : ('coches' as const)

    return {
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
  profile: { name: string; cuisine: string; district: string; address: string; description: string; diets: string[] },
  menu: Array<{ name: string; description: string; price: string }>,
): Promise<boolean> {
  const backendId = backendState.backendIds[frontId]
  if (!backendId) return false
  try {
    await ensureSession('restaurant')
    await apiCall('PUT', `/restaurants/${backendId}`, {
      role: 'restaurant',
      body: {
        name: profile.name,
        cuisine: profile.cuisine,
        district: profile.district,
        address: profile.address,
        description: profile.description,
        diets: profile.diets,
      },
    })
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
