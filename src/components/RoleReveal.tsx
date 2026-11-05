import { useState } from 'preact/hooks'
import type { Player } from '../engine'
import { RoleSigil } from './RoleSigil'


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
        <p class="muted roles-left">
          {t('rolesLeft')}: {left}
        </p>

        {!shown ? (
          <div
            class="reveal-gate"
            onClick={() => setShown(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setShown(true)
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div class="moon-pulse" />
            <div>
              <div class="muted">{t('passPhone')}</div>
              <h2 class="gate-name">{p.name}</h2>
              <div class="btn-primary">{t('tapReveal')}</div>
            </div>
          </div>
        ) : (
          <div class="role-reveal" data-role={p.role}>
            <div class="emoji"><RoleSigil role={p.role} /></div>
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
