// Test de bout en bout du flux FoodShare — usage :
//   1. démarrer l'API (npm run dev ou node dist/server.js)
//   2. node scripts/test-shares.mjs
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

const camilleToken = await login('camille@fidelity.local')
const ownerToken = await login('demo-restaurateur@fidelity.local')

const list = await call('GET', '/restaurants')
const amina = list.data.find((r) => r.slug === 'chez-amina')
check('Restaurant chez-amina trouvé (id backend)', typeof amina?.id === 'string')

console.log('\n── 1. Condition « déjà commandé » ──')
{
  const freshToken = await login(`nouveau-${Date.now()}@fidelity.local`)
  const noMembership = await call('POST', '/shares', {
    token: freshToken,
    body: { slug: 'chez-amina', imageUrl: '/images/table.webp', caption: 'Test', rating: 5 },
  })
  check('Sans carte → 403 « après une première commande »', noMembership.status === 403, JSON.stringify(noMembership.data))

  await call('POST', '/memberships', { token: freshToken, body: { slug: 'chez-amina' } })
  const noEarn = await call('POST', '/shares', {
    token: freshToken,
    body: { slug: 'chez-amina', imageUrl: '/images/table.webp', caption: 'Test', rating: 5 },
  })
  check('Carte sans commande (0 EARN) → 403', noEarn.status === 403)
}

console.log('\n── 2. Camille commande (scan) puis publie ──')
const mine = await call('GET', '/memberships/mine', { token: camilleToken })
const aminaCard = mine.data.find((m) => m.restaurant.slug === 'chez-amina')
const balanceBefore = aminaCard.balance
{
  // Le restaurateur crédite 1 coche = la commande qui débloque FoodShare
  const earn = await call('POST', '/ledger/earn', {
    token: ownerToken,
    body: { code: aminaCard.publicCode, delta: 1, idempotencyKey: `share-test-scan-${Date.now()}`, note: 'Déjeuner test FoodShare' },
  })
  check('Scan commerçant → +1 coche', earn.status === 201, JSON.stringify(earn.data))

  const badRating = await call('POST', '/shares', {
    token: camilleToken,
    body: { slug: 'chez-amina', imageUrl: '/images/table.webp', caption: 'Note invalide', rating: 9 },
  })
  check('Note hors 1..5 → 400', badRating.status === 400)

  const share = await call('POST', '/shares', {
    token: camilleToken,
    body: { slug: 'chez-amina', imageUrl: '/images/table.webp', caption: 'Couscous du vendredi au top.', rating: 5 },
  })
  check('Publication FoodShare → 201, statut PENDING', share.status === 201 && share.data?.status === 'PENDING', JSON.stringify(share.data))
  var shareId = share.data?.id

  const review = await call('GET', '/restaurants/chez-amina', {})
  const camilleReview = review.data?.reviews?.find((r) => r.author?.displayName === 'Camille Robert')
  check('La note compte tout de suite (avis 5/5 créé)', camilleReview?.rating === 5)
}

console.log('\n── 3. Le restaurateur valide ──')
{
  const pending = await call('GET', `/restaurants/${amina.id}/shares?status=PENDING`, { token: ownerToken })
  const found = pending.data?.find((p) => p.id === shareId)
  check('File d’attente restaurateur → le partage est là', !!found, `(reçus: ${pending.data?.length})`)
  check('Auteur visible (displayName)', found?.author?.displayName === 'Camille Robert')

  const camilleCantDecide = await call('POST', `/shares/${shareId}/decide`, { token: camilleToken, body: { publish: true } })
  check('Un membre ne peut pas valider → 403', camilleCantDecide.status === 403)

  const decide = await call('POST', `/shares/${shareId}/decide`, {
    token: ownerToken,
    body: { publish: true, rewardDelta: 2 },
  })
  check('Republication → PUBLISHED + écriture FOODSHARE +2', decide.status === 200 && decide.data?.post?.status === 'PUBLISHED' && decide.data?.credited?.delta === 2, JSON.stringify(decide.data))

  const replay = await call('POST', `/shares/${shareId}/decide`, {
    token: ownerToken,
    body: { publish: true, rewardDelta: 2 },
  })
  check('Double validation → 409 (déjà traité, pas de double crédit)', replay.status === 409)

  const mineAfter = await call('GET', '/memberships/mine', { token: camilleToken })
  const balanceAfter = mineAfter.data.find((m) => m.restaurant.slug === 'chez-amina').balance
  check(`Solde Camille : ${balanceBefore} → ${balanceBefore + 1 + 2} (commande + FoodShare)`, balanceAfter === balanceBefore + 3, `(reçu: ${balanceAfter})`)
}

console.log('\n── 4. Visibilité publique et profil membre ──')
{
  const pub = await call('GET', '/restaurants/chez-amina/shares/public')
  check('Fil public → le partage republié est visible', pub.data?.some((p) => p.id === shareId))

  const mineShares = await call('GET', '/shares/mine', { token: camilleToken })
  const mineFound = mineShares.data?.find((p) => p.id === shareId)
  check('« Mes partages » → statut PUBLISHED + nom du resto', mineFound?.status === 'PUBLISHED' && mineFound?.restaurant?.slug === 'chez-amina')
}

console.log('\n── 5. Refus : pas de crédit, pas de fil public ──')
{
  const share2 = await call('POST', '/shares', {
    token: camilleToken,
    body: { slug: 'chez-amina', imageUrl: '/images/ramen.webp', caption: 'Photo à refuser.', rating: 3 },
  })
  const reject = await call('POST', `/shares/${share2.data.id}/decide`, { token: ownerToken, body: { publish: false } })
  check('Refus → REJECTED, credited=null', reject.status === 200 && reject.data?.post?.status === 'REJECTED' && reject.data?.credited === null)

  const pub = await call('GET', '/restaurants/chez-amina/shares/public')
  check('Le partage refusé n’apparaît PAS dans le fil public', !pub.data?.some((p) => p.id === share2.data.id))

  const mineShares = await call('GET', '/shares/mine', { token: camilleToken })
  check('…mais reste visible sur le profil du membre', mineShares.data?.some((p) => p.id === share2.data.id && p.status === 'REJECTED'))
}

console.log(`\n══ Résultat : ${passed} tests OK, ${failed} échecs ══\n`)
process.exit(failed ? 1 : 0)
