import type { RoleId } from '../engine'
import { adjustRole, PREMIUM_ROLES, presetForCount, ROLES, totalRoles } from '../engine'

const ROLE_ORDER: RoleId[] = [
  'werewolf',
  'villager',
  'seer',
  'doctor',
  'witch',
  'hunter',
  'cupid',
  'spy',
]

export interface SetupPlayer {
  id: string
  name: string
}

interface Props {
  players: SetupPlayer[]
  roleCounts: Partial<Record<RoleId, number>>
  t: (k: string) => string
  onChangePlayers: (p: SetupPlayer[]) => void
  onChangeRoles: (r: Partial<Record<RoleId, number>>) => void
  onContinue: () => void
  onBack: () => void
}

let idSeq = 1
export function newPlayer(name = ''): SetupPlayer {
  return { id: `u${Date.now()}-${idSeq++}`, name }
}

export function PlayerSetup({
  players,
  roleCounts,
  t,
  onChangePlayers,
  onChangeRoles,
  onContinue,
  onBack,
}: Props) {
  const n = players.length
  const total = totalRoles(roleCounts)
  const valid =
    n >= 4 &&
    n <= 20 &&
    players.every((p) => p.name.trim().length > 0) &&
    total === n

  return (
    <div class="stack">
      <div class="panel stack">
        <h2>{t('players')} ({n})</h2>
        {players.map((p, i) => (
          <div class="player-row" key={p.id}>
            <input
              value={p.name}
              placeholder={`${t('namePlaceholder')} ${i + 1}`}
              maxlength={20}
              onInput={(e) => {
                const name = (e.target as HTMLInputElement).value
                onChangePlayers(players.map((x) => (x.id === p.id ? { ...x, name } : x)))
              }}
            />
            <button
              class="btn-ghost"
              type="button"
              disabled={players.length <= 4}
              onClick={() => {
                const next = players.filter((x) => x.id !== p.id)
                onChangePlayers(next)
                onChangeRoles(presetForCount(next.length))
              }}
            >
              {t('remove')}
            </button>
          </div>
        ))}
        <button
          class="btn"
          type="button"
          disabled={players.length >= 20}
          onClick={() => {
            const next = [...players, newPlayer()]
            onChangePlayers(next)
            onChangeRoles(presetForCount(next.length))
          }}
        >
          + {t('addPlayer')}
        </button>
      </div>

      <div class="panel stack">
        <div class="row">
          <h2 class="space">{t('roles')}</h2>
          <button
            class="chip"
            type="button"
            onClick={() => onChangeRoles(presetForCount(n))}
          >
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
                  {t(`role_${role}`)}{' '}
                  {premium && <span class="badge">{t('premium')}</span>}
                </div>
                <div class="muted" style="font-size:0.8rem;max-width:200px">
                  {t(`desc_${role}`)}
                </div>
              </div>
              <div class="stepper">
                <button
                  type="button"
                  onClick={() => onChangeRoles(adjustRole(roleCounts, role, -1, n))}
                  disabled={count <= 0 || role === 'villager'}
                >
                  −
                </button>
                <span class="count">{count}</span>
                <button
                  type="button"
                  onClick={() => onChangeRoles(adjustRole(roleCounts, role, 1, n))}
                  disabled={role === 'villager' || count >= ROLES[role].maxCount}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
        <p class="muted">
          {total} / {n} {total !== n ? `— ${t('roleMismatch')}` : ''}
        </p>
      </div>

      <div class="footer-cta">
        {!valid && (
          <p class="muted" style="text-align:center;margin:0">
            {t('invalidPlayers')}
          </p>
        )}
        <button class="btn-primary btn-block" type="button" disabled={!valid} onClick={onContinue}>
          {t('continue')}
        </button>
        <button class="btn btn-block" type="button" onClick={onBack}>
          {t('back')}
        </button>
      </div>
    </div>
  )
}
