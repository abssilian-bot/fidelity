import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCardCode, readPendingScan, rememberScan, forgetScan } from '../src/lib/scan.ts'

const code = 'fc1_' + 'Ab012_-x'.repeat(4)
test('Lecture QR : format Fidelity et code de secours, aucune navigation arbitraire', () => {
  assert.equal(parseCardCode('fidelity:card:' + code), code)
  assert.equal(parseCardCode(' ' + code + ' '), code)
  for (const value of ['https://evil.example/?token=x', 'javascript:alert(1)', '<script>x</script>', 'fc1_tropcourt', code + '.suffixe']) assert.throws(() => parseCardCode(value), /Fidelity/)
})
test('Reprise après rechargement : montant, carte et référence conservés ensemble', t => {
  const previous = globalThis.sessionStorage, values = new Map()
  globalThis.sessionStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  t.after(() => { globalThis.sessionStorage = previous })
  const pending = { accountId: 'owner-a', restaurantId: 'r-a', code, operation: 'earn', delta: 3, idempotencyKey: crypto.randomUUID(), clientName: 'Test', createdAt: Date.now() }
  rememberScan(pending)
  assert.deepEqual(readPendingScan('owner-a'), pending)
  assert.equal(readPendingScan('owner-b'), null)
  forgetScan(); assert.equal(readPendingScan('owner-a'), null)
})
test('Stockage indisponible ou corrompu : pas de fausse reprise', t => {
  const previous = globalThis.sessionStorage
  globalThis.sessionStorage = { getItem: () => '{cassé', setItem: () => { throw new Error('quota') } }
  t.after(() => { globalThis.sessionStorage = previous })
  assert.equal(readPendingScan('owner'), null)
  assert.throws(() => rememberScan({}), /stockage/)
})
