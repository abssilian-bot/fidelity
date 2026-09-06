// Tests offensifs réservés à une base locale jetable, jamais aux comptes réels.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { signToken } from '../dist/lib/tokens.js'
const base = process.env.TEST_API_URL
const db = new URL(process.env.DATABASE_URL)
if (!base || !['127.0.0.1', 'localhost'].includes(new URL(base).hostname) || !['127.0.0.1', 'localhost'].includes(db.hostname) || !db.pathname.startsWith('/fidelity_security_')) throw new Error('Ces tests exigent une base fidelity_security_* et une API locales.')
const prisma = new PrismaClient()
let owner, otherOwner, member, otherMember, restaurant, otherRestaurant, card
const token = user => signToken({ sub: user.id, role: user.role }, 3600)
async function user(role = 'MEMBER') { return prisma.user.create({ data: { email: `${randomUUID()}@security.local`, role, displayName: 'Compte de test' } }) }
async function newCard(client = member, place = restaurant) { return prisma.membership.create({ data: { userId: client.id, restaurantId: place.id, publicCode: randomUUID() } }) }
async function request(method, path, actor, body, extraHeaders = {}) {
  const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(actor ? { authorization: `Bearer ${typeof actor === 'string' ? actor : token(actor)}` } : {}), ...extraHeaders }, body: body === undefined ? method === 'POST' ? '{}' : undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json().catch(() => null), headers: response.headers }
}
async function qr(target = card, client = member) {
  const result = await request('POST', `/memberships/${target.id}/presentation`, client)
  assert.equal(result.status, 200, JSON.stringify(result.data))
  return result.data.code
}
function input(code, delta = 1, extra = {}) { return { code, restaurantId: restaurant.id, delta, idempotencyKey: randomUUID(), ...extra } }
async function balance(target = card) { return (await prisma.ledgerEntry.aggregate({ where: { membershipId: target.id, status: 'CONFIRMED' }, _sum: { delta: true } }))._sum.delta || 0 }
before(async () => {
  owner = await user('RESTAURANT'); otherOwner = await user('RESTAURANT'); member = await user(); otherMember = await user()
  async function place(ownerId) { return prisma.restaurant.create({ data: { ownerId, name: 'Audit', slug: 'audit-' + randomUUID(), status: 'VERIFIED', cuisine: 'Bistrot', address: 'Local', hours: [], diets: [], program: { create: { type: 'STAMPS', title: 'Audit', target: 5, reward: 'Dessert', rule: 'Une visite' } } }, include: { program: true } }) }
  restaurant = await place(owner.id); otherRestaurant = await place(otherOwner.id); card = await newCard()
})
after(() => prisma.$disconnect())

test('Routes privées : aucun accès sans session', async () => {
  for (const [method, path, body] of [['GET', '/owner/restaurants'], ['GET', '/memberships/mine'], ['GET', `/memberships/${card.id}/history`], ['POST', `/memberships/${card.id}/presentation`], ['GET', `/restaurants/${restaurant.id}/members`], ['PUT', `/restaurants/${restaurant.id}`, {}], ['PUT', `/restaurants/${restaurant.id}/menu`, { items: [] }], ['PUT', `/restaurants/${restaurant.id}/program`, {}], ['POST', '/ledger/earn', {}], ['POST', '/ledger/redeem', {}], ['POST', '/ledger/adjust', {}], ['GET', '/shares/mine'], ['GET', `/restaurants/${restaurant.id}/shares`], ['POST', '/auth/logout']]) {
    assert.equal((await request(method, path, null, body)).status, 401, path)
  }
})
test('Token falsifié, expiré, lien magique ou suffixe : refus', async () => {
  for (const bad of ['forged.token', token(member) + '.extra', signToken({ sub: member.id, role: 'MEMBER' }, -1), signToken({ scope: 'magic', email: member.email }, 300)]) assert.equal((await request('GET', '/memberships/mine', bad)).status, 401)
})
test('Le rôle ADMIN déclaré dans le token ne remplace pas le rôle en base', async () => {
  const forgedRole = signToken({ sub: member.id, role: 'ADMIN' }, 300)
  assert.equal((await request('GET', `/restaurants/${restaurant.id}/members`, forgedRole)).status, 403)
})
test('Suppression de compte et révocation serveur interdisent la réutilisation du Bearer', async () => {
  const client = await user(), bearer = token(client)
  assert.equal((await request('POST', '/auth/logout', bearer)).status, 200)
  assert.equal((await request('GET', '/memberships/mine', bearer)).status, 401)
  const deleted = await user(), old = token(deleted)
  await prisma.user.delete({ where: { id: deleted.id } })
  assert.equal((await request('GET', '/memberships/mine', old)).status, 401)
})
test('Carte et historique d’un autre membre : accès refusé', async () => {
  assert.equal((await request('POST', `/memberships/${card.id}/presentation`, otherMember)).status, 404)
  assert.equal((await request('GET', `/memberships/${card.id}/history`, otherMember)).status, 403)
  assert.equal((await request('GET', `/memberships/${card.id}/history`, otherOwner)).status, 403)
})
test('Façade, menu, programme et clients limités au propriétaire', async () => {
  const program = { type: 'STAMPS', target: 1, title: 'Fraude', reward: 'Tout', rule: 'Fraude' }
  for (const [path, method, body] of [[`/restaurants/${restaurant.id}`, 'PUT', { name: 'Volé' }], [`/restaurants/${restaurant.id}/menu`, 'PUT', { items: [] }], [`/restaurants/${restaurant.id}/program`, 'PUT', program], [`/restaurants/${restaurant.id}/members`, 'GET'], [`/restaurants/${restaurant.id}/shares`, 'GET']]) assert.equal((await request(method, path, otherOwner, body)).status, 403)
  const mine = await request('GET', '/owner/restaurants', otherOwner)
  assert.ok(mine.data.every(item => item.id !== restaurant.id))
})
test('Un membre ou un autre restaurateur ne peut ni scanner ni se créditer', async () => {
  const code = await qr()
  for (const actor of [member, otherOwner]) {
    assert.equal((await request('GET', `/scan/${code}`, actor)).status, 403)
    for (const operation of ['earn', 'redeem', 'adjust']) {
      const body = input(code, 1, operation === 'adjust' ? { note: 'Fraude' } : {})
      if (operation === 'redeem') delete body.delta
      assert.equal((await request('POST', `/ledger/${operation}`, actor, body)).status, 403)
    }
  }
  assert.equal(await balance(), 0)
})
test('L’établissement choisi doit correspondre au QR', async () => {
  assert.equal((await request('POST', '/ledger/earn', owner, input(await qr(), 1, { restaurantId: otherRestaurant.id }))).status, 409)
})
test('Code permanent, QR inventé et ancien QR expiré : aucun crédit', async () => {
  assert.equal((await request('POST', '/ledger/earn', owner, input(card.publicCode))).status, 400)
  assert.equal((await request('POST', '/ledger/earn', owner, input('fc1_' + 'x'.repeat(32)))).status, 404)
  const code = await qr()
  await prisma.cardPresentation.update({ where: { id: code }, data: { expiresAt: new Date(Date.now() - 1000) } })
  assert.equal((await request('POST', '/ledger/earn', owner, input(code))).status, 409)
  assert.equal(await balance(), 0)
})
test('Montants nuls, négatifs, décimaux, excessifs et champs injectés : refus', async () => {
  const code = await qr()
  for (const delta of [0, -1, 1.5, 11, 1001, '3']) assert.equal((await request('POST', '/ledger/earn', owner, input(code, delta))).status, 400)
  assert.equal((await request('POST', '/ledger/earn', owner, input(code, 1, { balanceAfter: 999 }))).status, 400)
  assert.equal((await request('POST', '/ledger/adjust', owner, input(code, 1, { note: '   ' }))).status, 400)
  assert.equal((await request('POST', '/ledger/earn', owner, input(code, 1, { idempotencyKey: 'foodshare:collision' }))).status, 400)
})
test('Deux validations simultanées du même QR : une seule écriture', async () => {
  const code = await qr()
  const results = await Promise.all([request('POST', '/ledger/earn', owner, input(code, 2)), request('POST', '/ledger/earn', owner, input(code, 2))])
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409])
  assert.equal(await balance(), 2)
})
test('Reprise après coupure : même référence, reçu identique, zéro double crédit', async () => {
  const body = input(await qr(), 1)
  const first = await request('POST', '/ledger/earn', owner, body)
  const replay = await request('POST', '/ledger/earn', owner, body)
  assert.equal(replay.status, 200); assert.equal(replay.data.id, first.data.id); assert.equal(replay.data.idempotentReplay, true)
  assert.equal((await request('POST', '/ledger/earn', owner, { ...body, delta: 2 })).status, 409)
  assert.equal(await balance(), 3)
})
test('Collision de référence entre cartes : pas de fuite et pas de crédit', async () => {
  const reference = randomUUID()
  await request('POST', '/ledger/earn', owner, input(await qr(), 1, { idempotencyKey: reference }))
  const second = await newCard(otherMember)
  const conflict = await request('POST', '/ledger/earn', owner, input(await qr(second, otherMember), 1, { idempotencyKey: reference }))
  assert.equal(conflict.status, 409); assert.equal(conflict.data.id, undefined); assert.equal(conflict.data.balanceAfter, undefined); assert.equal(await balance(second), 0)
})
test('Crédits concurrents différents : somme exacte et soldes cohérents', async () => {
  const client = await user(), target = await newCard(client)
  const codes = []
  for (let i = 0; i < 8; i++) codes.push(await qr(target, client))
  const results = await Promise.all(codes.map(code => request('POST', '/ledger/earn', owner, input(code))))
  assert.ok(results.every(result => result.status === 201), JSON.stringify(results))
  assert.deepEqual(results.map(result => result.data.balanceAfter).sort((a,b) => a-b), [1,2,3,4,5,6,7,8])
  assert.equal(await balance(target), 8)
})
test('Deux récompenses simultanées avec un solde pour une seule : un seul débit', async () => {
  const client = await user(), target = await newCard(client)
  await request('POST', '/ledger/earn', owner, input(await qr(target, client), 5))
  const codes = [await qr(target, client), await qr(target, client)]
  const results = await Promise.all(codes.map(code => request('POST', '/ledger/redeem', owner, { code, restaurantId: restaurant.id, idempotencyKey: randomUUID() })))
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]); assert.equal(await balance(target), 0)
  const accepted = results.find(result => result.status === 201)
  const code = codes[results.indexOf(accepted)]
  const replay = await request('POST', '/ledger/redeem', owner, { code, restaurantId: restaurant.id, idempotencyKey: accepted.data.idempotencyKey })
  assert.equal(replay.status, 200); assert.equal(replay.data.id, accepted.data.id)
})
test('Programme arrêté ou restaurant suspendu : scan et écritures bloqués', async () => {
  const code = await qr()
  await prisma.loyaltyProgram.update({ where: { restaurantId: restaurant.id }, data: { active: false } })
  assert.equal((await request('POST', '/ledger/earn', owner, input(code))).status, 409)
  await prisma.loyaltyProgram.update({ where: { restaurantId: restaurant.id }, data: { active: true } })
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { status: 'SUSPENDED' } })
  assert.equal((await request('GET', `/scan/${code}`, owner)).status, 409)
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { status: 'VERIFIED' } })
})
test('Le propriétaire ne peut pas se donner des points sur sa propre carte', async () => {
  const ownCard = await newCard(owner)
  assert.equal((await request('POST', '/ledger/earn', owner, input(await qr(ownCard, owner)))).status, 403)
})
test('Les programmes à points acceptent 1000 points, sans plafond artificiel à 100', async () => {
  const points = await prisma.restaurant.create({ data: { ownerId: owner.id, name: 'Points', slug: 'points-' + randomUUID(), status: 'VERIFIED', cuisine: 'Pizza', address: 'Local', hours: [], diets: [], program: { create: { type: 'POINTS', target: 1000, title: 'Points', reward: 'Pizza', rule: 'Points' } } } })
  const target = await newCard(member, points)
  const response = await request('POST', '/ledger/earn', owner, input(await qr(target), 1000, { restaurantId: points.id }))
  assert.equal(response.status, 201); assert.equal(await balance(target), 1000)
})
test('FoodShare : une seule publication par visite, y compris simultanément', async () => {
  const client = await user(), target = await newCard(client)
  await request('POST', '/ledger/earn', owner, input(await qr(target, client), 1))
  const body = { slug: restaurant.slug, imageUrl: '/images/table.webp', rating: 5, caption: 'Visite de test' }
  const result = await Promise.all([request('POST', '/shares', client, body), request('POST', '/shares', client, body)])
  assert.deepEqual(result.map(item => item.status).sort(), [201, 409])
  const post = result.find(item => item.status === 201).data
  const decisions = await Promise.all([request('POST', `/shares/${post.id}/decide`, owner, { publish: true, rewardDelta: 2 }), request('POST', `/shares/${post.id}/decide`, owner, { publish: false })])
  assert.deepEqual(decisions.map(item => item.status).sort(), [200, 409])
  const saved = await prisma.post.findUnique({ where: { id: post.id } })
  assert.equal(await balance(target), saved.status === 'PUBLISHED' ? 3 : 1)
})
test('Profil public sans pseudo : accessible depuis un post publié, sans données privées', async () => {
  const client = await user(), target = await newCard(client)
  assert.equal((await request('GET', `/members/${client.id}`)).status, 404)
  await request('POST', '/ledger/earn', owner, input(await qr(target, client), 1))
  const post = (await request('POST', '/shares', client, { slug: restaurant.slug, imageUrl: '/images/table.webp', rating: 5 })).data
  assert.equal((await request('GET', `/members/${client.id}`)).status, 404)
  assert.equal((await request('POST', `/shares/${post.id}/decide`, owner, { publish: true, rewardDelta: 0 })).status, 200)
  const feed = await request('GET', `/restaurants/${restaurant.slug}/shares/public`)
  const author = feed.data.find(item => item.id === post.id).author
  assert.equal(author.id, client.id)
  const profile = await request('GET', `/members/${author.id}`)
  assert.equal(profile.status, 200)
  assert.equal(profile.data.id, client.id)
  assert.equal(profile.data.pseudo, null)
  assert.deepEqual(profile.data.posts, [{ imageUrl: '/images/table.webp' }])
  for (const privateField of ['email', 'role', 'memberships', 'publicCode']) {
    assert.equal(privateField in author, false)
    assert.equal(privateField in profile.data, false)
  }
})
test('Erreur de crédit FoodShare : publication entièrement annulée', async () => {
  const client = await user(), target = await newCard(client)
  await request('POST', '/ledger/earn', owner, input(await qr(target, client), 1))
  const post = (await request('POST', '/shares', client, { slug: restaurant.slug, imageUrl: '/images/table.webp', rating: 4 })).data
  await prisma.ledgerEntry.create({ data: { membershipId: card.id, delta: 1, balanceAfter: 1, kind: 'ADJUST', source: 'test', authorId: owner.id, idempotencyKey: `foodshare:${post.id}` } })
  assert.equal((await request('POST', `/shares/${post.id}/decide`, owner, { publish: true })).status, 409)
  assert.equal((await prisma.post.findUnique({ where: { id: post.id } })).status, 'PENDING')
  assert.equal(await balance(target), 1)
})
test('URL de script ou donnée embarquée : refus sur images et liens publics', async () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,<script>x</script>', '//evil.example/x', 'file:///etc/passwd']) {
    assert.equal((await request('PUT', `/restaurants/${restaurant.id}`, owner, { deliverooUrl: bad })).status, 400)
    assert.equal((await request('POST', '/shares', member, { slug: restaurant.slug, imageUrl: bad, rating: 5 })).status, 400)
  }
})
test('Champs sensibles absents des routes publiques et réponses privées non mises en cache', async () => {
  const result = await request('GET', `/restaurants/${restaurant.slug}`)
  for (const field of ['ownerId', 'siret', 'email']) assert.equal(result.data[field], undefined)
  const mine = await request('GET', '/memberships/mine', member)
  assert.equal(mine.headers.get('cache-control'), 'no-store')
  assert.equal(mine.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(mine.headers.get('x-frame-options'), 'DENY')
})
test('Fichiers privés et traversées de chemin : aucune exposition', async () => {
  for (const path of ['/.env', '/backend/.env', '/.git/config', '/MIGRATION-CHATGPT.md', '/%2e%2e/%2e%2e/backend/.env']) {
    const result = await request('GET', path)
    assert.ok([400,403,404].includes(result.status), `${path}: ${result.status}`)
    assert.ok(!JSON.stringify(result.data).includes('DATABASE_URL='))
  }
})
test('Un corps trop gros est rejeté et une origine tierce n’est pas autorisée', async () => {
  assert.equal((await request('POST', '/auth/magic-link', null, { email: 'x'.repeat(70000) })).status, 413)
  const result = await request('GET', '/memberships/mine', member, undefined, { origin: 'https://evil.example' })
  assert.equal(result.headers.get('access-control-allow-origin'), null)
})

test('Tables protégées par RLS ; un rôle SQL public ne lit ni ne modifie le registre', async () => {
  const tables = await prisma.$queryRaw`SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN ('User', 'Membership', 'LedgerEntry', 'CardPresentation', 'RevokedSession')`
  assert.equal(tables.length, 5); assert.ok(tables.every(table => table.relrowsecurity))
  const role = 'audit_reader_' + Date.now()
  await prisma.$executeRawUnsafe(`CREATE ROLE "${role}" NOLOGIN`)
  try {
    for (const query of ['SELECT * FROM "User" LIMIT 1', 'UPDATE "LedgerEntry" SET "delta" = 100 WHERE false']) {
      await assert.rejects(prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`)
        await tx.$executeRawUnsafe(query)
      }), error => error.code === 'P2010' && error.meta?.code === '42501')
    }
  } finally { await prisma.$executeRawUnsafe(`DROP ROLE "${role}"`) }
})
