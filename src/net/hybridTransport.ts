/**
 * Prefer PeerJS/WebRTC (with free TURN), fall back to Nostr relay when ICE fails.
 * Keeps AES-GCM sealed payloads from the session layer end-to-end.
 */
import { createNostrTransport } from './nostrTransport'
import { createPeerTransport } from './peerTransport'
import type { ConnId, Transport } from './transport'

export type TransportMode = 'peer' | 'nostr' | 'unknown'

export interface HybridTransport extends Transport {
  getMode(): TransportMode
  getWifiHintNeeded(): boolean
}

export function createHybridTransport(roomCode: string): HybridTransport {
  const peer = createPeerTransport()
  let nostr: ReturnType<typeof createNostrTransport> | null = null
  let mode: TransportMode = 'unknown'
  let wifiHint = false
  const onConn: Array<(c: ConnId) => void> = []
  const onData: Array<(c: ConnId, d: string) => void> = []
  const onClose: Array<(c: ConnId) => void> = []
  let active: Transport = peer

  function wire(t: Transport) {
    t.onConnection((c) => {
      for (const cb of onConn) cb(c)
    })
    t.onData((c, d) => {
      for (const cb of onData) cb(c, d)
    })
    t.onClose((c) => {
      for (const cb of onClose) cb(c)
    })
  }
  wire(peer)

  const api: HybridTransport = {
    get localId() {
      return active.localId
    },
    getMode: () => mode,
    getWifiHintNeeded: () => wifiHint,
    async startHost(hostId: string) {
      await peer.startHost(hostId)
      mode = 'peer'
      active = peer
      // Also listen on Nostr so players who cannot WebRTC can still join
      try {
        nostr = createNostrTransport(roomCode)
        wire(nostr)
        await nostr.startHost(hostId)
      } catch {
        nostr = null
      }
    },
    async connectToHost(hostId: string) {
      try {
        const id = await peer.connectToHost(hostId)
        mode = 'peer'
        active = peer
        return id
      } catch (peerErr) {
        try {
          nostr = createNostrTransport(roomCode)
          wire(nostr)
          const id = await nostr.connectToHost(hostId)
          mode = 'nostr'
          active = nostr
          return id
        } catch {
          wifiHint = true
          mode = 'unknown'
          const msg =
            peerErr instanceof Error ? peerErr.message : 'connect failed'
          throw new Error(
            `NEED_SAME_WIFI:${msg}`,
          )
        }
      }
    },
    send(connId, data) {
      // Prefer peer if that conn is open; also mirror on nostr when host
      try {
        peer.send(connId, data)
      } catch {
        /* */
      }
      if (nostr && (mode === 'nostr' || connId.startsWith('n-') || connId === 'host')) {
        nostr.send(connId, data)
      } else if (mode === 'nostr' && nostr) {
        nostr.send(connId, data)
      }
    },
    broadcast(data) {
      peer.broadcast(data)
      nostr?.broadcast(data)
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
      peer.close(connId)
      nostr?.close(connId)
    },
    destroy() {
      peer.destroy()
      nostr?.destroy()
      nostr = null
    },
  }
  return api
}
