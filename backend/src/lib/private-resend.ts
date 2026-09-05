import { Resend } from 'resend'
import type { Response as ResendResponse } from 'resend'

/** Le SDK journalise les réponses d'erreur en développement. Le transport public
 * est remplacé pour garantir qu'un prestataire ne puisse renvoyer un lien dans les logs. */
export class PrivateResend extends Resend {
  override async fetchRequest<T>(path: string, options: RequestInit = {}): Promise<ResendResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(8_000) })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error('Envoi refusé')
      }
      return { data: await response.json() as T, error: null, headers: null }
    } catch {
      return { data: null, error: { name: 'application_error', statusCode: null, message: 'Envoi indisponible.' }, headers: null }
    }
  }
}
