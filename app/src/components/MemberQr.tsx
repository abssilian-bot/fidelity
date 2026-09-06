import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, LoaderCircle, RefreshCw } from 'lucide-react'
import { getBackendState, presentMyCard, refreshMyCards } from '../lib/api'
import type { BackendState } from '../lib/api'

export function MemberQr({ restaurantId, onSync }: { restaurantId: string; onSync?: (state: BackendState) => void }) {
  const [qr, setQr] = useState<{ code: string; expiresAt: string } | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [version, setVersion] = useState(0)
  const sync = useRef(onSync)
  sync.current = onSync
  useEffect(() => {
    let cancelled = false, busy = false
    let current: { code: string; expiresAt: string } | null = null
    let balance = getBackendState().balances[restaurantId]
    const update = async () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const state = await refreshMyCards()
        if (cancelled) return
        sync.current?.(state)
        if (!current || Date.parse(current.expiresAt) <= Date.now() + 10_000 || balance !== state.balances[restaurantId]) {
          current = await presentMyCard(restaurantId)
          if (!cancelled) setQr(current)
        }
        balance = state.balances[restaurantId]
        if (!cancelled) setError('')
      } catch (cause) {
        if (!cancelled) { setQr(null); setError(cause instanceof Error ? cause.message : 'Connexion nécessaire pour présenter la carte.') }
        current = null
      } finally { busy = false }
    }
    setQr(null); setError(''); void update()
    const refresh = window.setInterval(() => void update(), 5_000)
    const clock = window.setInterval(() => setNow(Date.now()), 1_000)
    const visible = () => void update()
    document.addEventListener('visibilitychange', visible)
    return () => { cancelled = true; clearInterval(refresh); clearInterval(clock); document.removeEventListener('visibilitychange', visible) }
  }, [restaurantId, version])
  const remaining = qr ? Math.max(0, Math.ceil((Date.parse(qr.expiresAt) - now) / 1000)) : 0
  return <section className="member-qr form-section" aria-label="Présenter ma carte en caisse">
    <h2>À présenter en caisse</h2>
    <p className="muted">Le restaurant scanne ce QR pour ajouter vos points ou utiliser votre récompense.</p>
    {qr && remaining > 0 ? <>
      <div className="qr-paper"><QRCodeSVG value={`fidelity:card:${qr.code}`} size={220} level="M" marginSize={4} title="QR temporaire de votre carte Fidelity" /></div>
      <small>Renouvellement automatique · valable encore {remaining} s</small>
      <button type="button" className="outline-button full" onClick={async () => {
        try { await navigator.clipboard.writeText(qr.code); setError('Code copié. Transmettez-le uniquement au restaurant en caisse.') }
        catch { setError('La copie est indisponible. Présentez le QR à la caméra du restaurant.') }
      }}><Copy size={16} /> Copier le code de secours</button>
    </> : error ? <>
      <p role="status" className="card-action-error">{error}</p>
      <button className="outline-button full" type="button" onClick={() => setVersion(value => value + 1)}><RefreshCw size={16} /> Réessayer</button>
    </> : <p role="status"><LoaderCircle size={18} className="animate-spin" /> Préparation du QR sécurisé…</p>}
    {qr && error && <small role="status">{error}</small>}
  </section>
}
