import { useState } from 'preact/hooks'
import type { Player } from '../engine'

const EMOJI: Record<string, string> = {
  werewolf: '🐺',
  villager: '👤',
  seer: '🔮',
  doctor: '💉',
  witch: '🧪',
  hunter: '🎯',
  cupid: '💘',
  spy: '👁️',
}

interface Props {
  players: Player[]
  t: (k: string) => string
  onDone: () => void
}

export function RoleReveal({ players, t, onDone }: Props) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)
  const p = players[index]
  const left = players.length - index

  if (!p) return null

  return (
    <div class="stack">
      <div class="panel stack">
        <div class="progress">
          <span style={`width:${((index) / players.length) * 100}%`} />
        </div>
        <p class="muted" style="text-align:center;margin:0">
          {t('rolesLeft')}: {left}
        </p>

        {!shown ? (
          <div class="reveal-gate" onClick={() => setShown(true)} role="button">
            <div class="moon-pulse" />
            <div>
              <div class="muted">{t('passPhone')}</div>
              <h2 style="margin:4px 0 12px">{p.name}</h2>
              <div class="btn-primary">{t('tapReveal')}</div>
            </div>
          </div>
        ) : (
          <div class="role-reveal">
            <div class="emoji">{EMOJI[p.role] ?? '🎭'}</div>
            <p class="muted">{t('yourRole')}</p>
            <h2>{t(`role_${p.role}`)}</h2>
            <p class="lead">{t(`desc_${p.role}`)}</p>
            <button
              class="btn-primary btn-block"
              type="button"
              onClick={() => {
                if (index + 1 >= players.length) onDone()
                else {
                  setIndex(index + 1)
                  setShown(false)
                }
              }}
            >
              {index + 1 >= players.length ? t('startGame') : t('hideRole')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
