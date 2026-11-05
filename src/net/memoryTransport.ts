import type { ConnId, Transport } from './transport'

type BusHandler = {
  id: string
  onConn: Array<(c: ConnId) => void>
  onData: Array<(c: ConnId, d: string) => void>
  onClose: Array<(c: ConnId) => void>
  peers: Set<ConnId>
  isHost: boolean
  hostId?: string
}

/** Shared in-process bus for unit / e2e tests (no network). */
const rooms = new Map<string, { host?: BusHandler; clients: Map<string, BusHandler> }>()

let seq = 0
function nid(prefix: string) {
  return `${prefix}-${++seq}-${Math.random().toString(36).slice(2, 7)}`
}

export function resetMemoryRooms() {
  rooms.clear()
  seq = 0
}

export function createMemoryTransport(): Transport {
  const localId = nid('mem')
  const handler: BusHandler = {
    id: localId,
    onConn: [],
    onData: [],
    onClose: [],
    peers: new Set(),
    isHost: false,
  }
  let roomKey: string | undefined

  const api: Transport = {
    localId,
    async startHost(hostId: string) {
      roomKey = hostId
      handler.isHost = true
      handler.hostId = hostId
      let room = rooms.get(hostId)
      if (!room) {
        room = { clients: new Map() }
        rooms.set(hostId, room)
      }
      if (room.host) throw new Error('host already exists')
      room.host = handler
    },
    async connectToHost(hostId: string) {
      roomKey = hostId
      const room = rooms.get(hostId)
      if (!room?.host) throw new Error('host not found')
      handler.hostId = hostId
      room.clients.set(localId, handler)
      // Bidirectional link: host sees client id, client sees host id as conn
      const hostConn = localId
      const clientViewOfHost = room.host.id
      handler.peers.add(clientViewOfHost)
      room.host.peers.add(hostConn)
      for (const cb of room.host.onConn) cb(hostConn)
      for (const cb of handler.onConn) cb(clientViewOfHost)
      return clientViewOfHost
    },
    send(connId, data) {
      const room = roomKey ? rooms.get(roomKey) : undefined
      if (!room) return
      if (handler.isHost) {
        const client = room.clients.get(connId)
        if (client) for (const cb of client.onData) cb(room.host!.id, data)
      } else {
        const host = room.host
        if (host && connId === host.id) for (const cb of host.onData) cb(localId, data)
      }
    },
    broadcast(data) {
      if (!handler.isHost || !roomKey) return
      const room = rooms.get(roomKey)
      if (!room) return
      for (const [cid, client] of room.clients) {
        for (const cb of client.onData) cb(room.host!.id, data)
        void cid
      }
    },
    onConnection(cb) {
      handler.onConn.push(cb)
    },
    onData(cb) {
      handler.onData.push(cb)
    },
    onClose(cb) {
      handler.onClose.push(cb)
    },
    close(connId) {
      if (!roomKey) return
      const room = rooms.get(roomKey)
      if (!room) return
      if (handler.isHost && connId) {
        const client = room.clients.get(connId)
        if (client) {
          room.clients.delete(connId)
          for (const cb of client.onClose) cb(room.host!.id)
          for (const cb of handler.onClose) cb(connId)
        }
      } else if (!handler.isHost && room.host) {
        room.clients.delete(localId)
        for (const cb of room.host.onClose) cb(localId)
        for (const cb of handler.onClose) cb(room.host.id)
      }
    },
    destroy() {
      if (!roomKey) return
      const room = rooms.get(roomKey)
      if (!room) return
      if (handler.isHost) {
        for (const [cid, client] of room.clients) {
          for (const cb of client.onClose) cb(room.host!.id)
          void cid
        }
        room.clients.clear()
        room.host = undefined
        if (room.clients.size === 0) rooms.delete(roomKey)
      } else {
        api.close()
      }
      roomKey = undefined
    },
  }
  return api
}
