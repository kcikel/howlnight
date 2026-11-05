/** Minimal message bus: host <-> players identified by connection id. */

export type ConnId = string

export interface Transport {
  readonly localId: string
  /** Host: accept incoming connections. Player: connect to hostId. */
  startHost(hostId: string): Promise<void>
  connectToHost(hostId: string): Promise<ConnId>
  send(connId: ConnId, data: string): void
  broadcast(data: string): void
  onConnection(cb: (connId: ConnId) => void): void
  onData(cb: (connId: ConnId, data: string) => void): void
  onClose(cb: (connId: ConnId) => void): void
  close(connId?: ConnId): void
  destroy(): void
}

export type TransportFactory = () => Transport
