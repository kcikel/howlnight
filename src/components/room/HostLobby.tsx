import { useEffect, useState } from 'preact/hooks'
import type { RoleId } from '../../engine'
import { adjustRole, PREMIUM_ROLES, presetForCount, ROLES, totalRoles } from '../../engine'
import type { HostSession, LobbySeat } from '../../net'
import { roomShareUrl } from '../../net'
import { RoomQr } from './RoomQr'

const ROLE_ORDER: RoleId[] = [
  'werewolf',
  'villager',
  'seer',
  'doctor',
  'witch',
  'hunter',
  'cupid',
  'spy',
  'littlegirl',
]

interface Props {
  session: HostSession
  t: (k: string) => string
  onStarted: () => void
  onLeave: () => void
}

export function HostLobby({ session, t, onStarted, onLeave }: Props) {
  const [seats, setSeats] = useState<LobbySeat[]>(() =>
    session.getSnapshot().seats.map((s) => ({
      id: s.id,
      name: s.name,
      isHost: s.isHost,
      connected: s.isHost || Boolean(s.connId),
    })),
  )
  const [canStart, setCanStart] = useState(session.canStart())
  const [roleCounts, setRoleCounts] = useState(session.getSnapshot().roleCounts)
  const [hostName, setHostName] = useState(session.getHostSeat().name)
  const [copied, setCopied] = useState(false)
  const [discussSeconds, setDiscussSeconds] = useState(() => session.getDiscussSeconds())
  const code = session.code
  const url = roomShareUrl(code)
  const n = seats.length

  useEffect(() => {
    return session.onChange((snap) => {
      setSeats(snap.seats)
      setCanStart(snap.canStart)
      if (snap.publicView?.roleCounts) setRoleCounts(snap.publicView.roleCounts)
      if (snap.game) onStarted()
    })
  }, [session, onStarted])

  const total = totalRoles(roleCounts)

  return (
    <div class="stack">
      <div class="panel stack">
        <h2>{t('roomHostTitle')}</h2>
        <p class="muted" style="text-align:center;margin:0">
          {t('roomCodeLabel')}
        </p>
        <div class="room-code">{code}</div>
        <div style="display:flex;justify-content:center">
          <RoomQr url={url} />
        </div>
        <p class="muted" style="font-size:0.8rem;word-break:break-all;text-align:center">
          {url}
        </p>
        <div class="row">
          <button
            class="btn space"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? t('copied') : t('copyLink')}
          </button>
          {'share' in navigator && (
            <button
              class="btn space"
              type="button"
              onClick={() => {
                void navigator.share({ title: 'Howlnight', text: t('roomShareText'), url })
              }}
            >
              {t('share')}
            </button>
          )}
        </div>
        <p class="muted" style="font-size:0.85rem;margin:0">
          {t('roomHostHint')}
        </p>
      </div>

      <div class="panel stack">
        <h3>{t('yourName')}</h3>
        <div class="player-row">
          <input
            value={hostName}
            maxlength={20}
            onInput={(e) => setHostName((e.target as HTMLInputElement).value)}
            onBlur={() => session.setHostName(hostName)}
          />
        </div>
      </div>

      <div class="panel stack">
        <h3>
          {t('lobbyPlayers')} ({n})
        </h3>
        <ul class="log-list">
          {seats.map((s) => (
            <li key={s.id} class="row" style="justify-content:space-between">
              <span>
                {s.name} {s.isHost ? `(${t('hostBadge')})` : ''}{' '}
                <span class={s.connected ? 'tag-alive' : 'tag-dead'}>
                  {s.connected ? t('connected') : t('offline')}
                </span>
              </span>
              {!s.isHost && (
                <button class="btn-ghost" type="button" onClick={() => session.kick(s.id)}>
                  {t('kick')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div class="panel stack">
        <div class="row">
          <h3 class="space">{t('roles')}</h3>
          <button class="chip" type="button" onClick={() => {
            const next = presetForCount(Math.max(4, n))
            setRoleCounts(next)
            session.setRoleCounts(next)
          }}>
            {t('usePreset')}
          </button>
        </div>
        {ROLE_ORDER.map((role) => {
          const count = roleCounts[role] ?? 0
          const premium = PREMIUM_ROLES.includes(role)
          return (
            <div class="role-card" key={role}>
              <div>
                <div class="name">
                  {t(`role_${role}`)} {premium && <span class="badge">{t('premium')}</span>}
                </div>
              </div>
              <div class="stepper">
                <button
                  type="button"
                  onClick={() => {
                    const next = adjustRole(roleCounts, role, -1, Math.max(4, n))
                    setRoleCounts(next)
                    session.setRoleCounts(next)
                  }}
                  disabled={count <= 0 || role === 'villager'}
                >
                  −
                </button>
                <span class="count">{count}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = adjustRole(roleCounts, role, 1, Math.max(4, n))
                    setRoleCounts(next)
                    session.setRoleCounts(next)
                  }}
                  disabled={role === 'villager' || count >= ROLES[role].maxCount}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
        <p class="muted">
          {total} / {n}
        </p>
      </div>

      <div class="panel stack">
        <h2>{t('discussTimer')}</h2>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          {[60, 120, 180, 300].map((s) => (
            <button
              key={s}
              type="button"
              class={discussSeconds === s ? 'chip selected' : 'chip'}
              onClick={() => {
                setDiscussSeconds(s)
                session.setDiscussSeconds(s)
              }}
            >
              {Math.floor(s / 60)}m
            </button>
          ))}
        </div>
      </div>

      <div class="footer-cta">
        <button
          class="btn-primary btn-block"
          type="button"
          disabled={!canStart || total !== n}
          onClick={() => {
            session.setHostName(hostName)
            session.startGame()
            onStarted()
          }}
        >
          {t('startRoomGame')}
        </button>
        <button class="btn btn-block" type="button" onClick={onLeave}>
          {t('leaveRoom')}
        </button>
      </div>
    </div>
  )
}
