import test from 'node:test'
import assert from 'node:assert/strict'
import { restaurants as demoRestaurants, members, getMember } from '../src/data.ts'
import { activeFilterCount, createRestaurantIndex, defaultSearchFilters, distanceKm, isOpenAt, normalizeSearch, searchMembers, searchRestaurants, toggleQuickFilter } from '../src/lib/search.ts'
import { readSearchProfiles, saveSearchProfiles, searchProfileOf, searchProfileSchema } from '../src/lib/search-profile.ts'

// Garder un corpus stable pour les assertions de classement et d'absence de résultat.
const restaurants = demoRestaurants.filter(({ id }) => ['amina', 'casa', 'miso', 'comptoir', 'rizrouge', 'braise'].includes(id))
const index = createRestaurantIndex(restaurants)
const search = (query = '', patch = {}, items = index, date = new Date('2026-09-05T11:00:00Z')) => searchRestaurants(items, { ...defaultSearchFilters(), query, ...patch }, date).map((hit) => hit.item.id)
const fixture = (patch) => ({ ...restaurants[0], ...patch })

for (const [query, expected] of [
  ['ramen', ['miso']], ['RAMEN', ['miso']], ['ramne', ['miso']], ['raemn', ['miso']],
  ['restaurant japonais', ['miso']], ['japanese', ['miso']], ['casa tacos', ['casa']],
  ['tacos casa', ['casa']], ['tacos paris 11e', ['casa']], ['bo bun', ['rizrouge']],
  ['chez amina', ['amina']], ['amina couscous', ['amina']], ['ramen vegan', ['miso']],
  ['ramen halal', []], ['burger', []], ['pizza', []], ['@camille', []], ['zzqxw', []],
]) test('Recherche : ' + query, () => assert.deepEqual(search(query), expected))

test('Accents, ligatures et ponctuation', () => assert.equal(normalizeSearch('  CŒUR — VÉGÉ / Léa  '), 'coeur vege lea'))
test('La requête vide ne cache aucun restaurant', () => assert.equal(search().length, restaurants.length))
test('Les cultures asiatiques incluent ramen et japonais', () => assert.ok(search('asiatique').includes('miso')))
test('Végé et veggie sont des synonymes', () => assert.deepEqual(search('végé'), search('veggie')))
test('Sans gluten est un critère structuré', () => assert.deepEqual(new Set(search('sans gluten')), new Set(['miso', 'rizrouge'])))
test('Les régimes ne se déduisent pas du menu', () => {
  const fake = createRestaurantIndex([fixture({ id: 'test', diets: [], description: 'burger vegan halal sans gluten' })])
  assert.deepEqual(search('vegan', {}, fake), [])
  assert.deepEqual(search('', { diets: ['Halal'] }, fake), [])
})
test('Les catégories se combinent par OU, les régimes par ET', () => {
  assert.deepEqual(new Set(search('', { categories: ['ramen', 'tacos'] })), new Set(['miso', 'casa']))
  assert.deepEqual(search('', { categories: ['ramen', 'tacos'], diets: ['Végan', 'Sans gluten'] }), ['miso'])
})
test('Les services sont déclaratifs et cumulatifs', () => {
  const data = createRestaurantIndex([fixture({ id: 'test', services: ['emporter'] })])
  assert.deepEqual(search('a emporter', {}, data), ['test'])
  assert.deepEqual(search('', { services: ['emporter', 'terrasse'] }, data), [])
})
test('Les spécialités ajoutées dans la Façade deviennent recherchables', () => {
  const data = createRestaurantIndex([fixture({ id: 'test', foodTags: ['burger'] })])
  assert.deepEqual(search('burger', {}, data), ['test'])
  assert.deepEqual(search('', { categories: ['burger'] }, data), ['test'])
})
test('Le nom exact passe avant la description', () => {
  const data = createRestaurantIndex([fixture({ id: 'description', name: 'Autre table', description: 'Casa Verde' }), fixture({ id: 'exact', name: 'Casa Verde' })])
  assert.equal(search('casa verde', {}, data)[0], 'exact')
})
test('La distance convertit les mètres et exclut les valeurs inconnues', () => {
  assert.equal(distanceKm('800 m'), 0.8); assert.equal(distanceKm('1,4 km'), 1.4)
  assert.equal(distanceKm('—'), Infinity)
  assert.ok(!search('', { distance: 2 }).includes('rizrouge'))
})
test('Les valeurs de budget inconnues ne sont pas prises pour un repas gratuit', () => {
  const data = createRestaurantIndex([fixture({ id: 'test', avgPrice: 0 })])
  assert.deepEqual(search('', { maxPrice: 15 }, data), [])
})
test('Budget, lieu et capacité se combinent', () => assert.deepEqual(search('', { location: 'Paris 11e', maxPrice: 15, guests: 2 }), ['casa']))
test('Les chiffres du quartier ne sont pas corrigés comme des fautes', () => assert.ok(!search('', { location: 'Paris 10e' }).includes('amina')))
test('Le premier arrondissement ne correspond pas au onzième', () => assert.ok(!search('', { location: 'Paris 1er' }).includes('amina')))
test('Code postal et arrondissement correspondent à la même zone', () => assert.deepEqual(search('', { location: '75011' }), search('', { location: 'Paris 11ème' })))
test('Les horaires sont ceux du jour à Paris', () => {
  assert.ok(search('', { times: ['12 h'] }).includes('miso'))
  assert.ok(!search('', { times: ['12 h'] }, index, new Date('2026-09-04T11:00:00Z')).includes('miso'))
})
test('Deux services et fermeture exclusive', () => {
  const r = fixture({ openingHours: [{ day: 6, intervals: [{ open: '12:00', close: '14:00' }, { open: '19:00', close: '22:00' }] }] })
  assert.equal(isOpenAt(r, 6, 13 * 60), true); assert.equal(isOpenAt(r, 6, 14 * 60), false)
  assert.equal(isOpenAt(r, 6, 17 * 60), false); assert.equal(isOpenAt(r, 6, 20 * 60), true)
})
test('Un service de nuit se poursuit sur le lendemain', () => {
  const r = fixture({ openingHours: [{ day: 6, intervals: [{ open: '20:00', close: '02:00' }] }] })
  assert.equal(isOpenAt(r, 0, 60), true); assert.equal(isOpenAt(r, 6, 60), false); assert.equal(isOpenAt(r, 0, 120), false)
})
test('Maintenant et la requête ouvert utilisent la même horloge', () => assert.deepEqual(search('ouvert maintenant'), search('', { times: ['Maintenant'] })))
test('Cliquer à nouveau sur une bulle désactive le filtre', () => {
  const filters = toggleQuickFilter(defaultSearchFilters(), 'vege')
  assert.equal(activeFilterCount(filters), 1); assert.deepEqual(toggleQuickFilter(filters, 'vege'), defaultSearchFilters())
})
for (const [query, expected] of [['lea', 'lea'], ['LÉA', 'lea'], ['@leagoutte', 'lea'], ['@camille', 'camille'], ['camile', 'camille'], ['robert camille', 'camille']]) {
  test('Personne : ' + query, () => assert.equal(searchMembers(members, query)[0]?.item.id, expected))
}
test('Le préfixe @ ne recherche pas dans le nom affiché', () => assert.deepEqual(searchMembers(members, '@robert'), []))
test('Les biographies ne polluent pas les recherches de personnes', () => assert.deepEqual(searchMembers(members, 'ramen'), []))
test('Un identifiant inconnu ne renvoie pas le profil de Camille', () => assert.equal(getMember('inexistant'), undefined))
test('Les horaires invalides sont refusés avant sauvegarde', () => {
  const profile = searchProfileOf(restaurants[0])
  assert.equal(searchProfileSchema.safeParse({ ...profile, openingHours: [{ day: 6, intervals: [{ open: '25:00', close: '12:00' }] }] }).success, false)
  assert.equal(searchProfileSchema.safeParse({ ...profile, avgPrice: -1 }).success, false)
})
test('Les critères survivent au rechargement et un stockage corrompu est ignoré', () => {
  let storage = '{}'
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => storage, setItem: (_, value) => { storage = value } } })
  const profile = searchProfileOf(restaurants[0])
  assert.equal(saveSearchProfiles({ amina: profile }), true)
  assert.deepEqual(readSearchProfiles().amina, profile)
  storage = 'invalide'; assert.deepEqual(readSearchProfiles(), {})
  delete globalThis.localStorage
})
