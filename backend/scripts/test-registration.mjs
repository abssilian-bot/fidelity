import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { restaurantRegistrationRoutes } from '../dist/routes/restaurant-registration.js'
import { restaurantRoutes } from '../dist/routes/restaurants.js'
import { ledgerRoutes } from '../dist/routes/ledger.js'
import { registerAuth } from '../dist/lib/auth.js'
import { registerErrorHandler } from '../dist/lib/security.js'
import { signToken } from '../dist/lib/tokens.js'
import { validSiret, parseRegistry, lookupSiret, isConfiguredAdmin } from '../dist/lib/restaurant-registration.js'
const url = new URL(process.env.DATABASE_URL)
if (url.hostname !== '127.0.0.1' || !url.pathname.startsWith('/fidelity_security_')) throw new Error('Base de test locale isolée obligatoire')
const db = new PrismaClient(), app = Fastify(), registry = new Map()
let admin, owner, stranger, counter = 100
const siretPrefix = String(randomInt(900000000, 999999999))
const bearer = user => signToken({ sub: user.id, role: user.role }, 3600)
const request = (actor, method, path, body) => app.inject({ method, url: path, headers: actor ? { authorization: `Bearer ${typeof actor === 'string' ? actor : bearer(actor)}` } : {}, ...(body ? { payload: body } : {}) })
const createUser = (role = 'MEMBER') => db.user.create({ data: { role, email: `${randomUUID()}@registration.local` } })
function newSiret() { const prefix = siretPrefix + String(counter++).padStart(4, '0'); return [...'0123456789'].map(n => prefix + n).find(validSiret) }
function input(siret = newSiret()) { registry.set(siret, { state: 'FOUND', siret, active: true, legalName: 'Société de test', address: '10 RUE TEST 75001 PARIS', city: 'PARIS', postalCode: '75001', activity: '56.10A', checkedAt: new Date().toISOString() }); return { siret, tradingName: 'Table de test', cuisine: 'Bistrot', address: '10 rue Test', postalCode: '75001', city: 'Paris', contactName: 'Responsable test', contactRole: 'OWNER', phone: '01 23 45 67 89', website: '', message: '', authorized: true } }
const approval = { approve: true, authorityVerified: true, activityVerified: true, verificationNote: 'Test isolé : habilitation et activité contrôlées par canal indépendant.' }
async function submit(actor = owner, body = input()) { const response = await request(actor, 'POST', '/owner/applications', body); assert.equal(response.statusCode, 201, response.body); return response.json() }
before(async () => {
  admin = await createUser('ADMIN'); owner = await createUser(); stranger = await createUser()
  registerAuth(app, db); registerErrorHandler(app)
  restaurantRegistrationRoutes(app, db, async siret => registry.get(siret) || { state: 'NOT_FOUND', siret, checkedAt: new Date().toISOString() })
  restaurantRoutes(app, db); ledgerRoutes(app, db)
  await app.ready()
})
after(async () => { await app.close(); await db.$disconnect() })

test('SIRET : longueur, lettres, checksum et zéro intégral refusés', () => {
  assert.equal(validSiret(newSiret()), true)
  for (const value of ['00000000000000', '12345678901234', 'abcdefghijklmz', '123456789']) assert.equal(validSiret(value), false)
})
test('Annuaire : seul le SIRET exact est retenu, jamais un siège ou SIREN approchant', () => {
  const siret = newSiret(), other = newSiret()
  const data = { results: [{ nom_complet: 'Test', etat_administratif: 'A', siege: { siret: other, etat_administratif: 'A' }, matching_etablissements: [{ siret, etat_administratif: 'A', activite_principale: '56.10A', adresse: 'Paris' }] }] }
  assert.equal(parseRegistry(siret, data).active, true)
  assert.equal(parseRegistry(newSiret(), data).state, 'NOT_FOUND')
  data.results[0].etat_administratif = 'C'; assert.equal(parseRegistry(siret, data).active, false)
})
test('Panne annuaire : aucun résultat actif inventé', async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => { throw new Error('hors ligne') }
  try { assert.equal((await lookupSiret(newSiret())).state, 'UNAVAILABLE') } finally { globalThis.fetch = original }
})
test('Administrateur configuré : correspondance e-mail exacte, sans sous-chaîne', () => {
  const original = process.env.FIDELITY_ADMIN_EMAILS; process.env.FIDELITY_ADMIN_EMAILS = 'Admin@exemple.fr'
  try { assert.equal(isConfiguredAdmin('admin@exemple.fr'), true); assert.equal(isConfiguredAdmin('admin@exemple.fr.faux.com'), false) }
  finally { if (original === undefined) delete process.env.FIDELITY_ADMIN_EMAILS; else process.env.FIDELITY_ADMIN_EMAILS = original }
})
test('Inscription, dossiers et annuaire nécessitent une session', async () => {
  for (const [method, path, body] of [['POST', '/owner/applications', input()], ['GET', '/owner/applications'], ['GET', '/owner/registration/siret/' + newSiret()], ['GET', '/admin/restaurant-applications']]) assert.equal((await request(null, method, path, body)).statusCode, 401)
})
test('Champs privilégiés injectés et attestation absente refusés', async () => {
  const user = await createUser(), data = input()
  for (const injected of [{ ...data, status: 'APPROVED' }, { ...data, ownerId: admin.id }, { ...data, registry: { active: true } }, { ...data, authorized: false }]) assert.equal((await request(user, 'POST', '/owner/applications', injected)).statusCode, 400)
})
test('La soumission ne donne aucun restaurant, rôle ou droit de scanner', async () => {
  const actor = await createUser(), data = input(), dossier = await submit(actor, data)
  assert.equal(dossier.status, 'PENDING'); assert.equal(dossier.restaurant, null)
  assert.equal((await db.user.findUnique({ where: { id: actor.id } })).role, 'MEMBER')
  assert.equal((await request(actor, 'GET', '/owner/restaurants')).json().length, 0)
  assert.equal((await request(actor, 'GET', '/scan/fc1_' + 'x'.repeat(32))).statusCode, 404)
  assert.equal(await db.restaurant.count({ where: { siret: data.siret } }), 0)
})
test('Double soumission simultanée : un seul dossier', async () => {
  const actor = await createUser(), data = input()
  const results = await Promise.all([submit(actor, data), submit(actor, data)])
  assert.equal(results[0].id, results[1].id)
})
test('Dossiers privés : un autre compte ne voit et ne corrige rien', async () => {
  const data = input(), dossier = await submit(await createUser(), data)
  assert.ok((await request(stranger, 'GET', '/owner/applications')).json().every(item => item.id !== dossier.id))
  assert.equal((await request(stranger, 'PUT', `/owner/applications/${dossier.id}`, data)).statusCode, 404)
})
test('Auto-validation et rôle ADMIN falsifié refusés', async () => {
  const dossier = await submit(await createUser())
  for (const actor of [owner, signToken({ sub: owner.id, role: 'ADMIN' }, 3600)]) {
    assert.equal((await request(actor, 'GET', '/admin/restaurant-applications')).statusCode, 403)
    assert.equal((await request(actor, 'POST', `/admin/restaurant-applications/${dossier.id}/decision`, approval)).statusCode, 403)
  }
})
test('Approbation : attestation indépendante et trace privée obligatoires', async () => {
  const dossier = await submit(await createUser())
  for (const body of [{ approve: true }, { ...approval, verificationNote: 'ok' }, { ...approval, authorityVerified: false }]) assert.equal((await request(admin, 'POST', `/admin/restaurant-applications/${dossier.id}/decision`, body)).statusCode, 400)
})
test('Annuaire indisponible : dossier conservé, approbation bloquée', async () => {
  const actor = await createUser(), data = input(); registry.set(data.siret, { state: 'UNAVAILABLE', siret: data.siret, checkedAt: new Date().toISOString() })
  const dossier = await submit(actor, data)
  assert.equal(dossier.registry.state, 'UNAVAILABLE')
  assert.equal((await request(admin, 'POST', `/admin/restaurant-applications/${dossier.id}/decision`, approval)).statusCode, 409)
})
test('Établissement fermé refusé, relecture du registre avant approbation', async () => {
  const actor = await createUser(), data = input(), dossier = await submit(actor, data)
  registry.get(data.siret).active = false
  assert.equal((await request(admin, 'POST', `/admin/restaurant-applications/${dossier.id}/decision`, approval)).statusCode, 409)
  assert.equal((await request(await createUser(), 'POST', '/owner/applications', data)).statusCode, 422)
})
test('Validation admin rattache le bon compte, programme inactif et trace privée non publiée', async () => {
  const actor = await createUser(), data = input(), dossier = await submit(actor, data)
  const response = await request(admin, 'POST', `/admin/restaurant-applications/${dossier.id}/decision`, approval)
  assert.equal(response.statusCode, 200, response.body)
  const approved = response.json(); assert.equal(approved.status, 'APPROVED')
  const restaurant = await db.restaurant.findUnique({ where: { id: approved.restaurant.id }, include: { program: true } })
  assert.equal(restaurant.ownerId, actor.id); assert.equal(restaurant.address, registry.get(data.siret).address); assert.equal(restaurant.program.active, false)
  assert.equal((await db.user.findUnique({ where: { id: actor.id } })).role, 'RESTAURANT')
  const mine = (await request(actor, 'GET', '/owner/applications')).json()[0]
  assert.equal(mine.verificationNote, undefined); assert.equal(mine.reviewHistory, undefined)
  const publicPage = (await request(null, 'GET', '/restaurants/' + restaurant.slug)).json()
  for (const field of ['siret', 'phone', 'contactName', 'ownerId', 'application']) assert.equal(publicPage[field], undefined)
  assert.equal((await request(actor, 'PUT', '/restaurants/' + restaurant.id, { address: 'Autre adresse' })).statusCode, 409)
})
test('Deux dossiers concurrents : impossible de revendiquer le même SIRET', async () => {
  const data = input(), a = await submit(await createUser(), data), b = await submit(await createUser(), data)
  const results = await Promise.all([a, b].map(item => request(admin, 'POST', `/admin/restaurant-applications/${item.id}/decision`, approval)))
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]); assert.equal(await db.restaurant.count({ where: { siret: data.siret } }), 1)
})
test('Refus motivé, correction par le demandeur et audit de la décision conservé', async () => {
  const actor = await createUser(), data = input(), dossier = await submit(actor, data)
  assert.equal((await request(admin, 'POST', `/admin/restaurant-applications/${dossier.id}/decision`, { approve: false, reason: 'Merci de préciser votre mandat de gestion.' })).statusCode, 200)
  const corrected = await request(actor, 'PUT', `/owner/applications/${dossier.id}`, { ...data, message: 'Mandat précisé pour le contrôle.' })
  assert.equal(corrected.statusCode, 200); assert.equal(corrected.json().status, 'PENDING')
  const stored = await db.restaurantApplication.findUnique({ where: { id: dossier.id } }); assert.equal(stored.reviewHistory.length, 1)
})
test('RLS active sur les dossiers professionnels', async () => {
  const rows = await db.$queryRaw`SELECT relrowsecurity FROM pg_class WHERE relname = 'RestaurantApplication'`
  assert.equal(rows[0].relrowsecurity, true)
})
