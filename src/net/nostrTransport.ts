/**
 * Nostr ephemeral-event relay transport (fallback when WebRTC fails).
 * Free public relays, no accounts. Payloads are already AES-GCM sealed by the session layer.
 */
import { finalizeEvent, generateSecretKey, getPublicKey, type EventTemplate } from 'nostr-tools/pure'
import type { ConnId, Transport } from './transport'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const KIND = 20078 // ephemeral custom

function roomTopic(roomKey: string): string {
  return `howlnight:${roomKey.toUpperCase()}`
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

type WsLike = WebSocket

export function createNostrTransport(roomKey: string): Transport & { readonly mode: 'nostr' } {
  const sk = generateSecretKey()
  const pk = getPublicKey(sk)
  const topic = roomTopic(roomKey)
  let localId = `n-${pk.slice(0, 12)}`
  const conns = new Set<string>()
  const onConn: Array<(c: ConnId) => void> = []
  const onData: Array<(c: ConnId, d: string) => void> = []
  const onClose: Array<(c: ConnId) => void> = []
  const sockets: WsLike[] = []
  let role: 'host' | 'player' | null = null
  let hostId = ''
  let closed = false
  const seen = new Set<string>()

  function publish(to: string, data: string) {
    const tmpl: EventTemplate = {
      kind: KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['r', topic],
        ['p', to],
        ['from', localId],
      ],
      content: data,
    }
    const ev = finalizeEvent(tmpl, sk)
    const msg = JSON.stringify(['EVENT', ev])
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
  }

  function handleEvent(ev: {
    id: string
    pubkey: string
    content: string
    tags: string[][]
  }) {
    if (seen.has(ev.id)) return
    seen.add(ev.id)
    if (seen.size > 500) {
      const first = seen.values().next().value
      if (first) seen.delete(first)
    }
    const from = ev.tags.find((t) => t[0] === 'from')?.[1] || `n-${ev.pubkey.slice(0, 12)}`
    const to = ev.tags.find((t) => t[0] === 'p')?.[1]
    if (!to) return
    if (from === localId) return
    const forMe = to === localId || to === '*' || (role === 'host' && to === 'host')
    if (!forMe) return
    if (!conns.has(from)) {
      conns.add(from)
      for (const cb of onConn) cb(from)
    }
    for (const cb of onData) cb(from, ev.content)
  }

  async function openRelay(url: string): Promise<WsLike | null> {
    return new Promise((resolve) => {
      let settled = false
      try {
        const ws = new WebSocket(url)
        const t = setTimeout(() => {
          if (!settled) {
            settled = true
            try {
              ws.close()
            } catch {
              /* */
            }
            resolve(null)
          }
        }, 6000)
        ws.onopen = () => {
          clearTimeout(t)
          settled = true
          const subId = bytesToHex(crypto.getRandomValues(new Uint8Array(4)))
          ws.send(JSON.stringify(['REQ', subId, { kinds: [KIND], '#r': [topic], limit: 0 }]))
          ws.onmessage = (ev) => {
            try {
              const msg = JSON.parse(String(ev.data))
              if (Array.isArray(msg) && msg[0] === 'EVENT' && msg[2]) handleEvent(msg[2])
            } catch {
              /* */
            }
          }
          resolve(ws)
        }
        ws.onerror = () => {
          clearTimeout(t)
          if (!settled) {
            settled = true
            resolve(null)
          }
        }
      } catch {
        resolve(null)
      }
    })
  }

  async function ensureRelays() {
    if (sockets.length) return
    const opened = await Promise.all(RELAYS.map(openRelay))
    for (const ws of opened) if (ws) sockets.push(ws)
    if (!sockets.length) throw new Error('NOSTR_UNREACHABLE')
  }

  const api: Transport & { mode: 'nostr' } = {
    mode: 'nostr',
    get localId() {
      return localId
    },
    async startHost(id: string) {
      role = 'host'
      hostId = id
      localId = `host-${topic}`
      await ensureRelays()
    },
    async connectToHost(id: string) {
      role = 'player'
      hostId = id
      await ensureRelays()
      // Announce presence to host
      publish('host', JSON.stringify({ v: 1, type: 'nostr_hello', from: localId }))
      // Treat host as connected
      const hostConn = 'host'
      conns.add(hostConn)
      for (const cb of onConn) cb(hostConn)
      return hostConn
    },
    send(connId, data) {
      const to = role === 'player' ? 'host' : connId
      publish(to, data)
    },
    broadcast(data) {
      publish('*', data)
    },
    onConnection(cb) {
      onConn.push(cb)
    },
    onData(cb) {
      onData.push(cb)
    },
    onClose(cb) {
      onClose.push(cb)
    },
    close(connId) {
      if (connId) {
        conns.delete(connId)
        for (const cb of onClose) cb(connId)
      } else {
        for (const c of [...conns]) for (const cb of onClose) cb(c)
        conns.clear()
      }
    },
    destroy() {
      closed = true
      api.close()
      for (const ws of sockets) {
        try {
          ws.close()
        } catch {
          /* */
        }
      }
      sockets.length = 0
      void closed
      void hostId
    },
  }
  return api
}
