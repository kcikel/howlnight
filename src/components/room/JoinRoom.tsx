import { useEffect, useState } from 'preact/hooks'
import {
  createHybridTransport,
  hostPeerId,
  isValidRoomCode,
  normalizeRoomCode,
  PlayerSession,
  type LobbySeat,
} from '../../net'

interface Props {
  t: (k: string) => string
  initialCode?: string
  /** Injected for tests; defaults to PeerJS. */
  createAndConnect?: (code: string, name: string) => Promise<PlayerSession>
  onReady: (session: PlayerSession) => void
  onJoinFailed?: () => void
  onBack: () => void
}

export function JoinRoom({ t, initialCode = '', createAndConnect, onReady, onJoinFailed, onBack }: Props) {
  const [code, setCode] = useState(normalizeRoomCode(initialCode))
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'form' | 'connecting' | 'error'>('form')
  const [error, setError] = useState('')

  const join = async () => {
    const c = normalizeRoomCode(code)
    if (!isValidRoomCode(c) || !name.trim()) return
    setStatus('connecting')
    setError('')
    try {
      let s: PlayerSession
      if (createAndConnect) {
        s = await createAndConnect(c, name.trim())
      } else {
        const transport = createHybridTransport(c)
        s = new PlayerSession(transport, c, { name: name.trim() })
        await s.connect(hostPeerId(c))
      }
      onReady(s)
    } catch (e) {
      setStatus('error')
      onJoinFailed?.()
      const raw = e instanceof Error ? e.message : ''
      if (raw.startsWith('NEED_SAME_WIFI') || /timeout|failed/i.test(raw)) {
        setError(t('needSameWifi'))
      } else {
        setError(raw || t('joinFailed'))
      }
    }
  }

  return (
    <div class="stack">
      <div class="panel stack">
        <h2>{t('joinRoomTitle')}</h2>
        <label class="muted">{t('roomCodeLabel')}</label>
        <input
          class="room-input"
          value={code}
          maxlength={4}
          placeholder="ABCD"
          onInput={(e) => setCode(normalizeRoomCode((e.target as HTMLInputElement).value))}
        />
        <label class="muted">{t('yourName')}</label>
        <input
          class="room-input"
          value={name}
          maxlength={20}
          placeholder={t('namePlaceholder')}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
        {status === 'error' && <p class="narration" style="color:var(--crimson)">{error}</p>}
        {status === 'connecting' && <p class="muted">{t('connecting')}</p>}
        <button
          class="btn-primary btn-block"
          type="button"
          disabled={!isValidRoomCode(code) || !name.trim() || status === 'connecting'}
          onClick={() => void join()}
        >
          {t('joinRoom')}
        </button>
        <button class="btn btn-block" type="button" onClick={onBack}>
          {t('back')}
        </button>
      </div>
    </div>
  )
}

interface PlayerLobbyProps {
  session: PlayerSession
  t: (k: string) => string
  onStarted: () => void
  onLeave: () => void
}

export function PlayerLobby({ session, t, onStarted, onLeave }: PlayerLobbyProps) {
  const [seats, setSeats] = useState<LobbySeat[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    return session.onChange((snap) => {
      if (snap.kicked) {
        setError(t('kicked'))
        return
      }
      if (snap.error) setError(snap.error)
      setSeats(snap.seats)
      if (snap.publicView?.started) onStarted()
    })
  }, [session, onStarted, t])

  return (
    <div class="stack">
      <div class="panel stack">
        <h2>{t('lobbyWaiting')}</h2>
        <div class="room-code">{session.code}</div>
        {error && <p style="color:var(--crimson)">{error}</p>}
        <ul class="log-list">
          {seats.map((s) => (
            <li key={s.id}>
              {s.name} {s.isHost ? `(${t('hostBadge')})` : ''}{' '}
              <span class={s.connected ? 'tag-alive' : 'tag-dead'}>
                {s.connected ? t('connected') : t('offline')}
              </span>
            </li>
          ))}
        </ul>
        <p class="muted" style="text-align:center">
          {t('waitingHostStart')}
        </p>
        <button class="btn btn-block" type="button" onClick={onLeave}>
          {t('leaveRoom')}
        </button>
      </div>
    </div>
  )
}
