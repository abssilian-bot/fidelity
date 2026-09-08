// Tests Wallet sur PostgreSQL local jetable. Aucun certificat Apple ni appel APNs réel.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID, verify } from 'node:crypto'
import forge from 'node-forge'
import { unzipSync } from 'fflate'
import Fastify from 'fastify'
import { PrismaClient } from '@prisma/client'
import { registerAuth } from '../dist/lib/auth.js'
import { signToken } from '../dist/lib/tokens.js'
import { registerErrorHandler } from '../dist/lib/security.js'
import { walletRoutes } from '../dist/routes/wallet.js'
import { ledgerRoutes } from '../dist/routes/ledger.js'
import { membershipRoutes } from '../dist/routes/memberships.js'
import { restaurantRoutes } from '../dist/routes/restaurants.js'
import { walletConfig } from '../dist/lib/wallet.js'
import { deliverWalletUpdates } from '../dist/lib/wallet-push.js'
import { markWalletChanged } from '../dist/lib/wallet-updates.js'

const db = new URL(process.env.DATABASE_URL)
if (!['127.0.0.1', 'localhost'].includes(db.hostname) || !db.pathname.startsWith('/fidelity_security_')) throw new Error('Base fidelity_security_* locale obligatoire.')
const prisma = new PrismaClient(), app = Fastify({ routerOptions: { maxParamLength: 200 } })
let owner, outsider, member, place, card, wallet, config, enabled = true
const device = 'test-device-' + randomUUID(), pushToken = 'a'.repeat(64)
const auth = user => ({ authorization: `Bearer ${signToken({ sub: user.id, role: user.role }, 3600)}` })
const request = (method, url, actor, payload, extra = {}) => app.inject({ method, url, headers: { ...(actor ? auth(actor) : {}), ...extra }, ...(payload === undefined ? {} : { payload }) })
const passAuth = () => ({ authorization: `ApplePass ${wallet.authenticationToken}` })
const passPath = () => `/wallet/v1/passes/${config.passTypeIdentifier}/${wallet.id}`
const registrations = () => `/wallet/v1/devices/${device}/registrations/${config.passTypeIdentifier}`
const scan = async (actor = owner) => request('POST', '/wallet/scan', actor, { code: wallet.barcode, restaurantId: place.id })
async function mintDownload(actor = member) { return request('POST', `/memberships/${card.id}/wallet`, actor, {}) }
function certs() {
  const keys = forge.pki.rsa.generateKeyPair(2048), cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey; cert.serialNumber = '01'; cert.validity.notBefore = new Date(Date.now() - 1000); cert.validity.notAfter = new Date(Date.now() + 86400000)
  const name = [{ name: 'commonName', value: 'TEST LOCAL UNIQUEMENT' }]
  cert.setSubject(name); cert.setIssuer(name); cert.sign(keys.privateKey, forge.md.sha256.create())
  const pem = Buffer.from(forge.pki.certificateToPem(cert))
  return { wwdr: pem, signerCert: pem, signerKey: Buffer.from(forge.pki.privateKeyToPem(keys.privateKey)) }
}
before(async () => {
  config = { passTypeIdentifier: 'pass.test.fidelity', teamIdentifier: 'TESTTEAM01', webServiceURL: 'https://wallet.test/wallet', appURL: 'https://wallet.test/', certificates: certs() }
  const user = role => prisma.user.create({ data: { role, email: randomUUID() + '@wallet.local', displayName: 'Test Wallet' } })
  owner = await user('RESTAURANT'); outsider = await user('RESTAURANT'); member = await user('MEMBER')
  place = await prisma.restaurant.create({ data: { ownerId: owner.id, name: 'Bistrot test', slug: 'wallet-' + randomUUID(), status: 'VERIFIED', cuisine: 'Bistrot', address: 'Test', hours: [], diets: [], program: { create: { type: 'STAMPS', title: 'Carte', target: 5, reward: 'Dessert', rule: 'Une visite, une coche' } } } })
  card = await prisma.membership.create({ data: { userId: member.id, restaurantId: place.id, publicCode: randomUUID() } })
  registerAuth(app, prisma); registerErrorHandler(app)
  walletRoutes(app, prisma, () => enabled ? config : null); ledgerRoutes(app, prisma); membershipRoutes(app, prisma); restaurantRoutes(app, prisma)
})
after(async () => { await app.close(); await prisma.$disconnect() })

test('Configuration absente : Wallet désactivé, API utilisable', async () => {
  enabled = false
  assert.deepEqual((await request('GET', '/wallet/status')).json(), { enabled: false })
  assert.equal((await mintDownload()).statusCode, 503)
  assert.equal((await request('GET', '/memberships/mine', member)).statusCode, 200)
  enabled = true
  assert.equal(walletConfig(), null)
})
test('Export privé : pas de session ou carte d’un autre compte refusés', async () => {
  assert.equal((await request('POST', `/memberships/${card.id}/wallet`, null, {})).statusCode, 401)
  assert.equal((await mintDownload(outsider)).statusCode, 404)
})
test('Export répété : même pass, QR permanent et secret stables', async () => {
  const first = await mintDownload(); assert.equal(first.statusCode, 200, first.body)
  wallet = await prisma.walletPass.findUniqueOrThrow({ where: { membershipId: card.id } })
  await mintDownload()
  const second = await prisma.walletPass.findUniqueOrThrow({ where: { membershipId: card.id } })
  assert.equal(second.id, wallet.id); assert.equal(second.authenticationToken, wallet.authenticationToken); assert.equal(second.barcode, wallet.barcode)
})
test('Fichier pkpass : champs, manifeste et véritable signature PKCS7', async () => {
  const link = new URL((await mintDownload()).json().url)
  const response = await request('GET', link.pathname + link.search)
  assert.equal(response.statusCode, 200, response.body.slice(0, 100))
  assert.match(response.headers['content-type'], /application\/vnd.apple.pkpass/)
  const files = unzipSync(response.rawPayload), pass = JSON.parse(Buffer.from(files['pass.json']).toString()), manifest = JSON.parse(Buffer.from(files['manifest.json']).toString())
  assert.equal(pass.serialNumber, wallet.id); assert.equal(pass.webServiceURL, config.webServiceURL)
  assert.equal(pass.barcodes[0].message, `fidelity:wallet:${wallet.barcode}`)
  assert.equal(pass.storeCard.primaryFields[0].value, 0)
  assert.equal(JSON.stringify(pass).includes(member.email), false)
  for (const [name, hash] of Object.entries(manifest)) assert.equal(createHash('sha1').update(files[name]).digest('hex'), hash, name)
  const message = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(Buffer.from(files.signature).toString('binary')))
  assert.equal(message.certificates.length, 2)
  // Vérifie la signature des attributs authentifiés, sans faire confiance au simple nom du fichier.
  const signedData = forge.asn1.fromDer(Buffer.from(files.signature).toString('binary')).value[1].value[0]
  const signer = signedData.value.at(-1).value[0]
  const attrs = signer.value.find(item => item.tagClass === 128 && item.type === 0)
  const encoded = forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs.value)).getBytes()
  const signature = signer.value.findLast(item => item.tagClass === 0 && item.type === forge.asn1.Type.OCTETSTRING).value
  assert.equal(verify('sha1', Buffer.from(encoded, 'binary'), config.certificates.signerCert, Buffer.from(signature, 'binary')), true)
})
test('Lien expiré ou token de session utilisé pour télécharger : refus', async () => {
  for (const token of [signToken({ scope: 'wallet-download', passId: wallet.id, userId: member.id }, -1), signToken({ sub: member.id, role: 'MEMBER' }, 60)]) assert.equal((await request('GET', '/wallet/download?token=' + token)).statusCode, 401)
})
test('Autre restaurateur ou membre : scan Wallet interdit', async () => {
  assert.equal((await scan(outsider)).statusCode, 403); assert.equal((await scan(member)).statusCode, 403)
  assert.equal((await request('POST', '/ledger/earn', owner, { code: wallet.barcode, restaurantId: place.id, delta: 1, idempotencyKey: randomUUID() })).statusCode, 400)
})
test('QR Wallet : session courte liée au restaurateur, crédit unique et aucun retrait', async () => {
  const result = await scan(); assert.equal(result.statusCode, 200, result.body)
  const { code, earnOnly, expiresAt } = result.json()
  assert.ok(earnOnly); assert.match(code, /^fc1_/); assert.ok(Date.parse(expiresAt) - Date.now() <= 120000)
  assert.equal((await request('POST', '/ledger/redeem', owner, { code, restaurantId: place.id, idempotencyKey: randomUUID() })).statusCode, 403)
  assert.equal((await request('POST', '/ledger/adjust', owner, { code, restaurantId: place.id, delta: 1, note: 'test', idempotencyKey: randomUUID() })).statusCode, 403)
  const input = { code, restaurantId: place.id, delta: 2, idempotencyKey: randomUUID() }
  const replies = await Promise.all([request('POST', '/ledger/earn', owner, input), request('POST', '/ledger/earn', owner, input)])
  assert.deepEqual(replies.map(reply => reply.statusCode).sort(), [200, 201]); assert.equal(replies[0].json().id, replies[1].json().id)
  assert.equal((await request('POST', '/ledger/earn', owner, { ...input, idempotencyKey: randomUUID() })).statusCode, 409)
  const changed = await prisma.walletPass.findUniqueOrThrow({ where: { id: wallet.id } })
  assert.ok(changed.version > wallet.version)
  const latest = unzipSync((await request('GET', passPath(), null, undefined, passAuth())).rawPayload)
  assert.equal(JSON.parse(Buffer.from(latest['pass.json']).toString()).storeCard.primaryFields[0].value, 2)
})
test('QR Wallet : session expirée refusée sans nouveau crédit', async () => {
  const code = (await scan()).json().code
  await prisma.cardPresentation.update({ where: { id: code }, data: { expiresAt: new Date(0) } })
  assert.equal((await request('POST', '/ledger/earn', owner, { code, restaurantId: place.id, delta: 1, idempotencyKey: randomUUID() })).statusCode, 409)
})
test('Inscription Apple : secret obligatoire, réponses 201 puis 200 et appareil pseudonymisé', async () => {
  const path = registrations() + '/' + wallet.id
  assert.equal((await request('POST', path, null, { pushToken })).statusCode, 401)
  assert.equal((await request('POST', path, null, { pushToken }, passAuth())).statusCode, 201)
  assert.equal((await request('POST', path, null, { pushToken }, passAuth())).statusCode, 200)
  const reg = await prisma.walletRegistration.findFirstOrThrow({ where: { passId: wallet.id } })
  assert.notEqual(reg.deviceHash, device)
})
test('Liste Apple : uniquement cartes de l’appareil, curseur puis 204', async () => {
  const result = await request('GET', registrations()); assert.equal(result.statusCode, 200)
  assert.deepEqual(result.json().serialNumbers, [wallet.id])
  assert.equal((await request('GET', registrations() + '?passesUpdatedSince=' + result.json().lastUpdated)).statusCode, 204)
  assert.equal((await request('GET', registrations().replace(device, 'unknown-device-1234'))).statusCode, 204)
})
test('Dernière carte : mauvais secret refusé, ETag valide 304, nouveau solde 200', async () => {
  assert.equal((await request('GET', passPath())).statusCode, 401)
  const result = await request('GET', passPath(), null, undefined, passAuth())
  assert.equal((await request('GET', passPath(), null, undefined, { ...passAuth(), 'if-none-match': result.headers.etag })).statusCode, 304)
  await prisma.$transaction(tx => markWalletChanged(tx, card.id))
  assert.equal((await request('GET', passPath(), null, undefined, { ...passAuth(), 'if-none-match': result.headers.etag, 'if-modified-since': new Date(Date.now() + 10000).toUTCString() })).statusCode, 200)
})
test('Modification du programme : nouvelle version et récompense actualisée', async () => {
  const previous = await prisma.walletPass.findUniqueOrThrow({ where: { id: wallet.id } })
  const result = await request('PUT', `/restaurants/${place.id}/program`, owner, { type: 'STAMPS', title: 'Carte', target: 8, reward: 'Menu offert', rule: 'Une coche par visite' })
  assert.equal(result.statusCode, 200, result.body)
  assert.ok((await prisma.walletPass.findUniqueOrThrow({ where: { id: wallet.id } })).version > previous.version)
  const files = unzipSync((await request('GET', passPath(), null, undefined, passAuth())).rawPayload)
  assert.equal(JSON.parse(Buffer.from(files['pass.json']).toString()).storeCard.secondaryFields[0].value, 'Menu offert')
})
test('Programme suspendu : carte voided, export et crédit refusés', async () => {
  await prisma.loyaltyProgram.update({ where: { restaurantId: place.id }, data: { active: false } })
  assert.equal((await mintDownload()).statusCode, 409); assert.equal((await scan()).statusCode, 409)
  const files = unzipSync((await request('GET', passPath(), null, undefined, passAuth())).rawPayload)
  assert.equal(JSON.parse(Buffer.from(files['pass.json']).toString()).voided, true)
  await prisma.loyaltyProgram.update({ where: { restaurantId: place.id }, data: { active: true } })
})
test('APNs indisponible : crédit conservé, nouvelle tentative planifiée', async () => {
  await deliverWalletUpdates(prisma, config, async () => 503)
  const result = await prisma.walletPass.findUniqueOrThrow({ where: { id: wallet.id } })
  assert.ok(result.version > result.pushedVersion); assert.ok(result.nextPushAt.getTime() > Date.now()); assert.equal(result.pushFailures, 1)
})
test('APNs rétabli : version distribuée, aucun envoi répété sans changement', async () => {
  await prisma.walletPass.update({ where: { id: wallet.id }, data: { nextPushAt: new Date(0) } })
  let sends = 0
  await deliverWalletUpdates(prisma, config, async value => { assert.equal(value, pushToken); sends++; return 200 })
  const result = await prisma.walletPass.findUniqueOrThrow({ where: { id: wallet.id } })
  assert.equal(result.version, result.pushedVersion); assert.equal(sends, 1)
  await deliverWalletUpdates(prisma, config, async () => { sends++; return 200 }); assert.equal(sends, 1)
})
test('Changement pendant un envoi APNs : reste dans la file', async () => {
  await prisma.$transaction(tx => markWalletChanged(tx, card.id))
  await deliverWalletUpdates(prisma, config, async () => { await prisma.$transaction(tx => markWalletChanged(tx, card.id)); return 200 })
  const result = await prisma.walletPass.findUniqueOrThrow({ where: { id: wallet.id } })
  assert.ok(result.version > result.pushedVersion)
})
test('Appareil désinscrit : plus aucun push ni carte listée', async () => {
  assert.equal((await request('DELETE', registrations() + '/' + wallet.id, null, undefined, passAuth())).statusCode, 200)
  assert.equal((await request('GET', registrations())).statusCode, 204)
  await deliverWalletUpdates(prisma, config, async () => { assert.fail('Appareil désinscrit contacté') })
})
