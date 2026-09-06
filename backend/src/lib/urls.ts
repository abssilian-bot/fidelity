import { z } from 'zod'
// Liens HTTP(S) uniquement. Les médias locaux passent par /images/, jamais //hôte.
export const safeUrl = z.string().max(500).refine(value => {
  if (value === '') return true
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}, 'Adresse HTTP ou HTTPS attendue.')
export const safeImage = z.string().min(1).max(500).refine(value => /^\/images\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes('..') || safeUrl.safeParse(value).success, 'Adresse d’image invalide.')
