import { useEffect } from 'preact/hooks'
import type { GameState } from '../engine'
import type { Lang } from '../i18n/messages'
import { speakParts } from '../audio/speech'

interface Props {
  state: GameState
  lang: Lang
  t: (k: string) => string
  voiceOn: boolean
  onAgain: () => void
  onHome: () => void
}

export function GameOver({ state, lang, t, voiceOn, onAgain, onHome }: Props) {
  const key =
    state.winner === 'wolves'
      ? 'winners_wolves'
      : state.winner === 'lovers'
        ? 'winners_lovers'
        : 'winners_village'

  useEffect(() => {
    if (!voiceOn) return
    void speakParts([{ type: 'clip', key }], lang, t(key))
  }, [voiceOn, lang, key, t])

  return (
    <div class="stack">
      <div class="panel stack">
        <h2>{t('gameOver')}</h2>
        <p class="narration">{t(key)}</p>
        <ul class="log-list">
          {state.players.map((p) => (
            <li key={p.id}>
              {p.name} — {t(`role_${p.role}`)}{' '}
              <span class={p.alive ? 'tag-alive' : 'tag-dead'}>
                {p.alive ? t('alive') : t('dead')}
              </span>
            </li>
          ))}
        </ul>
        <h3>{t('gameLog')}</h3>
        <ul class="log-list">
          {state.log.map((e, i) => (
            <li key={i} class={e.kind === 'win' ? 'win' : ''}>
              D{e.day}: {e.text}
            </li>
          ))}
        </ul>
      </div>
      <button class="btn-primary btn-block" type="button" onClick={onAgain}>
        {t('playAgain')}
      </button>
      <button class="btn btn-block" type="button" onClick={onHome}>
        {t('home')}
      </button>
    </div>
  )
}
