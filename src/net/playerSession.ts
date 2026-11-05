import { deriveRoomKey, isEncrypted, isPlain, open, packPlain, seal, unpackPlain } from './crypto'
import { randomToken } from './roomCode'
import type { Transport } from './transport'
import type {
  ClientToHost,
  HostToClient,
  LobbySeat,
  NightActionPayload,
  PrivateGameView,
  PublicGameView,
} from './types'

const STORAGE_KEY = 'howlnight-player-session'

export interface PlayerPersisted {
  code: string
  token: string
  playerId?: string
  name: string
}

export type PlayerListener = (snap: {
  connected: boolean
  playerId?: string
  seats: LobbySeat[]
  publicView: PublicGameView | null
  privateView: PrivateGameView | null
  error?: string
  kicked?: boolean
}) => void

export class PlayerSession {
  readonly code: string
  readonly token: string
  private name: string
  private playerId?: string
  private key: CryptoKey | null = null
  private hostConn?: string
  private seats: LobbySeat[] = []
  private publicView: PublicGameView | null = null
  private privateView: PrivateGameView | null = null
  private connected = false
  private error?: string
  private kicked = false
  private listeners: PlayerListener[] = []

  private transport: Transport

  constructor(
    transport: Transport,
    code: string,
    opts?: { name?: string; token?: string; playerId?: string },
  ) {
    this.transport = transport
    this.code = code.toUpperCase()
    this.token = opts?.token ?? randomToken()
    this.name = opts?.name?.trim() || ''
    this.playerId = opts?.playerId
  }

  onChange(cb: PlayerListener) {
    this.listeners.push(cb)
    queueMicrotask(() => this.emit())
    return () => {
      this.listeners = this.listeners.filter((x) => x !== cb)
    }
  }

  async connect(hostPeerId: string) {
    this.transport.onData((connId, raw) => {
      if (this.hostConn && connId !== this.hostConn) return
      void this.onRaw(raw)
    })
    this.transport.onClose((connId) => {
      if (connId === this.hostConn) {
        this.connected = false
        this.emit()
      }
    })
    this.hostConn = await this.transport.connectToHost(hostPeerId)
    this.connected = true
    const msg: ClientToHost = this.playerId
      ? { v: 1, type: 'rejoin', token: this.token }
      : { v: 1, type: 'join', name: this.name, token: this.token }
    this.transport.send(this.hostConn, packPlain(msg))
    this.persist()
    this.emit()
  }

  setName(name: string) {
    this.name = name.trim().slice(0, 20)
  }

  async sendNightAction(action: NightActionPayload) {
    await this.send({ v: 1, type: 'night_action', action })
  }

  async sendVote(targetId: string | 'skip') {
    await this.send({ v: 1, type: 'vote', targetId })
  }

  async sendHunterShot(targetId: string) {
    await this.send({ v: 1, type: 'hunter_shot', targetId })
  }

  async ackReveal() {
    await this.send({ v: 1, type: 'ack_reveal' })
  }

  destroy() {
    this.transport.destroy()
  }

  clearStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  persist() {
    try {
      const data: PlayerPersisted = {
        code: this.code,
        token: this.token,
        playerId: this.playerId,
        name: this.name,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }

  static load(): PlayerPersisted | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as PlayerPersisted
    } catch {
      return null
    }
  }

  private emit() {
    for (const cb of this.listeners) {
      cb({
        connected: this.connected,
        playerId: this.playerId,
        seats: this.seats,
        publicView: this.publicView,
        privateView: this.privateView,
        error: this.error,
        kicked: this.kicked,
      })
    }
  }

  private async onRaw(raw: string) {
    try {
      let msg: HostToClient
      if (isPlain(raw)) {
        msg = unpackPlain(raw)
      } else if (isEncrypted(raw)) {
        if (!this.key) return
        msg = await open(this.key, raw)
      } else return
      await this.onMessage(msg)
    } catch (e) {
      console.warn('player bad message', e)
    }
  }

  private async onMessage(msg: HostToClient) {
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.key = await deriveRoomKey(this.code, msg.salt)
      this.error = undefined
      this.persist()
      this.emit()
      // Ask host to re-send lobby/state now that the room key is ready.
      await this.send({ v: 1, type: 'sync' })
      return
    }
    if (msg.type === 'lobby') {
      this.seats = msg.seats
      this.emit()
      return
    }
    if (msg.type === 'public') {
      this.publicView = msg.view
      this.emit()
      return
    }
    if (msg.type === 'private') {
      this.privateView = msg.view
      this.emit()
      return
    }
    if (msg.type === 'error') {
      this.error = msg.message
      this.emit()
      return
    }
    if (msg.type === 'kicked') {
      this.kicked = true
      this.clearStorage()
      this.emit()
    }
  }

  private async send(msg: ClientToHost) {
    if (!this.hostConn) return
    if (!this.key) {
      this.transport.send(this.hostConn, packPlain(msg))
      return
    }
    this.transport.send(this.hostConn, await seal(this.key, msg))
  }
}
