import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'

const target = path.resolve('../.local/account-api-test.mjs')
await fs.mkdir(path.dirname(target), { recursive: true })
await build({ entryPoints: ['src/lib/api.ts'], outfile: target, bundle: true, platform: 'browser', format: 'esm', define: { 'import.meta.env': JSON.stringify({ DEV: true }) } })
const token = exp => Buffer.from(JSON.stringify({ sub: 'user-test', role: 'MEMBER', exp })).toString('base64url') + '.signature'
const account = { token: token(Date.now() + 60_000), user: { id: 'user-test', email: 'membre@example.com', displayName: null, pseudo: null, role: 'MEMBER' } }

async function fixture(t, handler) {
  const values = new Map(), calls = []
  const originals = { fetch: globalThis.fetch, window: globalThis.window, localStorage: globalThis.localStorage }
  globalThis.window = new EventTarget()
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    const [data, status = 200] = await handler(url, options)
    return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
  }
  const api = await import(pathToFileURL(target).href + '?test=' + crypto.randomUUID())
  t.after(() => Object.assign(globalThis, originals))
  return { api, calls, values }
}

test('completeLogin : un seul appel en double montage, compte et token membre conservés', async t => {
  const { api, calls, values } = await fixture(t, async () => [account])
  await Promise.all([api.completeLogin('magic-test'), api.completeLogin('magic-test')])
  assert.equal(calls.length, 1)
  assert.deepEqual(api.getAccount(), account)
  assert.equal(values.get('fidelity.token.member'), account.token)
  assert.deepEqual(JSON.parse(values.get('fidelity.account')), account)
})
test('Le compte réel prime sur le token démo et ne déclenche aucun e-mail automatique', async t => {
  const { api, calls, values } = await fixture(t, async () => [account.user])
  values.set('fidelity.account', JSON.stringify(account)); values.set('fidelity.token.member', 'ancien-demo')
  await api.ensureSession('member'); await api.ensureSession('member')
  assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith('/auth/me'))
  assert.equal(calls[0].options.headers.Authorization, 'Bearer ' + account.token)
})
test('Mode Resend : la démo automatique ne demande aucun magic-link', async t => {
  const { api, calls } = await fixture(t, async () => [{ emailEnabled: true }])
  await assert.rejects(api.ensureSession('member'), /Connecte-toi/)
  assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith('/auth/config'))
})
test('Session expirée : nettoyage et retour à la connexion démo sans clé', async t => {
  const { api, values, calls } = await fixture(t, async url => {
    if (url.endsWith('/auth/config')) return [{ emailEnabled: false }]
    if (url.endsWith('/auth/magic-link')) return [{ devLink: 'http://localhost:3001/auth/verify?token=demo-magic' }]
    return [{ token: account.token }]
  })
  values.set('fidelity.account', JSON.stringify({ ...account, token: token(Date.now() - 100) }))
  values.set('fidelity.token.member', 'expired')
  await api.ensureSession('member')
  assert.equal(api.getAccount(), null)
  assert.equal(values.get('fidelity.token.member'), account.token)
  assert.equal(calls.length, 3)
})
test('Refus 401 du compte réel : déconnexion sans opération avec un autre compte', async t => {
  const { api, values, calls } = await fixture(t, async () => [{ error: 'Session expirée' }, 401])
  values.set('fidelity.account', JSON.stringify(account))
  await assert.rejects(api.ensureSession('member'))
  assert.equal(api.getAccount(), null); assert.equal(values.has('fidelity.token.member'), false)
  assert.equal(calls.length, 1)
})
test('Backend éteint : message français et compte existant conservé', async t => {
  const { api, values } = await fixture(t, async () => { throw new TypeError('fetch failed') })
  values.set('fidelity.account', JSON.stringify(account))
  await assert.rejects(api.requestLoginLink(account.user.email), /serveur est indisponible/)
  assert.deepEqual(api.getAccount(), account)
})
test('Déconnexion : aucun compte ni token membre/restaurateur ne subsiste', async t => {
  const { api, values } = await fixture(t, async () => [account])
  await api.completeLogin('magic-test')
  values.set('fidelity.token.restaurant', 'demo-owner')
  api.logoutAccount()
  assert.equal(api.getAccount(), null)
  assert.equal(values.size, 0)
})
test('Demande explicite : adresse normalisée, erreurs Resend restituées', async t => {
  const { api, calls } = await fixture(t, async () => [{ error: 'Impossible d’envoyer le lien pour le moment.' }, 502])
  await assert.rejects(api.requestLoginLink('  MEMBRE@example.com  '), /Impossible d’envoyer/)
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'membre@example.com' })
})
