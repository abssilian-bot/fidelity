import crypto from 'node:crypto'

// Tokens signés en HMAC-SHA256 (format : payload.signature, sans lib externe).
// Le serveur seul connaît APP_SECRET → impossible de forger un token.

const rawSecret = process.env.APP_SECRET
if (!rawSecret || rawSecret === 'change-me') {
  throw new Error('APP_SECRET manquant ou par défaut : configure backend/.env')
}
const SECRET: string = rawSecret

export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 }),
  ).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload as T
  } catch {
    return null
  }
}

// Code aléatoire (ex : QR privé membre) — jamais devinable
export function randomCode(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('base64url')
}
