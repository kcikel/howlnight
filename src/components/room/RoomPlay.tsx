import { useEffect, useMemo, useState } from 'preact/hooks'
import { speakParts, unlockAudio, type SpeakPart } from '../../audio/speech'
import type { HostSession, PlayerSession, PrivateGameView, PublicGameView } from '../../net'
import type { Lang } from '../../i18n/messages'
import type { RoleId } from '../../engine'
import { track } from '../../analytics'
import { ProComingSoonButton } from '../ProUpsell'
import { RoleSigil } from '../RoleSigil'


interface HostProps {
  mode: 'host'
  session: HostSession
  hostPlayerId: string
  lang: Lang
  t: (k: string) => string
  voiceOn: boolean
  onLeave: () => void
  onBackToLobby: () => void
  onPro?: () => void
}

interface PlayerProps {
  mode: 'player'
  session: PlayerSession
  lang: Lang
  t: (k: string) => string
  voiceOn: boolean
  onLeave: () => void
  onBackToLobby: () => void
  onPro?: () => void
}

type Props = HostProps | PlayerProps

export function RoomPlay(props: Props) {
  const { t, lang, voiceOn } = props
  const [pub, setPub] = useState<PublicGameView | null>(null)
  const [priv, setPriv] = useState<PrivateGameView | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [witchHeal, setWitchHeal] = useState<boolean | null>(null)
  const [roleShown, setRoleShown] = useState(false)

  useEffect(() => {
    if (pub?.phase === 'game_over') {
      track('game_end', { winner: pub.winner ?? 'village', mode: props.mode })
    }
  }, [pub?.phase, pub?.winner, props.mode])

  useEffect(() => {
    if (props.mode === 'host') {
      return props.session.onChange((snap) => {
        if (snap.publicView && !snap.publicView.started && snap.publicView.phase === 'lobby') {
          props.onBackToLobby()
          return
        }
        setPub(snap.publicView)
        const id = props.hostPlayerId
        setPriv(snap.privateViews[id] ?? null)
      })
    }
    return props.session.onChange((snap) => {
      if (snap.publicView && !snap.publicView.started && snap.publicView.phase === 'lobby') {
        props.onBackToLobby()
        return
      }
      setPub(snap.publicView)
      setPriv(snap.privateView)
    })
  }, [props])

  // Host wake lock
  useEffect(() => {
    if (props.mode !== 'host') return
    let lock: WakeLockSentinel | undefined
    const req = async () => {
      try {
        if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen')
      } catch {
        /* ignore */
      }
    }
    void req()
    const onVis = () => {
      if (document.visibilityState === 'visible') void req()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [props.mode])

  // Host narration for night + day phases
  useEffect(() => {
    if (props.mode !== 'host' || !voiceOn || !pub) return
    const parts: SpeakPart[] = []
    let fallback = ''
    if (pub.phase === 'night' || pub.phase === 'first_night_cupid') {
      if (pub.nightStepKind === 'intro') {
        parts.push({ type: 'clip', key: 'nightFalls' }, { type: 'clip', key: 'everyoneSleep' })
        fallback = `${t('nightFalls')} ${t('everyoneSleep')}`
      } else if (pub.nightStepKind === 'done') {
        parts.push({ type: 'clip', key: 'dawnTitle' })
        fallback = t('dawnTitle')
      } else if (pub.nightStepKind === 'role' && pub.nightRole) {
        const prompts: Partial<Record<RoleId, string>> = {
          werewolf: 'wolvesChoose',
          seer: 'seerChoose',
          doctor: 'doctorChoose',
          witch: 'witchHealAsk',
          cupid: 'cupidChoose',
          spy: 'spyChoose',
          littlegirl: 'littlegirlChoose',
        }
        parts.push({ type: 'clip', key: 'wake' }, { type: 'clip', key: `role_${pub.nightRole}` })
        const pk = prompts[pub.nightRole]
        if (pk) parts.push({ type: 'clip', key: pk })
        fallback = `${t('wake')} ${t(`role_${pub.nightRole}`)}`
      }
    } else if (pub.phase === 'dawn') {
      parts.push({ type: 'clip', key: 'dawnTitle' })
      if (!pub.dawnDied?.length) {
        parts.push({ type: 'clip', key: 'nobodyDied' })
        fallback = `${t('dawnTitle')}. ${t('nobodyDied')}`
      } else {
        parts.push({ type: 'clip', key: 'foundDead' })
        for (const d of pub.dawnDied) {
          parts.push({ type: 'text', text: d.name })
          parts.push({ type: 'clip', key: `role_${d.role}` })
        }
        fallback = t('foundDead')
      }
    } else if (pub.phase === 'day_discuss') {
      parts.push({ type: 'clip', key: 'discussStart' })
      fallback = t('discussStart')
    } else if (pub.phase === 'day_vote') {
      parts.push({ type: 'clip', key: 'voteStart' })
      fallback = t('voteStart')
    } else if (pub.phase === 'elimination') {
      if (!pub.eliminated?.length) {
        parts.push({ type: 'clip', key: 'survivedVote' })
        fallback = t('survivedVote')
      } else {
        parts.push({ type: 'clip', key: 'eliminated' })
        for (const d of pub.eliminated) {
          parts.push({ type: 'text', text: d.name })
          parts.push({ type: 'clip', key: `role_${d.role}` })
        }
        fallback = t('eliminated')
      }
    } else if (pub.phase === 'hunter_revenge') {
      parts.push({ type: 'clip', key: 'hunterShot' })
      fallback = t('hunterShot')
    } else if (pub.phase === 'game_over' && pub.winner) {
      const key =
        pub.winner === 'wolves' ? 'winners_wolves' : pub.winner === 'lovers' ? 'winners_lovers' : 'winners_village'
      parts.push({ type: 'clip', key })
      fallback = t(key)
    }
    if (parts.length) void speakParts(parts, lang, fallback)
  }, [props.mode, pub?.phase, pub?.nightStepIndex, pub?.nightStepKind, pub?.nightRole, pub?.dawnDied, pub?.eliminated, pub?.winner, voiceOn, lang])

  useEffect(() => {
    setSelected([])
    setWitchHeal(null)
  }, [pub?.nightStepIndex, pub?.phase])

  // Haptic when it's your night turn
  useEffect(() => {
    if (priv?.canAct && priv.alive) {
      try {
        navigator.vibrate?.([40, 30, 40])
      } catch {
        /* unsupported */
      }
    }
  }, [priv?.canAct, pub?.nightStepIndex])

  const alive = useMemo(() => pub?.players.filter((p) => p.alive) ?? [], [pub])

  if (!pub) {
    return (
      <div class="panel">
        <p class="muted">{t('connecting')}</p>
      </div>
    )
  }

  // Role reveal
  if (pub.phase === 'role_reveal' && priv) {
    if (!roleShown) {
      return (
        <div class="panel stack">
          <div
            class="reveal-gate"
            onClick={() => {
              setRoleShown(true)
              if (props.mode === 'host') props.session.markRevealed(props.hostPlayerId)
              else void props.session.ackReveal()
            }}
            role="button"
          >
            <div class="moon-pulse" />
            <div>
              <h2 class="gate-name">{priv.name}</h2>
              <div class="btn-primary">{t('tapReveal')}</div>
            </div>
          </div>
        </div>
      )
    }
    if (priv.role) {
      return (
        <div class="panel stack">
          <div class="role-reveal" data-role={priv.role}>
            <div class="emoji"><RoleSigil role={priv.role} /></div>
            <p class="muted">{t('yourRole')}</p>
            <h2>{t(`role_${priv.role}`)}</h2>
            <p class="lead">{t(`desc_${priv.role}`)}</p>
            {priv.wolfTeammates && priv.wolfTeammates.length > 0 && (
              <p class="muted">
                {t('team_wolves')}: {priv.wolfTeammates.map((w) => w.name).join(', ')}
              </p>
            )}
            {priv.loverName && <p class="muted">💘 {priv.loverName}</p>}
            <p class="muted">{t('waitingOthersReveal')}</p>
          </div>
          {props.mode === 'host' && (
            <button
              class="btn-primary btn-block"
              type="button"
              onClick={() => {
                unlockAudio()
                props.session.beginFirstNight()
              }}
            >
              {t('startGame')}
            </button>
          )}
        </div>
      )
    }
    return (
      <div class="panel stack">
        <div class="moon-pulse" style="margin:24px auto" />
        <p class="muted" style="text-align:center">
          {t('waitingOthersReveal')}
        </p>
      </div>
    )
  }

  // Night — identical waiting chrome; action only if canAct
  if (pub.phase === 'night' || pub.phase === 'first_night_cupid') {
    const showAction = Boolean(priv?.canAct && priv.alive)
    return (
      <div class="stack">
        <div class="panel stack night-screen">
          <div style="display:flex;justify-content:center;padding:8px 0">
            <div class="moon-pulse" />
          </div>
          <p class="narration">
            {pub.nightStepKind === 'intro'
              ? `${t('nightFalls')} ${t('everyoneSleep')}`
              : pub.nightStepKind === 'done'
                ? t('dawnTitle')
                : t('nightWaiting')}
          </p>
          <p class="muted" style="text-align:center;font-size:0.8rem">
            {t('nightStep')} {pub.nightStepIndex + 1} {t('of')} {pub.nightStepTotal}
          </p>

          {showAction && (
            <p class="muted" style="text-align:center">
              {t('nightYourTurn')}
            </p>
          )}
          {showAction && priv && pub.nightRole && (
            <NightAction
              role={pub.nightRole}
              priv={priv}
              alive={alive}
              meId={priv.playerId}
              selected={selected}
              setSelected={setSelected}
              witchHeal={witchHeal}
              setWitchHeal={setWitchHeal}
              t={t}
              onSubmit={(action) => {
                if (props.mode === 'host') props.session.submitNightAction(props.hostPlayerId, action)
                else void props.session.sendNightAction(action)
              }}
            />
          )}

          {!showAction && pub.nightStepKind === 'role' && (
            <p class="muted" style="text-align:center">
              {t('nightWaiting')}
            </p>
          )}

          {props.mode === 'host' && (pub.nightStepKind === 'intro' || pub.nightStepKind === 'done') && (
            <button
              class="btn-primary btn-block"
              type="button"
              onClick={() => {
                unlockAudio()
                props.session.advanceNightStep()
              }}
            >
              {pub.nightStepKind === 'done' ? t('continueDay') : t('next')}
            </button>
          )}
          {props.mode === 'host' && pub.nightStepKind === 'role' && (
            <button
              class="btn btn-block"
              type="button"
              onClick={() => props.session.advanceNightStep()}
            >
              {t('hostSkipRole')}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (pub.phase === 'dawn') {
    return (
      <div class="panel stack day-scene">
        <h2>{t('dawnTitle')}</h2>
        {!pub.dawnDied?.length ? (
          <p class="narration">{t('nobodyDied')}</p>
        ) : (
          <>
            <p class="muted">{t('foundDead')}</p>
            <ul class="log-list">
              {pub.dawnDied.map((p) => (
                <li key={p.id}>
                  <strong>{p.name}</strong> — {t(`role_${p.role}`)}
                </li>
              ))}
            </ul>
          </>
        )}
        <div class="row" style="flex-wrap:wrap">
          {pub.players.map((p) => (
            <span key={p.id} class={p.alive ? 'tag-alive' : 'tag-dead'}>
              {p.name}
            </span>
          ))}
        </div>
        {props.mode === 'host' && (
          <button class="btn-primary btn-block" type="button" onClick={() => props.session.continueDawn()}>
            {t('discussTitle')}
          </button>
        )}
        {props.mode === 'player' && <p class="muted" style="text-align:center">{t('waitingHost')}</p>}
      </div>
    )
  }

  if (pub.phase === 'day_discuss') {
    const leftMs = pub.discussPaused
      ? pub.discussSeconds * 1000
      : Math.max(0, (pub.discussEndsAt ?? Date.now()) - Date.now())
    const left = Math.ceil(leftMs / 1000)
    const mm = String(Math.floor(left / 60)).padStart(2, '0')
    const ss = String(left % 60).padStart(2, '0')
    return (
      <div class="panel stack day-scene">
        <h2>{t('discussTitle')}</h2>
        <p class="muted">{t('discussHint')}</p>
        <div class="timer">
          {mm}:{ss}
        </div>
        {props.mode === 'host' ? (
          <div class="row">
            <button
              class="btn space"
              type="button"
              onClick={() => props.session.setDiscussPaused(!pub.discussPaused)}
            >
              {pub.discussPaused ? t('resume') : t('pause')}
            </button>
            <button class="btn-primary space" type="button" onClick={() => props.session.goToVote()}>
              {t('toVote')}
            </button>
          </div>
        ) : (
          <p class="muted" style="text-align:center">
            {t('waitingHost')}
          </p>
        )}
      </div>
    )
  }

  if (pub.phase === 'day_vote') {
    const voted = priv?.myVote != null
    const allDone = pub.votesCast >= pub.votesNeeded
    if (allDone) {
      return (
        <div class="panel stack day-scene">
          <h2>{t('voteTitle')}</h2>
          <p class="narration">
            {t('votesCast')}: {pub.votesCast}/{pub.votesNeeded}
          </p>
          {props.mode === 'host' ? (
            <button class="btn-danger btn-block" type="button" onClick={() => props.session.revealVotes()}>
              {t('revealVotes')}
            </button>
          ) : (
            <p class="muted" style="text-align:center">
              {t('waitingHost')}
            </p>
          )}
        </div>
      )
    }
    if (!priv?.alive) {
      return (
        <div class="panel stack day-scene">
          <h2>{t('voteTitle')}</h2>
          <p class="muted" style="text-align:center">
            {t('deadSpectate')}
          </p>
          <p class="muted" style="text-align:center">
            {t('votesCast')}: {pub.votesCast}/{pub.votesNeeded}
          </p>
        </div>
      )
    }
    return (
      <div class="panel stack day-scene">
        <h2>{t('voteTitle')}</h2>
        {voted ? (
          <p class="narration">{t('voteSubmitted')}</p>
        ) : (
          <>
            <div class="player-pick">
              {alive
                .filter((p) => p.id !== priv?.playerId)
                .map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      if (props.mode === 'host') props.session.submitVote(props.hostPlayerId, p.id)
                      else void props.session.sendVote(p.id)
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
                if (props.mode === 'host') props.session.submitVote(props.hostPlayerId, 'skip')
                else void props.session.sendVote('skip')
              }}
            >
              {t('skipVote')}
            </button>
          </>
        )}
        <p class="muted" style="text-align:center">
          {t('votesCast')}: {pub.votesCast}/{pub.votesNeeded}
        </p>
      </div>
    )
  }

  if (pub.phase === 'elimination') {
    return (
      <div class="panel stack day-scene">
        <h2>{pub.eliminated?.length ? t('eliminated') : t('survivedVote')}</h2>
        {!!pub.eliminated?.length && (
          <ul class="log-list">
            {pub.eliminated.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> — {t(`role_${p.role}`)}
              </li>
            ))}
          </ul>
        )}
        {props.mode === 'host' ? (
          <button class="btn-primary btn-block" type="button" onClick={() => props.session.continueAfterElim()}>
            {t('next')}
          </button>
        ) : (
          <p class="muted" style="text-align:center">
            {t('waitingHost')}
          </p>
        )}
      </div>
    )
  }

  if (pub.phase === 'hunter_revenge') {
    const canShoot = priv?.canAct
    return (
      <div class="panel stack day-scene">
        <h2>{t('hunterShot')}</h2>
        {canShoot ? (
          <div class="player-pick">
            {alive.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  if (props.mode === 'host') props.session.applyHunterShot(p.id)
                  else void props.session.sendHunterShot(p.id)
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <p class="muted" style="text-align:center">
            {t('nightWaiting')}
          </p>
        )}
      </div>
    )
  }

  if (pub.phase === 'game_over') {
    const key =
      pub.winner === 'wolves' ? 'winners_wolves' : pub.winner === 'lovers' ? 'winners_lovers' : 'winners_village'
    return (
      <div class="panel stack">
        <h2>{t('gameOver')}</h2>
        <p class="narration">{t(key)}</p>
        <ul class="log-list">
          {pub.players.map((p) => (
            <li key={p.id}>
              {p.name}
            </li>
          ))}
        </ul>
        {props.mode === 'host' && (
          <button
            class="btn-primary btn-block"
            type="button"
            onClick={() => {
              props.session.playAgainSameRoom()
              props.onBackToLobby()
            }}
          >
            {t('playAgainSameRoom')}
          </button>
        )}
        {props.onPro && <ProComingSoonButton t={t} onOpen={props.onPro} />}
        <button class="btn btn-block" type="button" onClick={props.onLeave}>
          {t('home')}
        </button>
      </div>
    )
  }

  return (
    <div class="panel">
      <p class="muted">{pub.phase}</p>
    </div>
  )
}

function NightAction(props: {
  role: RoleId
  priv: PrivateGameView
  alive: { id: string; name: string }[]
  meId: string
  selected: string[]
  setSelected: (s: string[]) => void
  witchHeal: boolean | null
  setWitchHeal: (v: boolean | null) => void
  t: (k: string) => string
  onSubmit: (a: import('../../net').NightActionPayload) => void
}) {
  const { role, priv, alive, selected, setSelected, witchHeal, setWitchHeal, t, onSubmit } = props
  const excludeWolves =
    role === 'werewolf' ? new Set([priv.playerId, ...(priv.wolfTeammates?.map((w) => w.id) ?? [])]) : new Set<string>()

  const picks = (
    multi = false,
    exclude: Set<string> = new Set(),
  ) => (
    <div class="player-pick">
      {alive
        .filter((p) => !exclude.has(p.id))
        .map((p) => {
          const on = selected.includes(p.id)
          return (
            <button
              type="button"
              key={p.id}
              class={on ? 'selected' : ''}
              onClick={() => {
                unlockAudio()
                if (multi) {
                  if (on) setSelected(selected.filter((x) => x !== p.id))
                  else if (selected.length < 2) setSelected([...selected, p.id])
                  else setSelected([selected[1], p.id])
                } else setSelected([p.id])
              }}
            >
              {p.name}
            </button>
          )
        })}
    </div>
  )

  if (role === 'cupid') {
    return (
      <>
        <p class="muted" style="text-align:center">
          {t('selectTwo')}
        </p>
        {picks(true)}
        <button
          class="btn-primary btn-block"
          type="button"
          disabled={selected.length !== 2}
          onClick={() => onSubmit({ kind: 'cupid', pair: [selected[0], selected[1]] })}
        >
          {t('confirm')}
        </button>
      </>
    )
  }

  if (role === 'witch') {
    if (witchHeal === null && priv.witch?.healLeft && priv.witch.victimName) {
      return (
        <>
          <p class="narration">{t('witchHealAsk')}</p>
          <p class="muted" style="text-align:center">
            {priv.witch.victimName}
          </p>
          <div class="row">
            <button
              class="btn-primary space"
              type="button"
              onClick={() => {
                onSubmit({ kind: 'witch', heal: true })
                setWitchHeal(true)
              }}
            >
              {t('yes')}
            </button>
            <button class="btn space" type="button" onClick={() => setWitchHeal(false)}>
              {t('no')}
            </button>
          </div>
        </>
      )
    }
    return (
      <>
        <p class="narration">{t('witchPoisonAsk')}</p>
        {priv.witch?.poisonLeft ? picks(false) : null}
        <div class="row">
          <button class="btn space" type="button" onClick={() => onSubmit({ kind: 'skip' })}>
            {t('skipAction')}
          </button>
          <button
            class="btn-danger space"
            type="button"
            disabled={!selected[0] || !priv.witch?.poisonLeft}
            onClick={() => onSubmit({ kind: 'witch', poisonTargetId: selected[0] })}
          >
            {t('confirm')}
          </button>
        </div>
      </>
    )
  }

  if (role === 'seer' || role === 'doctor' || role === 'spy' || role === 'werewolf' || role === 'littlegirl') {
    return (
      <>
        {role === 'werewolf' && priv.wolfTeammates && (
          <p class="muted" style="text-align:center">
            {priv.wolfTeammates.map((w) => w.name).join(', ')}
          </p>
        )}
        {picks(false, excludeWolves)}
        {role === 'seer' && priv.seerVision && (
          <p class="narration">
            {priv.seerVision.targetName}{' '}
            {priv.seerVision.isWolf ? t('visionWolf') : t('visionVillager')}
          </p>
        )}
        {role === 'spy' && priv.spyPeek && (
          <p class="narration">
            {priv.spyPeek.targetName}: {t(`role_${priv.spyPeek.role}`)}
          </p>
        )}
        {role === 'littlegirl' && priv.littleGirlPeek && (
          <p class="narration">
            {priv.littleGirlPeek.targetName}{' '}
            {priv.littleGirlPeek.isWolf ? t('visionWolf') : t('visionVillager')}
          </p>
        )}
        <div class="row">
          <button class="btn space" type="button" onClick={() => onSubmit({ kind: 'skip' })}>
            {t('skipAction')}
          </button>
          <button
            class="btn-primary space"
            type="button"
            disabled={!selected[0]}
            onClick={() => {
              if (role === 'werewolf') onSubmit({ kind: 'werewolf', targetId: selected[0] })
              else if (role === 'seer') onSubmit({ kind: 'seer', targetId: selected[0] })
              else if (role === 'doctor') onSubmit({ kind: 'doctor', targetId: selected[0] })
              else if (role === 'littlegirl') onSubmit({ kind: 'littlegirl', targetId: selected[0] })
              else onSubmit({ kind: 'spy', targetId: selected[0] })
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </>
    )
  }

  return null
}
