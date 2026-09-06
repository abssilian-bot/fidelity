import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerErrorHandler } from '../dist/lib/security.js'

process.env.APP_SECRET = 'local-test-memberships-secret-not-for-production'
const { registerAuth } = await import('../dist/lib/auth.js')
const { signToken } = await import('../dist/lib/tokens.js')
const { membershipRoutes } = await import('../dist/routes/memberships.js')
const headers = { authorization: `Bearer ${signToken({ sub: 'member-test', role: 'MEMBER' }, 60)}` }

async function fixture(t, { restaurant = { id: 'resto-test', program: { active: true } }, balance = 0 } = {}) {
  const app = Fastify()
  registerAuth(app, { user: { findUnique: async () => ({ role: 'MEMBER' }) }, revokedSession: { findUnique: async () => null } }); registerErrorHandler(app)
  const calls = []
  let saved
  membershipRoutes(app, {
    ledgerEntry: { aggregate: async () => ({ _sum: { delta: balance } }) },
    restaurant: { findFirst: async args => { calls.push(['restaurant', args]); return restaurant } },
    membership: {
      upsert: async args => {
        calls.push(['upsert', args]); saved ??= { id: 'card-test', publicCode: args.create.publicCode, restaurant: { slug: 'chez-amina' } }
        return { ...saved, entries: balance ? [{ balanceAfter: balance }] : [] }
      },
      findMany: async args => { calls.push(['mine', args]); return [{ id: 'card-test', restaurant: { slug: 'chez-amina' }, entries: [{ balanceAfter: balance }] }] },
    },
  })
  t.after(() => app.close())
  const add = (extra = {}) => app.inject({ method: 'POST', url: '/memberships', headers, payload: { slug: 'chez-amina' }, ...extra })
  return { app, add, calls }
}

test('Une adhésion exige une session valide', async t => {
  const { add, calls } = await fixture(t)
  assert.equal((await add({ headers: {} })).statusCode, 401)
  assert.equal(calls.length, 0)
})
test('Un nouvel ajout commence à zéro et ne crée aucune écriture de points', async t => {
  const { add, calls } = await fixture(t)
  const result = await add()
  assert.equal(result.statusCode, 201); assert.equal(result.json().balance, 0)
  const write = calls.find(([kind]) => kind === 'upsert')[1]
  assert.deepEqual(write.where, { userId_restaurantId: { userId: 'member-test', restaurantId: 'resto-test' } })
  assert.deepEqual(Object.keys(write.create).sort(), ['publicCode', 'restaurantId', 'userId'])
})
test('Un rejeu conserve la carte et son solde existant', async t => {
  const { add, calls } = await fixture(t, { balance: 7 })
  const first = (await add()).json(), second = (await add()).json()
  assert.equal(first.id, second.id); assert.equal(first.publicCode, second.publicCode); assert.equal(second.balance, 7)
  for (const [, args] of calls.filter(([kind]) => kind === 'upsert')) {
    assert.deepEqual(args.update, {})
    assert.deepEqual(args.select.entries.where, { status: 'CONFIRMED' })
  }
})
test('Un restaurant absent ou un programme inactif refuse l’ajout', async t => {
  for (const [restaurant, status] of [[null, 404], [{ id: 'r', program: null }, 409], [{ id: 'r', program: { active: false } }, 409]]) {
    const { add, calls } = await fixture(t, { restaurant })
    assert.equal((await add()).statusCode, status)
    assert.equal(calls.filter(([kind]) => kind === 'upsert').length, 0)
  }
})
test('Mes cartes est limité au membre connecté et aux soldes confirmés', async t => {
  const { app, calls } = await fixture(t, { balance: 4 })
  const response = await app.inject({ method: 'GET', url: '/memberships/mine', headers })
  assert.equal(response.statusCode, 200); assert.equal(response.json()[0].balance, 4)
  const query = calls.find(([kind]) => kind === 'mine')[1]
  assert.deepEqual(query.where, { userId: 'member-test' })
  assert.deepEqual(query.select.entries.where, { status: 'CONFIRMED' })
})
