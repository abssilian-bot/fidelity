import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerErrorHandler } from '../dist/lib/security.js'
process.env.APP_SECRET = 'auth-tests-only-not-a-production-secret'
const { authRoutes } = await import('../dist/routes/auth.js')
const { registerAuth } = await import('../dist/lib/auth.js')
const { signToken, verifyToken } = await import('../dist/lib/tokens.js')

async function fixture(t, { resend = false, sendError = false, throwError = false } = {}) {
  process.env.RESEND_API_KEY = resend ? 're_test_no_external_request' : ''
  process.env.APP_URL = 'https://fidelity.example'
  delete process.env.EMAIL_FROM
  const messages = [], logs = [], used = new Set(), users = new Map()
  const originalConsoleError = console.error
  console.error = (...args) => logs.push(JSON.stringify(args))
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).startsWith('https://api.resend.com/'))
    messages.push(JSON.parse(options.body))
    if (throwError) throw new Error('Prestataire indisponible : ne pas exposer le message')
    return new Response(JSON.stringify(sendError ? { name: 'validation_error', message: 'Détail privé : https://fidelity.example/?token=secret' } : { id: 'mail-test' }), { status: sendError ? 403 : 200, headers: { 'content-type': 'application/json' } })
  }
  const app = Fastify({ logger: { stream: { write: line => logs.push(line) } } })
  registerAuth(app, { user: { findUnique: async () => ({ role: 'MEMBER' }) }, revokedSession: { findUnique: async () => null } }); registerErrorHandler(app)
  const upsert = async args => {
    if (!users.has(args.where.email)) users.set(args.where.email, { id: 'user-' + users.size, role: 'MEMBER', ...args.create, pseudo: null, displayName: null })
    else Object.assign(users.get(args.where.email), args.update)
    return users.get(args.where.email)
  }
  authRoutes(app, {
    $transaction: async callback => callback({
      usedMagicLink: { deleteMany: async () => {}, create: async ({ data }) => {
        if (used.has(data.tokenHash)) throw Object.assign(new Error('unique'), { code: 'P2002' })
        used.add(data.tokenHash)
      } }, user: { upsert },
    }),
    user: { findUnique: async () => null },
  })
  t.after(async () => { await app.close(); globalThis.fetch = originalFetch; console.error = originalConsoleError; delete process.env.RESEND_API_KEY })
  const request = (email = 'personne@example.com') => app.inject({ method: 'POST', url: '/auth/magic-link', payload: { email } })
  return { app, request, messages, logs, users }
}

test('Sans clé : devLink inchangé, aucun envoi', async t => {
  const { request, messages, app } = await fixture(t)
  const response = await request()
  assert.equal(response.statusCode, 200)
  assert.ok(response.json().devLink.startsWith('http://localhost:3001/auth/verify?token='))
  assert.equal(messages.length, 0)
  assert.equal((await app.inject('/auth/config')).json().emailEnabled, false)
})
test('Resend : e-mail français HTML et texte, aucun lien dans la réponse ou les logs', async t => {
  const { request, messages, logs, users, app } = await fixture(t, { resend: true })
  const response = await request('  PERSONNE@example.com  ')
  assert.equal(response.statusCode, 200); assert.equal(response.json().devLink, undefined)
  assert.equal(messages.length, 1); assert.equal(users.size, 0)
  const mail = messages[0]
  assert.equal(mail.from, 'Fidelity <onboarding@resend.dev>'); assert.equal(mail.to, 'personne@example.com')
  assert.equal(mail.subject, 'Fidelity — ton lien de connexion')
  assert.match(mail.html, /Me connecter/); assert.match(mail.html, /#c4410f/)
  assert.match(mail.text, /15 minutes, une seule utilisation/); assert.match(mail.text, /Tu n'as rien demandé/)
  const link = mail.text.match(/https:\/\/fidelity\.example\/\?token=\S+/)[0]
  assert.ok(!response.body.includes(link)); assert.ok(!logs.join('').includes('token='))
  assert.equal((await app.inject('/auth/config')).json().emailEnabled, true)
})
for (const mode of ['sendError', 'throwError']) test('Échec Resend générique : ' + mode, async t => {
  const { request, logs } = await fixture(t, { resend: true, [mode]: true })
  const response = await request()
  assert.equal(response.statusCode, 502); assert.equal(response.json().devLink, undefined)
  assert.ok(!response.body.includes('privé')); assert.ok(!logs.join('').includes('token='))
})
test('Un lien ne permet qu’une connexion ; une autre demande reste possible', async t => {
  const { request, app, users } = await fixture(t)
  const token = new URL((await request()).json().devLink).searchParams.get('token')
  const results = await Promise.all([app.inject('/auth/verify?token=' + token), app.inject('/auth/verify?token=' + token)])
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 401])
  assert.equal(users.size, 1)
  const success = results.find(r => r.statusCode === 200).json()
  assert.equal(success.user.email, 'personne@example.com')
  const session = verifyToken(success.token)
  assert.equal(session.sub, success.user.id); assert.ok(session.exp > Date.now() + 6 * 24 * 3600 * 1000)
  const other = new URL((await request()).json().devLink).searchParams.get('token')
  assert.notEqual(token, other)
  assert.equal((await app.inject('/auth/verify?token=' + other)).json().user.id, success.user.id)
})
test('Lien expiré, forgé, mauvaise portée ou suffixe ajouté : refus', async t => {
  const { app, request, users } = await fixture(t)
  const token = new URL((await request()).json().devLink).searchParams.get('token')
  for (const value of [signToken({ scope: 'magic', email: 'p@example.com' }, -1), signToken({ sub: 'u', role: 'MEMBER' }, 60), token + '.suffixe', 'forged.token']) {
    assert.equal((await app.inject('/auth/verify?token=' + value)).statusCode, 401)
  }
  assert.equal(users.size, 0)
})
test('Limitation à 10 demandes par minute conservée', async t => {
  const { request } = await fixture(t)
  for (let i = 0; i < 10; i++) assert.equal((await request()).statusCode, 200)
  assert.equal((await request()).statusCode, 429)
})
test('E-mail invalide rejeté avant envoi', async t => {
  const { request, messages } = await fixture(t, { resend: true })
  assert.equal((await request('pas-un-email')).statusCode, 400)
  assert.equal(messages.length, 0)
})

test('Lien restaurateur : destination conservée, aucun rôle accordé par le formulaire', async t => {
  const { app, messages } = await fixture(t, { resend: true })
  assert.equal((await app.inject({ method: 'POST', url: '/auth/magic-link', payload: { email: 'restaurateur@example.com', intent: 'restaurant', role: 'ADMIN' } })).statusCode, 200)
  const link = new URL(messages[0].text.match(/https:\/\/fidelity\.example\/\?token=\S+/)[0])
  assert.equal(link.searchParams.get('espace'), 'restaurant')
  const result = await app.inject('/auth/verify?token=' + link.searchParams.get('token'))
  assert.equal(result.json().user.role, 'MEMBER')
})

test('Désignation admin : privilège seulement après validation du lien de l’adresse configurée', async t => {
  const previous = process.env.FIDELITY_ADMIN_EMAILS; process.env.FIDELITY_ADMIN_EMAILS = 'admin@example.com'
  t.after(() => { if (previous === undefined) delete process.env.FIDELITY_ADMIN_EMAILS; else process.env.FIDELITY_ADMIN_EMAILS = previous })
  const { app, request, users } = await fixture(t)
  const link = new URL((await request('admin@example.com')).json().devLink)
  assert.equal(users.size, 0)
  const result = await app.inject('/auth/verify?token=' + link.searchParams.get('token'))
  assert.equal(result.json().user.role, 'ADMIN')
  assert.equal((await app.inject('/auth/verify?token=' + link.searchParams.get('token'))).statusCode, 401)
})

test('Production sans clé Resend : aucun devLink ni token exposé', async t => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous })
  const { app, request, logs } = await fixture(t)
  const response = await request()
  assert.equal(response.statusCode, 503); assert.equal(response.json().devLink, undefined)
  assert.equal((await app.inject('/auth/config')).json().emailEnabled, true)
  assert.ok(!logs.join('').includes('token='))
})

test('En-têtes de proxy inventés : le limiteur local ne peut pas être contourné', async t => {
  const { rateLimit, registerSecurityHeaders } = await import('../dist/lib/security.js')
  const app = Fastify({ trustProxy: false })
  app.addHook('onRequest', rateLimit(2, 60_000)); registerSecurityHeaders(app)
  app.get('/probe', async () => ({ ok: true }))
  t.after(() => app.close())
  for (let i = 0; i < 3; i++) {
    const result = await app.inject({ url: '/probe', headers: { 'x-forwarded-for': `198.51.100.${i}` } })
    assert.equal(result.statusCode, i < 2 ? 200 : 429)
  }
})
