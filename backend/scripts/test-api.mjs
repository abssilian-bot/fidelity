// Test de bout en bout de l'API Fidelity — usage :
//   1. démarrer l'API (npm run dev)
//   2. node scripts/test-api.mjs
const BASE = 'http://localhost:3001'
let passed = 0, failed = 0

function check(name, condition, extra = '') {
  if (condition) { passed++; console.log(`  ✅ ${name}`) }
  else { failed++; console.log(`  ❌ ${name} ${extra}`) }
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function login(email) {
  const { data } = await call('POST', '/auth/magic-link', { body: { email } })
  const url = new URL(data.devLink)
  const verify = await call('GET', `/auth/verify?token=${url.searchParams.get('token')}`)
  return verify.data.token
}

console.log('\n── 1. Routes publiques ──')
{
  const health = await call('GET', '/health')
  check('GET /health répond ok', health.data?.status === 'ok')

  const list = await call('GET', '/restaurants')
  check('GET /restaurants → 6 restos', list.status === 200 && list.data.length === 6, `(reçu: ${list.data?.length})`)

  const halal = await call('GET', '/restaurants?diet=Halal')
  check('Filtre ?diet=Halal → 2 restos', halal.data.length === 2, `(reçu: ${halal.data?.length})`)

  const search = await call('GET', '/restaurants?q=ramen')
  check('Recherche ?q=ramen → 1 resto', search.data.length === 1)

  const page = await call('GET', '/restaurants/chez-amina')
  check('GET /restaurants/chez-amina → menu + programme', page.status === 200 && page.data.menuItems?.length === 3 && page.data.program?.title === 'Les saveurs d’Amina')
  check('La page publique ne fuite pas le SIRET/ownerId', page.data.siret === undefined && page.data.ownerId === undefined)

  const notFound = await call('GET', '/restaurants/nexiste-pas')
  check('Slug inconnu → 404', notFound.status === 404)
}

console.log('\n── 2. Sécurité : accès refusés ──')
{
  const noAuth = await call('GET', '/memberships/mine')
  check('GET /memberships/mine sans token → 401', noAuth.status === 401)

  const badToken = await call('GET', '/memberships/mine', { token: 'faux.token' })
  check('Token forgé → 401', badToken.status === 401)

  const badInput = await call('POST', '/memberships', { token: 'x', body: { slug: 'DROP TABLE users;--' } })
  check('Injection dans le slug → 400/401, jamais exécutée', [400, 401].includes(badInput.status))

  const badEarn = await call('POST', '/ledger/earn', { token: 'x.y', body: { code: 'abcdefgh', delta: 999999, idempotencyKey: 'hack-1234' } })
  check('Crédit de points sans être restaurateur → 401', badEarn.status === 401)
}

console.log('\n── 3. Parcours client (Camille) ──')
const camilleToken = await login('camille@fidelity.local')
{
  check('Login Camille → token de session', typeof camilleToken === 'string')

  const me = await call('GET', '/auth/me', { token: camilleToken })
  check('GET /auth/me → profil Camille', me.data?.email === 'camille@fidelity.local')

  const mine = await call('GET', '/memberships/mine', { token: camilleToken })
  check('GET /memberships/mine → 6 cartes', mine.data?.length === 6, `(reçu: ${mine.data?.length})`)
  check('Soldes à 0 au départ', mine.data?.every((m) => m.balance === 0))

  const join = await call('POST', '/memberships', { token: camilleToken, body: { slug: 'chez-amina' } })
  check('Re-adhésion chez Amina → pas de doublon (201, même carte)', join.status === 201)

  var aminaCard = mine.data.find((m) => m.restaurant.slug === 'chez-amina')
}

console.log('\n── 4. Parcours restaurateur (scan + points) ──')
const ownerToken = await login('demo-restaurateur@fidelity.local')
{
  const scan = await call('GET', `/scan/${aminaCard.publicCode}`, { token: ownerToken })
  check('Scan du QR Camille → fiche membre + programme', scan.status === 200 && scan.data.member?.displayName === 'Camille Robert')

  const earn = await call('POST', '/ledger/earn', {
    token: ownerToken,
    body: { code: aminaCard.publicCode, delta: 1, idempotencyKey: 'test-scan-0001', note: 'Déjeuner 31/08' },
  })
  check('Scan → +1 coche (balance=1)', earn.status === 201 && earn.data.balanceAfter === 1, JSON.stringify(earn.data))

  const replay = await call('POST', '/ledger/earn', {
    token: ownerToken,
    body: { code: aminaCard.publicCode, delta: 1, idempotencyKey: 'test-scan-0001', note: 'Déjeuner 31/08' },
  })
  check('Rejeu du même scan → PAS de doublon (idempotent)', replay.status === 200 && replay.data.idempotentReplay === true && replay.data.balanceAfter === 1)

  const redeemTooEarly = await call('POST', '/ledger/redeem', {
    token: ownerToken,
    body: { code: aminaCard.publicCode, idempotencyKey: 'test-redeem-001' },
  })
  check('Récompense avec 1/10 coches → refusée (409)', redeemTooEarly.status === 409)

  for (let i = 2; i <= 10; i++) {
    await call('POST', '/ledger/earn', {
      token: ownerToken,
      body: { code: aminaCard.publicCode, delta: 1, idempotencyKey: `test-scan-000${i}` },
    })
  }
  const redeem = await call('POST', '/ledger/redeem', {
    token: ownerToken,
    body: { code: aminaCard.publicCode, idempotencyKey: 'test-redeem-002', note: 'Plat signature offert' },
  })
  check('À 10/10 → récompense OK, solde retombe à 0', redeem.status === 201 && redeem.data.balanceAfter === 0, JSON.stringify(redeem.data))

  const adjust = await call('POST', '/ledger/adjust', {
    token: ownerToken,
    body: { code: aminaCard.publicCode, delta: 2, idempotencyKey: 'test-adjust-001', note: 'Geste commercial : attente longue' },
  })
  check('Correction manuelle avec motif → +2 (solde=2)', adjust.status === 201 && adjust.data.balanceAfter === 2)

  const adjustNoReason = await call('POST', '/ledger/adjust', {
    token: ownerToken,
    body: { code: aminaCard.publicCode, delta: 5, idempotencyKey: 'test-adjust-002' },
  })
  check('Correction SANS motif → refusée (400)', adjustNoReason.status === 400)
}

console.log('\n── 5. Sécurité : un membre ne peut pas se créditer ──')
{
  const otherCard = await call('GET', '/memberships/mine', { token: camilleToken })
  const casa = otherCard.data.find((m) => m.restaurant.slug === 'casa-verde')
  const selfEarn = await call('POST', '/ledger/earn', {
    token: camilleToken,
    body: { code: casa.publicCode, delta: 10, idempotencyKey: 'hack-self-001' },
  })
  check('Camille scanne sa propre carte → 403 interdit', selfEarn.status === 403)

  const solde = await call('GET', '/memberships/mine', { token: camilleToken })
  const casaAfter = solde.data.find((m) => m.restaurant.slug === 'casa-verde')
  check('Solde Casa Verde inchangé (0)', casaAfter.balance === 0)
}

console.log('\n── 6. Historique ──')
{
  const history = await call('GET', `/memberships/${aminaCard.id}/history`, { token: camilleToken })
  check('Historique Camille → 12 mouvements (10+1 replay? non: 10 earn + 1 redeem + 1 adjust)', history.status === 200 && history.data.length === 12, `(reçu: ${history.data?.length})`)

  const historyOwner = await call('GET', `/memberships/${aminaCard.id}/history`, { token: ownerToken })
  check('Le restaurateur voit aussi l’historique', historyOwner.status === 200)
}

console.log(`\n══ Résultat : ${passed} tests OK, ${failed} échecs ══\n`)
process.exit(failed ? 1 : 0)
