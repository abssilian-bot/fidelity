import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, LoaderCircle, LogOut, Mail } from 'lucide-react'
import { completeLogin, disconnectAccount, getAccount, requestLoginLink } from '../lib/api'

export function AccountSection() {
  const account = getAccount()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'connecting'>('idle')
  const [devLink, setDevLink] = useState('')
  const [error, setError] = useState('')
  const busy = status === 'sending' || status === 'connecting'

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setStatus('sending'); setError(''); setDevLink('')
    try {
      const result = await requestLoginLink(email)
      setDevLink(result.devLink ?? '')
      setStatus('sent')
    } catch (cause) {
      setStatus('error')
      setError(cause instanceof Error ? cause.message : 'Impossible d’envoyer le lien. Réessaie plus tard.')
    }
  }

  async function connectDemo() {
    if (busy) return
    setStatus('connecting'); setError('')
    try {
      const token = new URL(devLink).searchParams.get('token')
      if (!token) throw new Error('Lien invalide ou expiré — redemande un lien de connexion.')
      await completeLogin(token)
      window.location.reload()
    } catch (cause) {
      setStatus('error'); setDevLink('')
      setError(cause instanceof Error ? cause.message : 'Lien invalide ou expiré — redemande un lien de connexion.')
    }
  }

  return (
    <section className="form-section account-section" aria-labelledby="account-heading">
      <h2 id="account-heading" style={{ margin: 0 }}>Compte</h2>
      {account ? (
        <>
          <div className="settings-row account-identity">
            <span aria-hidden="true">{(account.user.displayName || account.user.email).charAt(0).toLocaleUpperCase('fr')}</span>
            <span><strong>{account.user.displayName || account.user.pseudo || 'Mon compte Fidelity'}</strong><small>{account.user.email}</small></span>
            <Check size={18} color="var(--green)" aria-label="Connecté" />
          </div>
          <button className="outline-button full" type="button" disabled={busy} onClick={async () => {
            setStatus('connecting'); setError('')
            try { await disconnectAccount(); window.location.reload() }
            catch { setStatus('error'); setError('Le serveur est indisponible. Réessaie pour terminer la déconnexion sécurisée.') }
          }}><LogOut size={17} /> {busy ? 'Déconnexion…' : 'Déconnexion'}</button>
          {error && <p className="card-action-error" role="alert">{error}</p>}
        </>
      ) : (
        <form onSubmit={(event) => void request(event)} className="account-form">
          <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>Ton e-mail suffit pour créer ton compte ou te reconnecter. Aucun mot de passe à retenir.</p>
          <label htmlFor="account-email">Adresse e-mail
            <input id="account-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="toi@exemple.fr" required maxLength={254} value={email} disabled={busy}
              onChange={(event) => { setEmail(event.target.value); setStatus('idle'); setError(''); setDevLink('') }} />
          </label>
          <button className="primary-button full" type="submit" disabled={busy}>
            {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Mail size={18} />}
            {status === 'sending' ? 'Envoi en cours…' : status === 'connecting' ? 'Connexion en cours…' : 'Recevoir mon lien de connexion'}
          </button>
          {status === 'sent' && <p className="account-status" role="status">{devLink ? 'Mode démo : ton lien est prêt. Aucun e-mail n’a été envoyé.' : 'Lien envoyé ! Consulte ta boîte e-mail et tes courriers indésirables. Il est valable 15 minutes, pour une seule connexion.'}</p>}
          {devLink && <button className="outline-button full" type="button" disabled={busy} onClick={() => void connectDemo()}>Mode démo : me connecter sans e-mail</button>}
          {error && <p className="card-action-error" role="alert">{error}</p>}
        </form>
      )}
    </section>
  )
}
