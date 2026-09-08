import { useState } from 'react'

/** Secours sans accès caméra : l'image reste sur l'appareil. */
export function QrImageInput({ onCode, disabled }: { onCode: (code: string) => void; disabled: boolean }) {
  const [error, setError] = useState(''), [reading, setReading] = useState(false)
  async function read(file?: File) {
    if (!file || reading || disabled) return
    setError(''); setReading(true)
    const url = URL.createObjectURL(file)
    try {
      if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error('Choisis une image de QR de moins de 10 Mo.')
      const photo = new Image(); photo.src = url; await photo.decode()
      const scale = Math.min(1, 1600 / Math.max(photo.naturalWidth, photo.naturalHeight))
      const canvas = document.createElement('canvas'); canvas.width = Math.round(photo.naturalWidth * scale); canvas.height = Math.round(photo.naturalHeight * scale)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Lecture d’image indisponible.')
      ctx.drawImage(photo, 0, 0, canvas.width, canvas.height)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), { default: jsQR } = await import('jsqr')
      const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' })
      if (!result?.data) throw new Error('Aucun QR lisible dans cette image. Choisis une photo nette et complète du code.')
      onCode(result.data)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Image illisible.') }
    finally { URL.revokeObjectURL(url); setReading(false) }
  }
  return <div className="scan-manual"><label htmlFor="scan-image">{reading ? 'Lecture de l’image…' : 'Ou lire un QR depuis une image'}
    <input id="scan-image" type="file" accept="image/*" disabled={disabled || reading} onChange={event => { void read(event.target.files?.[0]); event.target.value = '' }} />
  </label>{error && <p className="card-action-error" role="alert">{error}</p>}</div>
}
