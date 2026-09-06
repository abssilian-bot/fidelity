export const isCardCode = (code: string) => /^fc1_[A-Za-z0-9_-]{32}$/.test(code)
export function parseCardCode(value: string): string {
  const code = value.trim().replace(/^fidelity:card:/, '')
  if (!isCardCode(code)) throw new Error('Ce QR ne correspond pas à une carte Fidelity. Demande au client d’ouvrir sa carte.')
  return code
}
export interface PendingScan {
  accountId: string; operation: 'earn' | 'redeem'; restaurantId: string; code: string
  idempotencyKey: string; delta?: number; clientName: string; createdAt: number
}
const key = 'fidelity.scan.pending.v1'
export function readPendingScan(accountId: string): PendingScan | null {
  try {
    const input = JSON.parse(sessionStorage.getItem(key) || 'null') as PendingScan | null
    if (!input || input.accountId !== accountId || !isCardCode(input.code) || !['earn', 'redeem'].includes(input.operation) || typeof input.idempotencyKey !== 'string' || typeof input.restaurantId !== 'string') return null
    return input
  } catch { return null }
}
export function rememberScan(input: PendingScan) {
  try { sessionStorage.setItem(key, JSON.stringify(input)) }
  catch { throw new Error('Autorise le stockage de ce navigateur pour sécuriser les nouvelles tentatives après une coupure réseau.') }
}
export function forgetScan() { try { sessionStorage.removeItem(key) } catch { /* Le résultat est déjà confirmé. */ } }
