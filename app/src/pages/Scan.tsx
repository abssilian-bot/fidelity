import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Gift, LoaderCircle, ScanLine } from 'lucide-react'
import type { CommonProps } from '../nav'
import { QrCamera } from '../components/QrCamera'
import { commitScan, fetchOwnedRestaurants, getAccount, resolveScannedCard } from '../lib/api'
import type { OwnedRestaurant, ScannedCard, ScanReceipt } from '../lib/api'
import { forgetScan, parseCardCode, readPendingScan, rememberScan } from '../lib/scan'
import type { PendingScan } from '../lib/scan'

export function ScanPage({ go, restaurantId }: CommonProps & { restaurantId: string }) {
  const accountId = getAccount()?.user.id || 'demo-local'
  const [places, setPlaces] = useState<OwnedRestaurant[]>([])
  const [place, setPlace] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const working = useRef(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [manual, setManual] = useState('')
  const [card, setCard] = useState<ScannedCard | null>(null)
  const [amount, setAmount] = useState('1')
  const [pending, setPending] = useState<PendingScan | null>(() => readPendingScan(accountId))
  const [receipt, setReceipt] = useState<ScanReceipt | null>(null)
  const [client, setClient] = useState('')
  const [cameraVersion, setCameraVersion] = useState(0)
  const [rewardConfirm, setRewardConfirm] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetchOwnedRestaurants().then(items => {
      if (cancelled) return
      const verified = items.filter(item => item.status === 'VERIFIED')
      setPlaces(verified); setPlace(verified.find(item => item.frontId === restaurantId)?.id || verified[0]?.id || '')
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Connexion au serveur nécessaire.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId])
  async function scan(value: string) {
    if (working.current || !place) return
    working.current = true; setBusy(true); setError('')
    try {
      const normalized = parseCardCode(value)
      const result = await resolveScannedCard(normalized, place)
      setCode(normalized); setCard(result); setAmount(result.program.type === 'STAMPS' ? '1' : '10')
      setClient(result.member.displayName || result.member.pseudo || 'Client Fidelity')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'QR illisible. Réessaie.'); setCameraVersion(v => v + 1) }
    finally { working.current = false; setBusy(false) }
  }
  async function submit(operation: 'earn' | 'redeem') {
    if (working.current) return
    working.current = true; setBusy(true); setError('')
    try {
      const input: PendingScan = pending || {
        accountId, restaurantId: card!.restaurant.id, operation, code, delta: operation === 'earn' ? Number(amount) : undefined,
        idempotencyKey: crypto.randomUUID(), clientName: client, createdAt: Date.now(),
      }
      rememberScan(input); setPending(input)
      const result = await commitScan(input)
      forgetScan(); setPending(null); setReceipt(result); setClient(input.clientName)
      window.dispatchEvent(new Event('fidelity:ledger-updated'))
    } catch (cause) {
      const status = cause && typeof cause === 'object' && 'status' in cause ? Number(cause.status) : 0
      if (status >= 400 && status < 500 && ![408, 429].includes(status)) { forgetScan(); setPending(null) }
      setError(cause instanceof Error ? cause.message : 'Confirmation indisponible. Réessaie cette même opération.')
    } finally { working.current = false; setBusy(false) }
  }
  const stamps = card?.program.type === 'STAMPS'
  const validAmount = /^\d+$/.test(amount) && Number(amount) >= 1 && Number(amount) <= (stamps ? 10 : 1000)
  return <main className="page scan-page">
    <span className="eyebrow">En caisse</span><h1>Scanner un client</h1>
    {loading ? <p role="status"><LoaderCircle className="animate-spin" size={18} /> Connexion au programme…</p>
      : receipt ? <section className="scan-success form-section" role="status">
        <span className="scan-success-icon"><Check size={32} /></span>
        <h2>{receipt.delta > 0 ? `+${receipt.delta} ${stamps ? 'coche' + (receipt.delta > 1 ? 's' : '') : 'points'}` : 'Récompense utilisée'}</h2>
        <p>{client}</p><strong>Nouveau solde : {receipt.balanceAfter}</strong>
        <small>Enregistré sur le serveur · {new Date(receipt.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small>
        <small>Référence {receipt.id}</small>
        <button className="primary-button full" type="button" onClick={() => { setReceipt(null); setCard(null); setCode(''); setManual(''); setRewardConfirm(false); setError('') }}><ScanLine size={19} /> Client suivant</button>
        <button className="outline-button full" type="button" onClick={() => go('restoClients')}>Voir l’activité <ChevronRight size={17} /></button>
      </section>
      : pending ? <section className="form-section">
        <h2>Vérifier la confirmation</h2><p>{pending.clientName} · {pending.operation === 'earn' ? `+${pending.delta}` : 'Récompense'}</p>
        <p className="muted">La confirmation du serveur manque. Réessaie ici : cette opération ne sera comptée qu’une fois.</p>
        <button className="primary-button full" disabled={busy} type="button" onClick={() => void submit(pending.operation)}>{busy ? 'Vérification…' : 'Vérifier et terminer'}</button>
      </section>
      : !places.length ? <section className="form-section"><h2>Ton établissement</h2><p>Connecte-toi avec le compte propriétaire d’un restaurant validé pour scanner les cartes de ses clients.</p><button className="primary-button full" type="button" onClick={() => go('settings')}>Ouvrir mon compte</button></section>
      : card ? <section className="form-section scan-confirm">
        <span className="eyebrow">{card.restaurant.name}</span><h2>{client}</h2>
        <div className="scan-balance"><span>Solde actuel</span><strong>{card.balance} <small>{stamps ? 'coches' : 'points'}</small></strong></div>
        {rewardConfirm ? <><h3>{card.program.reward}</h3><p>Utiliser cette récompense retire {card.program.target} {stamps ? 'coches' : 'points'} de la carte.</p>
          <button className="primary-button full" disabled={busy} type="button" onClick={() => void submit('redeem')}><Gift size={18} /> Confirmer la récompense</button>
          <button className="outline-button full" disabled={busy} type="button" onClick={() => setRewardConfirm(false)}>Retour aux points</button>
        </> : <>
          <label htmlFor="scan-amount">{stamps ? 'Coches à ajouter' : 'Points à ajouter'}</label>
          <div className="scan-presets">{(stamps ? [1, 2, 3] : [10, 50, 100]).map(value => <button key={value} type="button" className={amount === String(value) ? 'selected' : ''} disabled={busy} onClick={() => setAmount(String(value))}>+{value}</button>)}</div>
          <input id="scan-amount" type="number" inputMode="numeric" min={1} max={stamps ? 10 : 1000} step={1} value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} />
          <button className="primary-button full scan-submit" type="button" disabled={busy || !validAmount} onClick={() => void submit('earn')}><Check size={20} /> {busy ? 'Enregistrement…' : `Ajouter ${validAmount ? amount : '…'} ${stamps ? 'coche' + (Number(amount) > 1 ? 's' : '') : 'points'}`}</button>
          {card.balance >= card.program.target && <button className="outline-button full" type="button" disabled={busy} onClick={() => setRewardConfirm(true)}><Gift size={18} /> Utiliser une récompense</button>}
          <button className="text-button" type="button" disabled={busy} onClick={() => { setCard(null); setError('') }}>Scanner un autre client</button>
        </>}
      </section> : <>
        <label className="scan-place">Établissement<select value={place} disabled={busy} onChange={event => { setPlace(event.target.value); setCameraVersion(v => v + 1) }}>{places.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        {!busy && <QrCamera key={cameraVersion} onCode={value => void scan(value)} />}
        {busy && <p role="status">Lecture de la carte…</p>}
        <form className="scan-manual" onSubmit={event => { event.preventDefault(); void scan(manual) }}><label htmlFor="scan-code">Code de secours du client</label><input id="scan-code" value={manual} placeholder="Coller le code Fidelity" autoComplete="off" spellCheck={false} onChange={event => setManual(event.target.value)} /><button className="outline-button full" disabled={busy || !manual.trim()} type="submit">Lire la carte</button></form>
      </>}
    {error && <p className="card-action-error" role="alert">{error}</p>}
  </main>
}
