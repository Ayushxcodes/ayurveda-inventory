import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function CameraQRScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let mounted = true
    async function start() {
      setError(null)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device')
        return
      }
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (!mounted) { stream.getTracks().forEach(t=>t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setScanning(true)
        scanLoop()
      } catch (e: any) {
        setError(e?.message || 'Could not access camera')
      }
    }

    let raf = 0
    const scanLoop = async () => {
      try {
        if (!videoRef.current) return
        const video = videoRef.current
        // Use native BarcodeDetector when available
        const BarcodeDetectorClass = (window as any).BarcodeDetector
        if (BarcodeDetectorClass) {
          const detector = new BarcodeDetectorClass({ formats: ['qr_code'] })
          // Some platforms perform better if we pass an ImageBitmap instead of the video element
          try {
            let img: ImageBitmap | null = null
            try {
              img = await createImageBitmap(video as any)
            } catch (_) {
              img = null
            }
            const target = img || video
            const results = await detector.detect(target)
            if (img) img.close()
            if (results && results.length) {
              const code = results[0].rawValue || (results[0] as any).rawData || ''
              stop()
              onDetected(code)
              return
            }
          } catch (detErr) {
            // detector failed on this frame, continue
          }
        } else {
          // Fallback: draw to canvas and try to read via ImageBitmap + detection if supported
          // Many browsers support BarcodeDetector; otherwise we cannot decode here without an external lib.
        }
      } catch (e) {
        // ignore detection errors
      }
      raf = requestAnimationFrame(scanLoop)
    }

    function stop() {
      setScanning(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }

    start()

    return () => {
      mounted = false
      stop()
      try { cancelAnimationFrame(raf) } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 480, maxWidth: '94%', background: '#fff', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600 }}>Scan QR</div>
          <button onClick={() => { try { if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()) } catch(e){}; onClose() }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
          {error ? (
            <div style={{ color: '#b91c1c' }}>{error}</div>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <video ref={videoRef} style={{ width: 360, height: 270, background: '#000', borderRadius: 6 }} playsInline muted />
              <div style={{ maxWidth: 200, fontSize: 13, color: '#555' }}>
                <div style={{ marginBottom: 8 }}>{scanning ? 'Point the camera at a QR code to scan. Avoid glare and hold steady.' : 'Initializing camera...'}</div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Tips: increase camera distance, good lighting, avoid glare. If detection still fails, use the "Capture frame" button below and try scanning the saved image with your phone.
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button onClick={() => {
                    try {
                      const v = videoRef.current
                      if (!v) return
                      const c = document.createElement('canvas')
                      c.width = v.videoWidth || 1280
                      c.height = v.videoHeight || 720
                      const ctx = c.getContext('2d')
                      if (ctx) ctx.drawImage(v, 0, 0, c.width, c.height)
                      const url = c.toDataURL('image/png')
                      window.open(url, '_blank')
                    } catch (e) { }
                  }} style={{ padding: '8px 10px', borderRadius: 6 }}>Capture frame</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
