/** 4-letter room codes — no I/O/0/1 to avoid confusion when spoken aloud. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += ALPHABET[Math.floor(rng() * ALPHABET.length)]
  }
  return code
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .replace(/[IO]/g, '')
    .slice(0, 4)
}

export function isValidRoomCode(code: string): boolean {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/.test(code)
}

/** PeerJS peer id for the host of a room. */
export function hostPeerId(code: string): string {
  return `hn${normalizeRoomCode(code)}`
}

export function roomShareUrl(code: string, origin = typeof location !== 'undefined' ? location.origin : ''): string {
  const base = origin || 'https://kcikel.github.io'
  return `${base}/howlnight/?room=${normalizeRoomCode(code)}`
}

export function randomToken(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr)
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}
