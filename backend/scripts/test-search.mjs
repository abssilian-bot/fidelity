import test from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { memberSearchRoutes } from '../dist/routes/member-search.js'
import { restaurantRoutes } from '../dist/routes/restaurants.js'
import { registerErrorHandler } from '../dist/lib/security.js'
import { foodCategoryIds } from '../dist/lib/search-profile.js'
import { FOOD_CATEGORIES } from '../../app/src/lib/search-catalog.ts'

test('Le catalogue est identique côté client et serveur', () => assert.deepEqual(foodCategoryIds, FOOD_CATEGORIES.map((category) => category.id)))

async function memberApi(t, queryResult = []) {
  const app = Fastify()
  const calls = []
  const tx = { $executeRaw: async () => 0, $queryRaw: async (sql) => { calls.push(sql); return queryResult } }
  memberSearchRoutes(app, { $transaction: async (callback) => callback(tx), user: { findFirst: async (args) => { calls.push(args); return null } } })
  registerErrorHandler(app)
  t.after(() => app.close())
  return { app, calls }
}
test('Une requête vide ou trop courte ne parcourt pas les comptes', async (t) => {
  const { app, calls } = await memberApi(t)
  for (const q of ['', '@', 'a']) assert.deepEqual((await app.inject('/members/search?q=' + encodeURIComponent(q))).json(), [])
  assert.equal(calls.length, 0)
})
test('Recherche de pseudo normalisée, bornée et paramétrée', async (t) => {
  const { app, calls } = await memberApi(t)
  const response = await app.inject('/members/search?q=' + encodeURIComponent('@Léa'))
  assert.equal(response.statusCode, 200)
  assert.ok(calls[0].values.includes('lea'))
  assert.ok(calls[0].sql.includes('LIMIT 50'))
  assert.ok(!calls[0].sql.includes('"email"'))
  assert.ok(!calls[0].sql.includes('Membership'))
  assert.ok(!calls[0].sql.includes('lea'))
})
test('Tous les mots du nom sont utilisés comme critères', async (t) => {
  const { app, calls } = await memberApi(t)
  await app.inject('/members/search?q=robert%20camille')
  assert.ok(calls[0].values.includes('%robert%'))
  assert.ok(calls[0].values.includes('%camille%'))
  assert.ok(calls[0].sql.includes(' AND '))
})
test('Les entrées trop longues sont rejetées avant SQL', async (t) => {
  const { app, calls } = await memberApi(t)
  assert.equal((await app.inject('/members/search?q=' + 'a'.repeat(161))).statusCode, 400)
  assert.equal(calls.length, 0)
})
test('Un profil absent répond 404, sans compte de remplacement', async (t) => {
  const { app, calls } = await memberApi(t)
  assert.equal((await app.inject('/members/inconnu')).statusCode, 404)
  assert.equal(calls[0].select.email, undefined)
  assert.equal(calls[0].select.memberships, undefined)
  assert.equal(calls[0].select.posts.where.status, 'PUBLISHED')
  assert.equal(calls[0].select._count.select.followers, true)
  assert.equal(calls[0].select._count.select.following, true)
})

async function restaurantApi(t, owner = 'owner') {
  const app = Fastify()
  const writes = []
  app.decorate('authenticate', async (req) => { req.userId = 'owner'; req.userRole = 'RESTAURANT' })
  const db = { $executeRaw: async () => 0, $transaction: async callback => callback(db), restaurant: {
    findUnique: async () => ({ id: 'resto', ownerId: owner }),
    update: async (args) => { writes.push(args); return { id: 'resto', ...args.data } },
  } }
  restaurantRoutes(app, db)
  registerErrorHandler(app)
  t.after(() => app.close())
  return { app, writes }
}
test('Les nouveaux critères traversent la route de publication', async (t) => {
  const { app, writes } = await restaurantApi(t)
  const payload = { foodTags: ['burger'], services: ['terrasse'], avgPrice: 17.5, maxGuests: 6,
    hours: [{ day: 'samedi', open: '20:00', close: '02:00' }] }
  const response = await app.inject({ method: 'PUT', url: '/restaurants/resto', payload })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(writes[0].data, payload)
  assert.deepEqual(response.json().foodTags, ['burger'])
})
test('Les tags inventés, prix négatifs et heures invalides sont refusés', async (t) => {
  const { app, writes } = await restaurantApi(t)
  for (const payload of [{ foodTags: ['tag-inconnu'] }, { avgPrice: -2 }, { maxGuests: 2.5 }, { hours: [{ day: 'samedi', open: '28:00', close: '02:00' }] }]) {
    assert.equal((await app.inject({ method: 'PUT', url: '/restaurants/resto', payload })).statusCode, 400)
  }
  assert.equal(writes.length, 0)
})
test('Un autre restaurateur ne peut pas changer les critères', async (t) => {
  const { app, writes } = await restaurantApi(t, 'someone-else')
  assert.equal((await app.inject({ method: 'PUT', url: '/restaurants/resto', payload: { foodTags: ['burger'] } })).statusCode, 403)
  assert.equal(writes.length, 0)
})
