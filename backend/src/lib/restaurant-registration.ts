import { z } from 'zod'

export function validSiret(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^0+$/.test(value)) return false
  // Le cas particulier de La Poste est également confirmé dans le registre officiel.
  if (value.startsWith('356000000')) return [...value].reduce((n, v) => n + Number(v), 0) % 5 === 0
  return [...value].reduce((sum, digit, index) => { const n = Number(digit) * (index % 2 === 0 ? 2 : 1); return sum + (n > 9 ? n - 9 : n) }, 0) % 10 === 0
}
export const siretSchema = z.string().trim().transform(s => s.replace(/\s/g, '')).refine(validSiret, 'Le SIRET doit contenir 14 chiffres valides.')
const text = (max: number) => z.string().trim().min(2).max(max)
export const applicationSchema = z.object({
  siret: siretSchema, tradingName: text(120), cuisine: text(80), address: text(200),
  postalCode: z.string().trim().regex(/^\d{5}$/, 'Code postal à 5 chiffres.'), city: text(80),
  contactName: text(120), contactRole: z.enum(['OWNER', 'MANAGER', 'REPRESENTATIVE']),
  phone: z.string().trim().transform(s => s.replace(/[ .()\-]/g, '')).pipe(z.string().regex(/^(?:0[1-9]\d{8}|\+[1-9]\d{8,14})$/, 'Téléphone invalide.')),
  website: z.union([z.literal(''), z.url().max(500).refine(s => { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password }, 'Utilisez une adresse HTTPS publique.')]).default(''),
  message: z.string().trim().max(1000).default(''), authorized: z.literal(true),
}).strict()

export type RegistryResult = { state: 'FOUND' | 'NOT_FOUND' | 'UNAVAILABLE'; siret: string; legalName?: string; address?: string; postalCode?: string; city?: string; activity?: string; active?: boolean; checkedAt: string }
const establishment = z.object({ siret: z.string(), adresse: z.string().nullish(), code_postal: z.string().nullish(), libelle_commune: z.string().nullish(), activite_principale: z.string().nullish(), etat_administratif: z.string().nullish() })
const registryResponse = z.object({ results: z.array(z.object({ nom_complet: z.string().nullish(), nom_raison_sociale: z.string().nullish(), etat_administratif: z.string().nullish(), siege: establishment.nullish(), matching_etablissements: z.array(establishment).optional() })).max(25) })

export function parseRegistry(siret: string, raw: unknown): RegistryResult {
  const result = registryResponse.parse(raw)
  for (const company of result.results) {
    const exact = [...(company.matching_etablissements ?? []), company.siege].find(e => e?.siret === siret)
    if (exact) return { state: 'FOUND', siret, legalName: company.nom_raison_sociale || company.nom_complet || '', address: exact.adresse || '', postalCode: exact.code_postal || '', city: exact.libelle_commune || '', activity: exact.activite_principale || '', active: exact.etat_administratif === 'A' && company.etat_administratif === 'A', checkedAt: new Date().toISOString() }
  }
  return { state: 'NOT_FOUND', siret, checkedAt: new Date().toISOString() }
}

// URL fixe : un demandeur ne choisit jamais le serveur interrogé. Aucun nom/contact transmis.
export async function lookupSiret(siret: string): Promise<RegistryResult> {
  const validated = siretSchema.parse(siret)
  try {
    const url = new URL('https://recherche-entreprises.api.gouv.fr/search')
    url.search = new URLSearchParams({ q: validated, per_page: '1', minimal: 'true', include: 'siege,matching_etablissements' }).toString()
    const res = await fetch(url, { signal: AbortSignal.timeout(7000), redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': 'Fidelity/1.0 (verification des inscriptions restaurants)' } })
    if (!res.ok) throw new Error('Annuaire indisponible')
    return parseRegistry(validated, await res.json())
  } catch { return { state: 'UNAVAILABLE', siret: validated, checkedAt: new Date().toISOString() } }
}

export function isConfiguredAdmin(email: string): boolean {
  return (process.env.FIDELITY_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())
}
