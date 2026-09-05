import test from 'node:test'
import assert from 'node:assert/strict'
import { restaurants } from '../src/data.ts'
import { MY_CARDS_KEY, readMyCards, saveMyCards, usedCardIds } from '../src/lib/my-cards.ts'

function storage(t, raw = null) {
  let value = raw
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => { assert.equal(key, MY_CARDS_KEY); return value },
    setItem: (key, next) => { assert.equal(key, MY_CARDS_KEY); value = next },
  } })
  t.after(() => { delete globalThis.localStorage })
}

test('Une carte utilisée reste détenue même avec un solde nul', () => {
  const tables = [{ ...restaurants[0], id: 'utilisee', loyalty: { ...restaurants[0].loyalty, current: 0 } },
    { ...restaurants[0], id: 'nouvelle', loyalty: { ...restaurants[0].loyalty, current: 0 } }]
  assert.deepEqual(usedCardIds(tables, [{ restaurantId: 'utilisee', count: 1 }]), ['utilisee'])
})
test('Un ajout survit au rechargement sans doubler la carte', t => {
  storage(t)
  const cards = readMyCards(['amina'])
  cards.add('demo-smash-garden'); cards.add('demo-smash-garden')
  saveMyCards(cards)
  assert.deepEqual([...readMyCards(['amina'])], ['amina', 'demo-smash-garden'])
})
test('Les ajouts enregistrés dans un autre onglet sont conservés', t => {
  storage(t, '["miso"]')
  const next = readMyCards(['amina']); next.add('demo-maki-club'); saveMyCards(next)
  assert.deepEqual(new Set(readMyCards([])), new Set(['amina', 'miso', 'demo-maki-club']))
})
test('Un stockage corrompu ne supprime pas les cartes déjà utilisées', t => {
  storage(t, 'invalid-json')
  assert.deepEqual([...readMyCards(['amina'])], ['amina'])
})
test('Les identifiants invalides du stockage sont ignorés', t => {
  storage(t, '[null, 42, {}, "", "miso", "miso"]')
  assert.deepEqual([...readMyCards(['amina'])], ['amina', 'miso'])
})
test('Un échec du stockage est signalé, sans faux succès', t => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem: () => { throw new Error('quota') } } })
  t.after(() => { delete globalThis.localStorage })
  assert.throws(() => saveMyCards(new Set(['amina'])), /quota/)
})
