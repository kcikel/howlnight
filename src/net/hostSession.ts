import {
  beginNight,
  castVote,
  continueAfterElimination,
  createGame,
  finishNight,
  finishVote,
  hunterShoot,
  livingPlayers,
  presetForCount,
  setNightAction,
  startDayDiscuss,
  startDayVote,
  type GameState,
  type RoleId,
} from '../engine'
import { deriveRoomKey, isEncrypted, isPlain, open, packPlain, randomSaltB64, seal, unpackPlain } from './crypto'
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
import { nightActionToPatch } from './types'
import { buildNightSteps, buildPrivateView, buildPublicView, lobbySeats } from './views'

export interface HostSeat {
  id: string
  name: string
  token: string
  isHost: boolean
  connId?: string
}

export interface HostSessionSnapshot {
  code: string
  salt: string
  seats: HostSeat[]
  roleCounts: Partial<Record<RoleId, number>>
  game: GameState | null
  nightStepIndex: number
  revealed: Record<string, boolean>
  dawnDied?: PublicGameView['dawnDied']
  eliminated?: PublicGameView['eliminated']
  discussEndsAt?: number
  discussPaused: boolean
  started: boolean
  discussSecondsPref?: number
}

export type HostListener = (snap: {
  seats: LobbySeat[]
  publicView: PublicGameView | null
  privateViews: Record<string, PrivateGameView>
  canStart: boolean
  game: GameState | null
}) => void

const STORAGE_KEY = 'howlnight-host-session'

export class HostSession {
  readonly code: string
  readonly salt: string
  private key: CryptoKey | null = null
  private seats: HostSeat[] = []
  private roleCounts: Partial<Record<RoleId, number>>
  private game: GameState | null = null
  private nightStepIndex = 0
  private revealed: Record<string, boolean> = {}
  private dawnDied?: PublicGameView['dawnDied']
  private eliminated?: PublicGameView['eliminated']
  private discussEndsAt?: number
  private discussPaused = false
  private started = false
  private discussSecondsPref = 180
  private listeners: HostListener[] = []
  private connToPlayer = new Map<string, string>()

  private transport: Transport

  constructor(
    transport: Transport,
    code: string,
    opts?: { hostName?: string; hostToken?: string; restore?: HostSessionSnapshot },
  ) {
    this.transport = transport
    this.code = code.toUpperCase()
    if (opts?.restore) {
      const r = opts.restore
      this.salt = r.salt
      this.seats = r.seats.map((s) => ({ ...s, connId: undefined }))
      this.roleCounts = r.roleCounts
      this.game = r.game
      this.nightStepIndex = r.nightStepIndex
      this.revealed = r.revealed
      this.dawnDied = r.dawnDied
      this.eliminated = r.eliminated
      this.discussEndsAt = r.discussEndsAt
      this.discussPaused = r.discussPaused
      this.started = r.started
      this.discussSecondsPref = r.discussSecondsPref ?? 180
    } else {
      this.salt = randomSaltB64()
      this.roleCounts = presetForCount(4)
      const hostToken = opts?.hostToken ?? randomToken()
      const hostId = `h-${randomToken(6)}`
      this.seats.push({
        id: hostId,
        name: opts?.hostName?.trim() || 'Host',
        token: hostToken,
        isHost: true,
      })
    }

    transport.onConnection((connId) => {
      // Wait for join/rejoin message
      void connId
    })
    transport.onData((connId, raw) => {
      void this.onRaw(connId, raw)
    })
    transport.onClose((connId) => {
      const pid = this.connToPlayer.get(connId)
      if (pid) {
        this.connToPlayer.delete(connId)
        const seat = this.seats.find((s) => s.id === pid)
        if (seat) seat.connId = undefined
        this.emit()
        void this.broadcastState()
      }
    })
  }

  async init() {
    this.key = await deriveRoomKey(this.code, this.salt)
    this.persist()
    this.emit()
  }

  onChange(cb: HostListener) {
    this.listeners.push(cb)
    // Push current snapshot so late subscribers (e.g. RoomPlay after start) are not blank.
    queueMicrotask(() => this.emit())
    return () => {
      this.listeners = this.listeners.filter((x) => x !== cb)
    }
  }

  getHostSeat() {
    return this.seats.find((s) => s.isHost)!
  }

  getSnapshot(): HostSessionSnapshot {
    return {
      code: this.code,
      salt: this.salt,
      seats: this.seats.map(({ connId: _c, ...s }) => s),
      roleCounts: this.roleCounts,
      game: this.game,
      nightStepIndex: this.nightStepIndex,
      revealed: this.revealed,
      dawnDied: this.dawnDied,
      eliminated: this.eliminated,
      discussEndsAt: this.discussEndsAt,
      discussPaused: this.discussPaused,
      started: this.started,
      discussSecondsPref: this.discussSecondsPref,
    }
  }

  setHostName(name: string) {
    const h = this.getHostSeat()
    h.name = name.trim() || h.name
    this.persist()
    this.emit()
    void this.broadcastLobby()
  }

  setRoleCounts(counts: Partial<Record<RoleId, number>>) {
    if (this.started) return
    this.roleCounts = counts
    this.persist()
    this.emit()
  }

  setDiscussSeconds(seconds: number) {
    if (this.started) return
    this.discussSecondsPref = Math.max(30, Math.min(600, Math.floor(seconds)))
    this.persist()
    this.emit()
  }

  getDiscussSeconds() {
    return this.discussSecondsPref
  }

  /** Reset game state but keep seats/connections — play another round in the same room. */
  playAgainSameRoom() {
    if (!this.started) return
    this.game = null
    this.nightStepIndex = 0
    this.revealed = {}
    this.dawnDied = undefined
    this.eliminated = undefined
    this.discussEndsAt = undefined
    this.discussPaused = false
    this.started = false
    this.persist()
    this.emit()
    void this.broadcastLobby()
  }

  kick(playerId: string) {
    if (this.started) return
    const seat = this.seats.find((s) => s.id === playerId)
    if (!seat || seat.isHost) return
    if (seat.connId) {
      void this.sendToConn(seat.connId, { v: 1, type: 'kicked' })
      this.transport.close(seat.connId)
    }
    this.seats = this.seats.filter((s) => s.id !== playerId)
    this.persist()
    this.emit()
    void this.broadcastLobby()
  }

  canStart(): boolean {
    const n = this.seats.length
    return !this.started && n >= 4 && n <= 20 && this.seats.every((s) => s.name.trim().length > 0)
  }

  startGame(rng: () => number = Math.random) {
    if (!this.canStart()) throw new Error('cannot start')
    const counts = { ...this.roleCounts }
    // Ensure preset matches count
    const n = this.seats.length
    const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
    if (total !== n) this.roleCounts = presetForCount(n)

    this.game = createGame(
      {
        players: this.seats.map((s) => ({ id: s.id, name: s.name })),
        roleCounts: this.roleCounts,
        discussSeconds: this.discussSecondsPref,
      },
      rng,
    )
    this.started = true
    this.nightStepIndex = 0
    this.revealed = Object.fromEntries(this.seats.map((s) => [s.id, false]))
    this.dawnDied = undefined
    this.eliminated = undefined
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  /** Host advances after local reveal ack or forces all revealed. */
  markRevealed(playerId: string) {
    this.revealed[playerId] = true
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  allRevealed(): boolean {
    return this.seats.every((s) => this.revealed[s.id])
  }

  beginFirstNight() {
    if (!this.game || this.game.phase !== 'role_reveal') return
    if (!this.allRevealed()) {
      // auto-mark remaining
      for (const s of this.seats) this.revealed[s.id] = true
    }
    this.game = beginNight(this.game)
    this.nightStepIndex = 0
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  /** Host narrator advances night intro / done; role steps wait for player action or host skip. */
  advanceNightStep() {
    if (!this.game) return
    const steps = buildNightSteps(this.game)
    const step = steps[this.nightStepIndex]
    if (!step) return
    if (step.kind === 'role') {
      // host skip for this role
      this.nightStepIndex = Math.min(this.nightStepIndex + 1, steps.length - 1)
    } else if (step.kind === 'intro' || step.kind === 'done') {
      if (step.kind === 'done') {
        this.finishNightPhase()
        return
      }
      this.nightStepIndex = Math.min(this.nightStepIndex + 1, steps.length - 1)
    }
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  private finishNightPhase() {
    if (!this.game) return
    const beforeAlive = new Set(this.game.players.filter((p) => p.alive).map((p) => p.id))
    this.game = finishNight(this.game)
    const died = this.game.players
      .filter((p) => beforeAlive.has(p.id) && !p.alive)
      .map((p) => ({ id: p.id, name: p.name, role: p.role }))
    this.dawnDied = died
    this.eliminated = undefined
    this.nightStepIndex = 0
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  continueDawn() {
    if (!this.game || this.game.phase !== 'dawn') return
    this.game = startDayDiscuss(this.game)
    this.discussEndsAt = Date.now() + this.game.discussSeconds * 1000
    this.discussPaused = false
    this.dawnDied = undefined
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  setDiscussPaused(paused: boolean) {
    if (!this.game || this.game.phase !== 'day_discuss') return
    if (paused && !this.discussPaused && this.discussEndsAt) {
      const left = Math.max(0, this.discussEndsAt - Date.now())
      this.game = { ...this.game, discussSeconds: Math.ceil(left / 1000) }
      this.discussEndsAt = undefined
    } else if (!paused && this.discussPaused) {
      this.discussEndsAt = Date.now() + this.game.discussSeconds * 1000
    }
    this.discussPaused = paused
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  goToVote() {
    if (!this.game || this.game.phase !== 'day_discuss') return
    this.game = startDayVote(this.game)
    this.discussEndsAt = undefined
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  revealVotes() {
    if (!this.game || this.game.phase !== 'day_vote') return
    const living = livingPlayers(this.game)
    if (this.game.votes.length < living.length) return
    const before = new Map(this.game.players.map((p) => [p.id, p.alive]))
    this.game = finishVote(this.game)
    const changed = this.game.players
      .filter((p) => before.get(p.id) && !p.alive)
      .map((p) => ({ id: p.id, name: p.name, role: p.role }))
    this.eliminated = changed
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  continueAfterElim() {
    if (!this.game) return
    if (this.game.winner || this.game.phase === 'game_over') return
    if (this.game.phase === 'elimination') {
      this.game = continueAfterElimination(this.game)
      this.eliminated = undefined
      this.nightStepIndex = 0
      this.persist()
      this.emit()
      void this.broadcastState()
    }
  }

  applyHunterShot(targetId: string) {
    if (!this.game || this.game.phase !== 'hunter_revenge') return
    const before = new Set(this.game.players.filter((p) => p.alive).map((p) => p.id))
    this.game = hunterShoot(this.game, targetId)
    const died = this.game.players
      .filter((p) => before.has(p.id) && !p.alive)
      .map((p) => ({ id: p.id, name: p.name, role: p.role }))
    if (this.game.phase === 'dawn') {
      this.dawnDied = [...(this.dawnDied ?? []), ...died]
    } else {
      this.eliminated = died
    }
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  /** Local host player actions (same validation as remote). */
  submitNightAction(playerId: string, action: NightActionPayload) {
    this.handleNightAction(playerId, action)
  }

  submitVote(playerId: string, targetId: string | 'skip') {
    this.handleVote(playerId, targetId)
  }

  destroy() {
    this.transport.destroy()
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getSnapshot()))
    } catch {
      /* ignore */
    }
  }

  static loadSnapshot(): HostSessionSnapshot | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as HostSessionSnapshot
    } catch {
      return null
    }
  }

  private connectedIds(): Set<string> {
    const set = new Set<string>()
    for (const s of this.seats) {
      if (s.isHost || s.connId) set.add(s.id)
    }
    return set
  }

  private emit() {
    const connected = this.connectedIds()
    const seats = lobbySeats(
      this.seats.map((s) => ({ id: s.id, name: s.name, isHost: s.isHost })),
      connected,
    )
    let publicView: PublicGameView | null = null
    const privateViews: Record<string, PrivateGameView> = {}
    if (this.game) {
      publicView = buildPublicView({
        state: this.game,
        connected,
        nightStepIndex: this.nightStepIndex,
        discussEndsAt: this.discussEndsAt,
        discussPaused: this.discussPaused,
        dawnDied: this.dawnDied,
        eliminated: this.eliminated,
      })
      for (const s of this.seats) {
        privateViews[s.id] = buildPrivateView({
          state: this.game,
          playerId: s.id,
          isHost: s.isHost,
          nightStepIndex: this.nightStepIndex,
          revealed: Boolean(this.revealed[s.id]),
        })
      }
    } else {
      publicView = {
        phase: 'lobby',
        day: 0,
        players: seats.map((s) => ({
          id: s.id,
          name: s.name,
          alive: true,
          connected: s.connected,
        })),
        discussSeconds: 180,
        discussPaused: false,
        votesCast: 0,
        votesNeeded: 0,
        nightStepIndex: 0,
        nightStepTotal: 0,
        started: false,
        roleCounts: this.roleCounts,
      }
    }
    for (const cb of this.listeners) {
      cb({ seats, publicView, privateViews, canStart: this.canStart(), game: this.game })
    }
  }

  private async onRaw(connId: string, raw: string) {
    try {
      let msg: ClientToHost
      if (isPlain(raw)) {
        msg = unpackPlain<ClientToHost>(raw)
      } else if (isEncrypted(raw) && this.key) {
        msg = await open<ClientToHost>(this.key, raw)
      } else {
        return
      }
      await this.onMessage(connId, msg)
    } catch (e) {
      console.warn('host bad message', e)
    }
  }

  private async onMessage(connId: string, msg: ClientToHost) {
    if (msg.type === 'join') {
      if (this.started) {
        await this.sendToConn(connId, { v: 1, type: 'error', code: 'started', message: 'Game already started' })
        return
      }
      const name = msg.name.trim().slice(0, 20)
      if (!name) {
        await this.sendToConn(connId, { v: 1, type: 'error', code: 'name', message: 'Name required' })
        return
      }
      if (this.seats.length >= 20) {
        await this.sendToConn(connId, { v: 1, type: 'error', code: 'full', message: 'Room full' })
        return
      }
      // Reuse seat if same token
      let seat = this.seats.find((s) => s.token === msg.token)
      if (!seat) {
        seat = { id: `p-${randomToken(6)}`, name, token: msg.token, isHost: false, connId }
        this.seats.push(seat)
        this.roleCounts = presetForCount(Math.max(4, this.seats.length))
      } else {
        seat.name = name
        seat.connId = connId
      }
      this.connToPlayer.set(connId, seat.id)
      await this.sendToConn(connId, {
        v: 1,
        type: 'welcome',
        playerId: seat.id,
        token: seat.token,
        salt: this.salt,
        isHost: false,
      }, true)
      this.persist()
      this.emit()
      await this.broadcastLobby()
      return
    }

    if (msg.type === 'rejoin') {
      const seat = this.seats.find((s) => s.token === msg.token)
      if (!seat) {
        await this.sendToConn(connId, { v: 1, type: 'error', code: 'unknown', message: 'Unknown player' })
        return
      }
      seat.connId = connId
      this.connToPlayer.set(connId, seat.id)
      await this.sendToConn(connId, {
        v: 1,
        type: 'welcome',
        playerId: seat.id,
        token: seat.token,
        salt: this.salt,
        isHost: seat.isHost,
      }, true)
      this.emit()
      if (this.started) await this.broadcastState()
      else await this.broadcastLobby()
      return
    }

    const playerId = this.connToPlayer.get(connId)
    if (!playerId) return

    if (msg.type === 'sync') {
      if (this.started) await this.broadcastState()
      else await this.broadcastLobby()
      // Also push private if in game
      return
    }
    if (msg.type === 'ack_reveal') {
      this.markRevealed(playerId)
      return
    }
    if (msg.type === 'night_action') {
      this.handleNightAction(playerId, msg.action)
      return
    }
    if (msg.type === 'vote') {
      this.handleVote(playerId, msg.targetId)
      return
    }
    if (msg.type === 'hunter_shot') {
      this.applyHunterShot(msg.targetId)
      return
    }
    if (msg.type === 'ping') {
      await this.sendToConn(connId, { v: 1, type: 'pong' })
    }
  }

  private handleNightAction(playerId: string, action: NightActionPayload) {
    if (!this.game) return
    const me = this.game.players.find((p) => p.id === playerId)
    if (!me || !me.alive) return
    const steps = buildNightSteps(this.game)
    const step = steps[this.nightStepIndex]
    if (!step || step.kind !== 'role' || step.role !== me.role) return

    // Validate role matches action
    if (action.kind !== 'skip' && action.kind !== me.role && !(me.role === 'werewolf' && action.kind === 'werewolf')) {
      if (action.kind !== me.role) return
    }

    const patch = nightActionToPatch(action)
    this.game = setNightAction(this.game, patch)

    // Advance after action received for this role
    this.nightStepIndex = Math.min(this.nightStepIndex + 1, steps.length - 1)
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  private handleVote(playerId: string, targetId: string | 'skip') {
    if (!this.game || this.game.phase !== 'day_vote') return
    const me = this.game.players.find((p) => p.id === playerId)
    if (!me || !me.alive) return
    if (targetId !== 'skip' && !this.game.players.some((p) => p.id === targetId && p.alive && p.id !== playerId)) {
      return
    }
    this.game = castVote(this.game, playerId, targetId)
    this.persist()
    this.emit()
    void this.broadcastState()
  }

  private async broadcastLobby() {
    const connected = this.connectedIds()
    const seats = lobbySeats(
      this.seats.map((s) => ({ id: s.id, name: s.name, isHost: s.isHost })),
      connected,
    )
    const msg: HostToClient = {
      v: 1,
      type: 'lobby',
      seats,
      canStart: this.canStart(),
      code: this.code,
    }
    await this.broadcast(msg)
  }

  private async broadcastState() {
    const game = this.game
    if (!game) {
      await this.broadcastLobby()
      return
    }
    const connected = this.connectedIds()
    const pub = buildPublicView({
      state: game,
      connected,
      nightStepIndex: this.nightStepIndex,
      discussEndsAt: this.discussEndsAt,
      discussPaused: this.discussPaused,
      dawnDied: this.dawnDied,
      eliminated: this.eliminated,
    })
    await this.broadcast({ v: 1, type: 'public', view: pub })
    for (const s of this.seats) {
      if (!s.connId && !s.isHost) continue
      const priv = buildPrivateView({
        state: game,
        playerId: s.id,
        isHost: s.isHost,
        nightStepIndex: this.nightStepIndex,
        revealed: Boolean(this.revealed[s.id]),
      })
      if (s.connId) await this.sendToConn(s.connId, { v: 1, type: 'private', view: priv })
    }
  }

  private async broadcast(msg: HostToClient) {
    if (!this.key) return
    const packed = await seal(this.key, msg)
    // Also need plain for clients that don't have key yet — only lobby after welcome uses encrypted
    this.transport.broadcast(packed)
  }

  private async sendToConn(connId: string, msg: HostToClient, plainWelcome = false) {
    if (plainWelcome || msg.type === 'welcome' || msg.type === 'error' || msg.type === 'kicked') {
      this.transport.send(connId, packPlain(msg))
      return
    }
    if (!this.key) return
    this.transport.send(connId, await seal(this.key, msg))
  }
}
