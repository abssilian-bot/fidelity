import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, RefreshCw, ShieldCheck, Store } from 'lucide-react'
import { AccountSection } from '../components/AccountSection'
import type { CommonProps } from '../nav'
import { decideRestaurantApplication, fetchAdminApplications, fetchRestaurantApplications, getAccount, lookupRestaurantSiret, submitRestaurantApplication } from '../lib/api'
import type { RegistryResult, RestaurantApplication, RestaurantApplicationInput } from '../lib/api'

const empty: RestaurantApplicationInput = { siret: '', tradingName: '', cuisine: '', address: '', postalCode: '', city: '', contactName: '', contactRole: 'OWNER', phone: '', website: '', message: '', authorized: false }
const statusName = { PENDING: 'En cours de vérification', APPROVED: 'Établissement validé', REJECTED: 'Dossier à corriger' }
const reason = (error: unknown) => error instanceof Error ? error.message : 'Le serveur est indisponible. Réessayez plus tard.'
function RegistryInfo({ registry }: { registry: RegistryResult }) {
  return <div className="registration-notice" role="status">
    {registry.state === 'FOUND' ? <><strong>{registry.active ? 'Établissement actif dans l’annuaire' : 'Établissement fermé dans l’annuaire'}</strong><span>{registry.legalName}</span><span>{registry.address}</span><small>Activité APE : {registry.activity || 'à vérifier'}. Le droit de gestion doit encore être contrôlé par Fidelity.</small></>
      : <><strong>{registry.state === 'UNAVAILABLE' ? 'Annuaire temporairement indisponible' : 'SIRET non retrouvé dans les données publiques'}</strong><span>Le dossier peut être transmis, mais aucun accès ne sera accordé sans vérification. Certaines entreprises ne diffusent pas leurs données.</span></>}
  </div>
}

export function RestaurantRegistrationPage({ go, switchRole }: CommonProps) {
  const account = getAccount()
  const [applications, setApplications] = useState<RestaurantApplication[]>([])
  const [loading, setLoading] = useState(!!account), [busy, setBusy] = useState(false), [checking, setChecking] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [form, setForm] = useState(empty)
  const [registry, setRegistry] = useState<RegistryResult | null>(null), [editingId, setEditingId] = useState<string>()
  const [showForm, setShowForm] = useState(false)
  const sending = useRef(false)
  async function refresh() {
    setLoading(true); setError('')
    try { setApplications(await fetchRestaurantApplications()) } catch (e) { setError(reason(e)) } finally { setLoading(false) }
  }
  useEffect(() => { if (account) void refresh() }, [account?.user.id])
  const field = (key: keyof RestaurantApplicationInput, value: string | boolean) => setForm(old => ({ ...old, [key]: value }))
  async function checkSiret() {
    if (checking) return
    setChecking(true); setError(''); const siret = form.siret
    try {
      const result = await lookupRestaurantSiret(siret)
      setRegistry(result)
      setForm(old => old.siret !== siret ? old : { ...old, address: old.address || result.address || '', city: old.city || result.city || '', postalCode: old.postalCode || result.postalCode || '' })
    } catch (e) { setError(reason(e)) } finally { setChecking(false) }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return
    sending.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const saved = await submitRestaurantApplication(form, editingId)
      setApplications(old => [saved, ...old.filter(item => item.id !== saved.id)])
      setForm(empty); setRegistry(null); setEditingId(undefined); setShowForm(false)
      setNotice('Votre dossier est enregistré. Vous retrouverez la décision ici ; le scan reste fermé pendant la vérification.')
    } catch (e) { setError(reason(e)) } finally { sending.current = false; setBusy(false) }
  }
  function edit(item: RestaurantApplication) {
    setForm({ siret: item.siret, tradingName: item.tradingName, cuisine: item.cuisine, address: item.address, postalCode: item.postalCode, city: item.city, contactName: item.contactName, contactRole: item.contactRole, phone: item.phone, website: item.website, message: item.message, authorized: false })
    setEditingId(item.id); setRegistry(item.registry); setShowForm(true); setNotice('')
  }
  return <main className="page registration-page">
    <span className="eyebrow">Espace restaurateur</span><h1>Votre restaurant sur Fidelity</h1>
    <p className="lead">Connectez-vous, renseignez votre établissement, puis suivez sa validation.</p>
    <AccountSection intent="restaurant" />
    {account && <>
      <section className="form-section"><div className="registration-heading"><h2>Mes demandes</h2><button type="button" className="outline-button" disabled={loading || busy} onClick={() => void refresh()}><RefreshCw size={16} /> Actualiser</button></div>
        {loading ? <p role="status">Chargement des dossiers…</p> : !applications.length && <p>Aucune demande pour le moment. Inscrivez votre premier établissement ci-dessous.</p>}
        {applications.map(item => <article className="registration-notice" key={item.id}><strong>{item.tradingName}</strong><span>SIRET {item.siret}</span><b>{statusName[item.status]}</b>{item.decisionReason && <p>{item.decisionReason}</p>}
          {item.status === 'PENDING' && <small>Fidelity vérifie l’existence du restaurant et votre autorisation à le gérer. Le scan et la publication ne sont pas encore ouverts.</small>}
          {item.status === 'REJECTED' && <button className="outline-button" type="button" onClick={() => edit(item)}>Corriger et renvoyer</button>}
          {item.status === 'APPROVED' && <button className="primary-button" type="button" onClick={() => switchRole?.('restaurant')}>Ouvrir mon restaurant</button>}
        </article>)}
        {!showForm && <button type="button" className="primary-button full" onClick={() => { setShowForm(true); setEditingId(undefined); setForm(empty); setRegistry(null) }}><Store size={17} /> Inscrire un établissement</button>}
      </section>
      {showForm && <form className="form-section registration-form" onSubmit={event => void submit(event)}>
        <h2>{editingId ? 'Corriger mon dossier' : 'Informations de l’établissement'}</h2>
        <label>SIRET de cet établissement<input required inputMode="numeric" autoComplete="off" maxLength={18} value={form.siret} disabled={busy || checking || !!editingId} onChange={e => { field('siret', e.target.value); setRegistry(null) }} placeholder="14 chiffres" /></label>
        <button type="button" className="outline-button" disabled={busy || checking || !form.siret.trim()} onClick={() => void checkSiret()}>{checking ? 'Recherche dans l’annuaire…' : 'Vérifier le SIRET'}</button>
        {registry && <RegistryInfo registry={registry} />}
        <label>Nom de l’enseigne<input required maxLength={120} value={form.tradingName} disabled={busy} onChange={e => field('tradingName', e.target.value)} autoComplete="organization" /></label>
        <label>Cuisine proposée<input required maxLength={80} value={form.cuisine} disabled={busy} onChange={e => field('cuisine', e.target.value)} placeholder="Ex. cuisine italienne, burgers, bistrot…" /></label>
        <label>Adresse du restaurant<input required maxLength={200} value={form.address} disabled={busy} onChange={e => field('address', e.target.value)} autoComplete="street-address" /></label>
        <div className="registration-columns"><label>Code postal<input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} value={form.postalCode} disabled={busy} onChange={e => field('postalCode', e.target.value)} autoComplete="postal-code" /></label><label>Ville<input required maxLength={80} value={form.city} disabled={busy} onChange={e => field('city', e.target.value)} autoComplete="address-level2" /></label></div>
        <h2>Responsable de l’établissement</h2>
        <label>Nom et prénom<input required maxLength={120} value={form.contactName} disabled={busy} onChange={e => field('contactName', e.target.value)} autoComplete="name" /></label>
        <label>Votre fonction<select value={form.contactRole} disabled={busy} onChange={e => field('contactRole', e.target.value)}><option value="OWNER">Dirigeant / propriétaire</option><option value="MANAGER">Gérant / responsable</option><option value="REPRESENTATIVE">Mandataire autorisé</option></select></label>
        <label>Téléphone professionnel<input required type="tel" maxLength={25} value={form.phone} disabled={busy} onChange={e => field('phone', e.target.value)} autoComplete="tel" placeholder="01 23 45 67 89" /></label>
        <label>Site officiel ou page professionnelle (facultatif)<input type="url" maxLength={500} value={form.website} disabled={busy} onChange={e => field('website', e.target.value)} placeholder="https://…" /></label>
        <label>Précisions utiles à la vérification (facultatif)<textarea maxLength={1000} rows={3} value={form.message} disabled={busy} onChange={e => field('message', e.target.value)} placeholder="Ex. changement de gérant, rôle de votre mandataire… N’envoyez ni pièce d’identité ni coordonnées bancaires ici." /></label>
        <label className="registration-consent"><input type="checkbox" required checked={form.authorized} disabled={busy} onChange={e => field('authorized', e.target.checked)} /><span>Je certifie être autorisé à gérer cet établissement et confirme l’exactitude des informations fournies.</span></label>
        <p className="muted">Seul le SIRET est envoyé à l’Annuaire des entreprises pour la recherche. Vos coordonnées et précisions restent dans le dossier privé, accessible à vous et à l’équipe de validation Fidelity.</p>
        <button className="primary-button full" disabled={busy || checking || !form.authorized} type="submit">{busy ? 'Enregistrement du dossier…' : 'Envoyer mon dossier'}</button>
        <button className="outline-button full" disabled={busy} type="button" onClick={() => setShowForm(false)}>Fermer le formulaire</button>
      </form>}
      {notice && <p className="registration-notice" role="status"><CheckCircle2 size={18} />{notice}</p>}
      {error && <p className="card-action-error" role="alert">{error}</p>}
      {account.user.role === 'ADMIN' && <button className="settings-row" type="button" onClick={() => go('adminRestaurants')}><ShieldCheck size={20} /><span><strong>Valider les restaurants</strong><small>Administration Fidelity</small></span></button>}
    </>}
    <button type="button" className="outline-button full" style={{ marginTop: 18 }} onClick={() => switchRole?.('member')}>Revenir à l’espace membre</button>
  </main>
}

export function AdminRestaurantsPage() {
  const [items, setItems] = useState<RestaurantApplication[]>([]), [status, setStatus] = useState('PENDING')
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [selected, setSelected] = useState<RestaurantApplication | null>(null)
  const [note, setNote] = useState(''), [rejection, setRejection] = useState(''), [authority, setAuthority] = useState(false), [activity, setActivity] = useState(false), [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const refreshId = useRef(0)
  async function refresh() {
    const id = ++refreshId.current
    setLoading(true); setError(''); setItems([])
    try { const result = await fetchAdminApplications(status); if (id === refreshId.current) setItems(result) }
    catch (e) { if (id === refreshId.current) setError(reason(e)) }
    finally { if (id === refreshId.current) setLoading(false) }
  }
  useEffect(() => { void refresh(); return () => { refreshId.current++ } }, [status])
  async function decide(approve: boolean) {
    if (!selected || sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      await decideRestaurantApplication(selected.id, approve ? { approve: true, authorityVerified: true, activityVerified: true, verificationNote: note } : { approve: false, reason: rejection })
      setSelected(null); await refresh()
    } catch (e) { setError(reason(e)) } finally { sending.current = false; setBusy(false) }
  }
  return <main className="page registration-page"><span className="eyebrow">Administration Fidelity</span><h1>Validation des restaurants</h1>
    <p className="lead">Un SIRET public ne prouve pas le droit de gestion. Contactez l’établissement par un moyen trouvé indépendamment du formulaire et contrôlez l’autorisation du demandeur.</p>
    <div className="registration-heading"><label>Afficher<select disabled={busy} value={status} onChange={e => { setStatus(e.target.value); setSelected(null) }}><option value="PENDING">En attente</option><option value="APPROVED">Acceptés</option><option value="REJECTED">Refusés</option></select></label><button className="outline-button" disabled={busy || loading} onClick={() => void refresh()}><RefreshCw size={16} /> Actualiser</button></div>
    {loading ? <p role="status">Chargement…</p> : !items.length ? <p>Aucun dossier dans cette liste.</p> : items.map(item => <button type="button" disabled={busy} className="settings-row" key={item.id} onClick={() => { setSelected(item); setNote(''); setRejection(''); setAuthority(false); setActivity(false) }}><Store size={20} /><span><strong>{item.tradingName}</strong><small>{item.siret} · {item.city}</small><small>{statusName[item.status]}</small></span></button>)}
    {selected && <section className="form-section"><h2>{selected.tradingName}</h2><RegistryInfo registry={selected.registry} />
      <a className="text-link" href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${selected.siret}`} target="_blank" rel="noopener noreferrer">Consulter l’établissement dans l’annuaire officiel</a>
      <p>Adresse déclarée : {selected.address}, {selected.postalCode} {selected.city}</p><p>Cuisine : {selected.cuisine}</p>
      <p>{selected.contactName} · {({ OWNER: 'Dirigeant', MANAGER: 'Gérant', REPRESENTATIVE: 'Mandataire' })[selected.contactRole]}</p>
      <p>E-mail du compte : {selected.applicant?.email}<br />Téléphone déclaré : {selected.phone}</p>
      {selected.website && <a href={selected.website} target="_blank" rel="noopener noreferrer">Page déclarée par le demandeur</a>}{selected.message && <p>{selected.message}</p>}
      {selected.status === 'PENDING' ? <>
        <label className="registration-consent"><input type="checkbox" disabled={busy} checked={authority} onChange={e => setAuthority(e.target.checked)} /><span>J’ai vérifié, par un canal indépendant, l’autorisation de cette personne à gérer cet établissement.</span></label>
        <label className="registration-consent"><input type="checkbox" disabled={busy} checked={activity} onChange={e => setActivity(e.target.checked)} /><span>J’ai confirmé une activité de restauration à l’adresse officielle.</span></label>
        <label>Trace privée de la vérification<textarea value={note} disabled={busy} maxLength={1500} rows={4} onChange={e => setNote(e.target.value)} placeholder="Date, source indépendante du contact, contrôle de l’habilitation et de l’activité (30 caractères minimum). Aucun secret ni pièce d’identité." /></label>
        <button type="button" className="primary-button full" disabled={busy || !authority || !activity || note.trim().length < 30} onClick={() => void decide(true)}>{busy ? 'Décision en cours…' : 'Valider et rattacher le restaurant'}</button>
        <label>Motif du refus, visible par le demandeur<textarea value={rejection} disabled={busy} maxLength={500} onChange={e => setRejection(e.target.value)} placeholder="Indiquez ce qui doit être corrigé (10 caractères minimum)." /></label>
        <button type="button" className="outline-button full" disabled={busy || rejection.trim().length < 10} onClick={() => void decide(false)}>Refuser avec ce motif</button>
      </> : <><p>{selected.decisionReason}</p>{selected.verificationNote && <p>Trace privée : {selected.verificationNote}</p>}</>}
    </section>}
    {error && <p role="alert" className="card-action-error">{error}</p>}
  </main>
}
