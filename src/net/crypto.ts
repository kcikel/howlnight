/**
 * End-to-end payload encryption derived from room code + host salt.
 * WebRTC DataChannels are already DTLS-encrypted; this protects any future
 * public-relay fallback and keeps roles opaque if a message is logged.
 */

function toBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function deriveRoomKey(roomCode: string, saltB64: string): Promise<CryptoKey> {
  const salt = fromB64(saltB64) as BufferSource
  const material = toBytes(roomCode.toUpperCase()) as BufferSource
  const base = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function randomSaltB64(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return b64(arr)
}

export async function seal(key: CryptoKey, obj: unknown): Promise<string> {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const plain = toBytes(JSON.stringify(obj)) as BufferSource
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain)
  return `e1.${b64(iv)}.${b64(cipher)}`
}

export async function open<T = unknown>(key: CryptoKey, packed: string): Promise<T> {
  const [tag, ivB64, dataB64] = packed.split('.')
  if (tag !== 'e1' || !ivB64 || !dataB64) throw new Error('bad envelope')
  const iv = fromB64(ivB64)
  const data = fromB64(dataB64)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource)
  return JSON.parse(new TextDecoder().decode(plain)) as T
}

/** Plain JSON for the pre-key handshake (welcome/join carry salt). */
export function packPlain(obj: unknown): string {
  return `p1.${b64(toBytes(JSON.stringify(obj)))}`
}

export function unpackPlain<T = unknown>(packed: string): T {
  if (!packed.startsWith('p1.')) throw new Error('not plain')
  return JSON.parse(new TextDecoder().decode(fromB64(packed.slice(3)))) as T
}

export function isEncrypted(packed: string): boolean {
  return packed.startsWith('e1.')
}

export function isPlain(packed: string): boolean {
  return packed.startsWith('p1.')
}
