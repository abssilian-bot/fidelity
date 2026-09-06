import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const target = path.resolve('../.local/discovery-test.mjs')
await build({ stdin: { contents: `export { feedAuthorRoute, shareToFeedPost } from './src/lib/feed'; export { feedPosts, pendingSharesSeed, getMember } from './src/data'; export { fetchPublicMember } from './src/lib/api';`, resolveDir: process.cwd() },
  outfile: target, bundle: true, platform: 'browser', format: 'esm', define: { 'import.meta.env': JSON.stringify({ DEV: true }) } })
const { feedAuthorRoute, shareToFeedPost, feedPosts, pendingSharesSeed, getMember, fetchPublicMember } = await import(pathToFileURL(target).href)

test('Camille ouvre son compte, même si son post identifie Chez Amina', () => {
  const post = feedPosts.find(post => post.id === 2)
  assert.equal(post.restaurantId, 'amina')
  assert.deepEqual(feedAuthorRoute(post), { name: 'memberProfile', memberId: 'camille' })
})
test('Les auteurs restaurants continuent d’ouvrir leur propre fiche', () => {
  for (const post of feedPosts.filter(post => post.authorType === 'restaurant'))
    assert.deepEqual(feedAuthorRoute(post), { name: 'restaurant', restaurantId: post.restaurantId })
})
test('Tous les FoodShare de démonstration ouvrent leur auteur', () => {
  for (const share of pendingSharesSeed) {
    const route = feedAuthorRoute(shareToFeedPost(share))
    assert.equal(route.name, 'memberProfile')
    assert.equal(getMember(route.memberId).name, share.author)
  }
})
test('Un FoodShare conserve l’identifiant serveur, même en cas d’homonyme', () => {
  const share = { ...pendingSharesSeed[0], memberId: 'compte-serveur-unique' }
  assert.deepEqual(feedAuthorRoute(shareToFeedPost(share)), { name: 'memberProfile', memberId: share.memberId })
})
test('Un auteur manquant ne redirige jamais vers le restaurant ou un autre compte', () => {
  assert.equal(feedAuthorRoute(shareToFeedPost({ ...pendingSharesSeed[0], memberId: undefined })), null)
})
test('Un profil serveur sans pseudo reste lisible, sans inventer de pseudo', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async url => {
    assert.ok(url.endsWith('/members/auteur-sans-pseudo'))
    return Response.json({ id: 'auteur-sans-pseudo', displayName: null, pseudo: null, bio: null, posts: [{ imageUrl: '/images/table.webp' }], _count: { posts: 1, reviews: 0 } })
  }
  const member = await fetchPublicMember('auteur-sans-pseudo', new AbortController().signal)
  assert.equal(member.name, 'Membre Fidelity')
  assert.equal(member.handle, '')
  assert.equal(member.posts, 1)
  assert.equal(getMember(member.id).id, member.id)
})
test('API indisponible : aucun profil de démonstration ne remplace la personne', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async () => { throw new TypeError('Hors connexion') }
  assert.equal(await fetchPublicMember('auteur-absent', new AbortController().signal), null)
})
