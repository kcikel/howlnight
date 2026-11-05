import { useEffect, useState } from 'preact/hooks'
import QRCode from 'qrcode'

interface Props {
  url: string
  size?: number
}

export function RoomQr({ url, size = 180 }: Props) {
  const [dataUrl, setDataUrl] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: { dark: '#efe9ff', light: '#0b0a12' },
      errorCorrectionLevel: 'M',
    }).then((d) => {
      if (!cancelled) setDataUrl(d)
    })
    return () => {
      cancelled = true
    }
  }, [url, size])

  if (!dataUrl) return <div class="qr-box muted">…</div>
  return <img class="qr-box" src={dataUrl} width={size} height={size} alt="QR" />
}
