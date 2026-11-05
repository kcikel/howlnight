import { useEffect, useState } from 'preact/hooks'
import type { GameState, Player } from '../engine'
import { livingPlayers } from '../engine'

interface DawnProps {
  state: GameState
  died: Player[]
  t: (k: string) => string
  onContinue: () => void
}

export function DawnScreen({ state, died, t, onContinue }: DawnProps) {
  return (
    <div class="panel stack">
      <h2>{t('dawnTitle')}</h2>
      {died.length === 0 ? (
        <p class="narration">{t('nobodyDied')}</p>
      ) : (
        <>
          <p class="muted">{t('foundDead')}</p>
          <ul class="log-list">
            {died.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> — {t(`role_${p.role}`)}
              </li>
            ))}
          </ul>
        </>
      )}
      <div class="row" style="flex-wrap:wrap">
        {state.players.map((p) => (
          <span key={p.id} class={p.alive ? 'tag-alive' : 'tag-dead'}>
            {p.name}
          </span>
        ))}
      </div>
      <button class="btn-primary btn-block" type="button" onClick={onContinue}>
        {t('discussTitle')}
      </button>
    </div>
  )
}

interface DiscussProps {
  seconds: number
  t: (k: string) => string
  onVote: () => void
}

export function DiscussScreen({ seconds, t, onVote }: DiscussProps) {
  const [left, setLeft] = useState(seconds)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    if (left <= 0) return
    const id = setInterval(() => setLeft((x) => x - 1), 1000)
    return () => clearInterval(id)
  }, [paused, left])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div class="panel stack">
      <h2>{t('discussTitle')}</h2>
      <p class="muted">{t('discussHint')}</p>
      <div class="timer">
        {mm}:{ss}
      </div>
      <div class="row">
        <button class="btn space" type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? t('resume') : t('pause')}
        </button>
        <button class="btn-primary space" type="button" onClick={onVote}>
          {t('toVote')}
        </button>
      </div>
    </div>
  )
}

interface VoteProps {
  state: GameState
  t: (k: string) => string
  onCast: (voterId: string, targetId: string | 'skip') => void
  onReveal: () => void
}

export function VoteScreen({ state, t, onCast, onReveal }: VoteProps) {
  const living = livingPlayers(state)
  const [voterIdx, setVoterIdx] = useState(0)
  const voter = living[voterIdx]
  const voted = new Set(state.votes.map((v) => v.voterId))
  const allDone = living.every((p) => voted.has(p.id))

  if (!voter && !allDone) return null

  if (allDone) {
    return (
      <div class="panel stack">
        <h2>{t('voteTitle')}</h2>
        <p class="narration">
          {t('votesCast')}: {state.votes.length}/{living.length}
        </p>
        <button class="btn-danger btn-block" type="button" onClick={onReveal}>
          {t('revealVotes')}
        </button>
      </div>
    )
  }

  return (
    <div class="panel stack">
      <h2>{t('voteTitle')}</h2>
      <p class="muted" style="text-align:center">
        {t('voteAs')}
      </p>
      <h3 style="text-align:center;margin:0">{voter.name}</h3>
      <div class="player-pick">
        {living
          .filter((p) => p.id !== voter.id)
          .map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onCast(voter.id, p.id)
                setVoterIdx((i) => i + 1)
              }}
            >
              {t('voteFor')} {p.name}
            </button>
          ))}
      </div>
      <button
        class="btn btn-block"
        type="button"
        onClick={() => {
          onCast(voter.id, 'skip')
          setVoterIdx((i) => i + 1)
        }}
      >
        {t('skipVote')}
      </button>
      <p class="muted" style="text-align:center;margin:0">
        {t('votesCast')}: {voted.size}/{living.length}
      </p>
    </div>
  )
}

interface ElimProps {
  eliminated: Player | undefined
  extras: Player[]
  t: (k: string) => string
  onContinue: () => void
}

export function EliminationScreen({ eliminated, extras, t, onContinue }: ElimProps) {
  const all = eliminated ? [eliminated, ...extras.filter((e) => e.id !== eliminated.id)] : extras
  return (
    <div class="panel stack">
      <h2>{all.length ? t('eliminated') : t('survivedVote')}</h2>
      {all.length > 0 && (
        <ul class="log-list">
          {all.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong> — {t(`role_${p.role}`)}
            </li>
          ))}
        </ul>
      )}
      <button class="btn-primary btn-block" type="button" onClick={onContinue}>
        {t('next')}
      </button>
    </div>
  )
}

interface HunterProps {
  state: GameState
  t: (k: string) => string
  onShoot: (id: string) => void
}

export function HunterRevenge({ state, t, onShoot }: HunterProps) {
  const living = livingPlayers(state)
  return (
    <div class="panel stack">
      <h2>{t('hunterShot')}</h2>
      <div class="player-pick">
        {living.map((p) => (
          <button type="button" key={p.id} class="selected" onClick={() => onShoot(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  )
}
