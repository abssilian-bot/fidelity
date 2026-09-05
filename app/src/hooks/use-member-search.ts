import { useEffect, useState } from 'react'
import type { Member } from '../data'
import { fetchMemberSearch } from '../lib/api'
import { normalizeSearch } from '../lib/search'

/** Annulation des requêtes dépassées : une réponse lente ne remplace pas une recherche plus récente. */
export function useMemberSearch(query: string, enabled: boolean) {
  const [result, setResult] = useState<{ query: string; items: Member[] | null; attempt: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const eligible = enabled && normalizeSearch(query).length >= 2
  useEffect(() => {
    if (!eligible) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetchMemberSearch(query, controller.signal).then((items) => {
        if (!controller.signal.aborted) setResult({ query, items, attempt })
      })
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, eligible, attempt])
  const current = eligible && result?.query === query && result.attempt === attempt ? result : null
  return { items: current?.items ?? [], loading: eligible && !current, error: current?.items === null, eligible, retry: () => setAttempt((value) => value + 1) }
}
