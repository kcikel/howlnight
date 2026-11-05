import type { ConnId, Transport } from './transport'

type PeerLike = {
  id: string
  on(event: string, cb: (...args: any[]) => void): void
  connect(id: string, opts?: { reliable?: boolean }): DataConn
  destroy(): void
}

type DataConn = {
  peer: string
  open: boolean
  on(event: string, cb: (...args: any[]) => void): void
  send(data: string): void
  close(): void
}

/**
 * PeerJS transport using the free public broker (0.peerjs.com) + Google STUN.
 * Star topology: host listens; players connect to hostPeerId.
 */
export function createPeerTransport(preferredId?: string): Transport {
  let peer: PeerLike | null = null
  let localId = preferredId ?? ''
  const conns = new Map<string, DataConn>()
  const onConn: Array<(c: ConnId) => void> = []
  const onData: Array<(c: ConnId, d: string) => void> = []
  const onClose: Array<(c: ConnId) => void> = []

  function wire(conn: DataConn, asIncoming: boolean) {
    const id = conn.peer
    conns.set(id, conn)
    conn.on('data', (data: unknown) => {
      const str = typeof data === 'string' ? data : String(data)
      for (const cb of onData) cb(id, str)
    })
    conn.on('close', () => {
      conns.delete(id)
      for (const cb of onClose) cb(id)
    })
    conn.on('error', () => {
      conns.delete(id)
      for (const cb of onClose) cb(id)
    })
    if (asIncoming || conn.open) {
      for (const cb of onConn) cb(id)
    } else {
      conn.on('open', () => {
        for (const cb of onConn) cb(id)
      })
    }
  }

  async function ensurePeer(id?: string): Promise<PeerLike> {
    if (peer) return peer
    const mod = await import('peerjs')
    const PeerCtor = (mod as any).Peer || (mod as any).default?.Peer || (mod as any).default
    peer = await new Promise<PeerLike>((resolve, reject) => {
      const p: PeerLike = new PeerCtor(id, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // Best-effort free public TURN (no account). May fail behind some NATs/DNS.
            {
              urls: [
                'turn:freeturn.net:3478',
                'turn:freeturn.net:3478?transport=tcp',
                'turns:freeturn.net:5349?transport=tcp',
              ],
              username: 'free',
              credential: 'free',
            },
          ],
        },
        debug: 1,
      })
      p.on('open', (openId: string) => {
        localId = openId
        resolve(p)
      })
      p.on('error', (err: { type?: string; message?: string }) => {
        reject(err)
      })
      // Incoming connections (host)
      p.on('connection', (conn: DataConn) => wire(conn, true))
    })
    return peer!
  }

  const api: Transport = {
    get localId() {
      return localId
    },
    async startHost(hostId: string) {
      await ensurePeer(hostId)
    },
    async connectToHost(hostId: string) {
      const p = await ensurePeer()
      return new Promise<ConnId>((resolve, reject) => {
        const conn = p.connect(hostId, { reliable: true })
        const t = setTimeout(() => reject(new Error('connect timeout')), 12000)
        conn.on('open', () => {
          clearTimeout(t)
          wire(conn, false)
          resolve(hostId)
        })
        conn.on('error', (e: Error) => {
          clearTimeout(t)
          reject(e)
        })
      })
    },
    send(connId, data) {
      const c = conns.get(connId)
      if (c?.open) c.send(data)
    },
    broadcast(data) {
      for (const c of conns.values()) {
        if (c.open) c.send(data)
      }
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
        conns.get(connId)?.close()
        conns.delete(connId)
      } else {
        for (const c of conns.values()) c.close()
        conns.clear()
      }
    },
    destroy() {
      api.close()
      peer?.destroy()
      peer = null
    },
  }
  return api
}
