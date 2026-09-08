import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw } from 'lucide-react'

export function QrCamera({ onCode }: { onCode: (value: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const callback = useRef(onCode)
  callback.current = onCode
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false, paused = document.hidden, stream: MediaStream | undefined, frame = 0, last = 0
    const stop = () => { cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()) }
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('La caméra nécessite une connexion HTTPS. Tu peux aussi coller le code du client ci-dessous.')
        const { default: jsQR } = await import('jsqr')
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
        if (cancelled || paused || !video.current) { stop(); return }
        video.current.srcObject = stream
        await video.current.play()
        if (cancelled || paused) { stop(); return }
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })
        const scan = (time: number) => {
          if (cancelled || paused) return
          if (video.current && context && video.current.readyState >= 2 && time - last > 180) {
            last = time
            const width = Math.min(video.current.videoWidth, 800)
            canvas.width = width; canvas.height = Math.round(width * video.current.videoHeight / video.current.videoWidth)
            if (canvas.width && canvas.height) {
              context.drawImage(video.current, 0, 0, canvas.width, canvas.height)
              const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
              const result = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' })
              if (result?.data) { stop(); callback.current(result.data); return }
            }
          }
          frame = requestAnimationFrame(scan)
        }
        frame = requestAnimationFrame(scan)
      } catch (cause) {
        stop()
        if (!cancelled) setError(cause instanceof DOMException ? cause.name === 'NotAllowedError' ? 'Accès caméra refusé. Autorise la caméra dans le navigateur, ou colle le code du client.' : 'Aucune caméra disponible. Branche une caméra ou colle le code de secours du client.' : cause instanceof Error ? cause.message : 'Caméra indisponible. Utilise le code de secours.')
      }
    }
    setError(''); void start()
    const pause = () => { if (document.hidden) { paused = true; stop(); setError('Caméra en pause. Reprends le scan pour continuer.') } }
    document.addEventListener('visibilitychange', pause)
    return () => { cancelled = true; stop(); document.removeEventListener('visibilitychange', pause) }
  }, [attempt])
  return <div className="camera-box">
    <video ref={video} muted playsInline aria-label="Caméra de lecture du QR client" />
    <div className="camera-guide" aria-hidden="true" />
    {error ? <div className="camera-message"><Camera size={26} /><p role="status">{error}</p><button type="button" className="outline-button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16} /> Réactiver la caméra</button></div>
      : <span className="camera-hint">Place le QR du client dans le cadre</span>}
  </div>
}
