import { useEffect, useMemo, useState } from 'preact/hooks'
import type { GameState, RoleId } from '../engine'
import { livingPlayers, nightWakeOrder, playersWithRole } from '../engine'
import type { Lang } from '../i18n/messages'
import { speak } from '../audio/speech'

interface Props {
  state: GameState
  lang: Lang
  t: (k: string) => string
  voiceOn: boolean
  onPatch: (patch: Parameters<typeof import('../engine').setNightAction>[1]) => void
  onFinish: () => void
}

type Step =
  | { kind: 'intro' }
  | { kind: 'role'; role: RoleId }
  | { kind: 'seer_result' }
  | { kind: 'done' }

export function NightFlow({ state, lang, t, voiceOn, onPatch, onFinish }: Props) {
  const order = useMemo(() => nightWakeOrder(state), [state.players, state.cupidDone, state.day])
  const steps: Step[] = useMemo(
    () => [{ kind: 'intro' }, ...order.map((role) => ({ kind: 'role' as const, role })), { kind: 'done' }],
    [order],
  )
  const [si, setSi] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [witchHealChoice, setWitchHealChoice] = useState<boolean | null>(null)
  const step = steps[si]

  const narration = useMemo(() => {
    if (!step) return ''
    if (step.kind === 'intro') return `${t('nightFalls')} ${t('everyoneSleep')}`
    if (step.kind === 'done') return t('dawnTitle')
    if (step.kind === 'seer_result') {
      const v = state.seerLastVision
      if (!v) return ''
      const name = state.players.find((p) => p.id === v.targetId)?.name ?? ''
      return `${name} ${v.isWolf ? t('visionWolf') : t('visionVillager')}`
    }
    const prompts: Record<RoleId, string> = {
      werewolf: t('wolvesChoose'),
      seer: t('seerChoose'),
      doctor: t('doctorChoose'),
      witch: t('witchHealAsk'),
      hunter: '',
      villager: '',
      cupid: t('cupidChoose'),
      spy: t('spyChoose'),
    }
    return `${t('wake')} ${t(`role_${step.role}`)}. ${prompts[step.role]}`
  }, [step, t, state.seerLastVision, state.players, lang])

  useEffect(() => {
    if (voiceOn && narration) void speak(narration, lang)
  }, [si, narration, voiceOn, lang])

  useEffect(() => {
    setSelected([])
    setWitchHealChoice(null)
  }, [si])

  if (!step) return null

  const alive = livingPlayers(state)

  function pickButtons(multi = false, excludeIds: string[] = []) {
    return (
      <div class="player-pick">
        {alive
          .filter((p) => !excludeIds.includes(p.id))
          .map((p) => {
            const on = selected.includes(p.id)
            return (
              <button
                type="button"
                key={p.id}
                class={on ? 'selected' : ''}
                onClick={() => {
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
  }

  function advance() {
    setSi((x) => Math.min(x + 1, steps.length - 1))
  }

  function confirmRole(role: RoleId) {
    if (role === 'cupid') {
      if (selected.length !== 2) return
      onPatch({ cupidPair: [selected[0], selected[1]] })
      advance()
      return
    }
    if (role === 'werewolf') {
      if (selected[0]) onPatch({ werewolfTarget: selected[0] })
      advance()
      return
    }
    if (role === 'seer') {
      if (selected[0]) onPatch({ seerTarget: selected[0] })
      advance()
      return
    }
    if (role === 'doctor') {
      if (selected[0]) onPatch({ doctorTarget: selected[0] })
      advance()
      return
    }
    if (role === 'spy') {
      if (selected[0]) onPatch({ spyPeekTarget: selected[0] })
      advance()
      return
    }
    if (role === 'witch') {
      const victimId = state.nightActions.werewolfTarget
      if (witchHealChoice === true && state.witch.healLeft && victimId) {
        onPatch({ witchHeal: true })
      }
      if (witchHealChoice === false && selected[0] && state.witch.poisonLeft) {
        onPatch({ witchPoisonTarget: selected[0] })
      }
      // two-phase handled in render
      advance()
      return
    }
    advance()
  }

  // Witch UI is two-phase within the role step
  const witchPhase =
    step.kind === 'role' && step.role === 'witch'
      ? witchHealChoice === null && state.witch.healLeft && state.nightActions.werewolfTarget
        ? 'heal'
        : 'poison'
      : null

  return (
    <div class="stack">
      <div class="panel stack">
        <div class="row">
          <span class="muted">
            {t('nightStep')} {si + 1} {t('of')} {steps.length} · {t('players')} {alive.length}
          </span>
        </div>
        <div style="display:flex;justify-content:center;padding:8px 0">
          <div class="moon-pulse" />
        </div>
        <p class="narration">{narration}</p>

        {step.kind === 'intro' && (
          <button class="btn-primary btn-block" type="button" onClick={advance}>
            {t('next')}
          </button>
        )}

        {step.kind === 'role' && step.role === 'cupid' && (
          <>
            <p class="muted" style="text-align:center">{t('selectTwo')}</p>
            {pickButtons(true)}
            <button
              class="btn-primary btn-block"
              type="button"
              disabled={selected.length !== 2}
              onClick={() => confirmRole('cupid')}
            >
              {t('confirm')}
            </button>
          </>
        )}

        {step.kind === 'role' && step.role === 'werewolf' && (
          <>
            <p class="muted" style="text-align:center">
              {playersWithRole(state, 'werewolf').map((p) => p.name).join(', ')}
            </p>
            {pickButtons(
              false,
              playersWithRole(state, 'werewolf').map((p) => p.id),
            )}
            <div class="row">
              <button class="btn space" type="button" onClick={() => { onPatch({ werewolfTarget: undefined }); advance() }}>
                {t('skipAction')}
              </button>
              <button class="btn-primary space" type="button" disabled={!selected[0]} onClick={() => confirmRole('werewolf')}>
                {t('confirm')}
              </button>
            </div>
          </>
        )}

        {step.kind === 'role' && (step.role === 'seer' || step.role === 'doctor' || step.role === 'spy') && (
          <>
            {pickButtons(false, playersWithRole(state, step.role).map((p) => p.id))}
            {step.role === 'seer' && selected[0] && (
              <p class="narration">
                {(() => {
                  const target = state.players.find((p) => p.id === selected[0])!
                  return `${target.name} ${target.role === 'werewolf' ? t('visionWolf') : t('visionVillager')}`
                })()}
              </p>
            )}
            {step.role === 'spy' && selected[0] && (
              <p class="narration">
                {(() => {
                  const target = state.players.find((p) => p.id === selected[0])!
                  return `${target.name}: ${t(`role_${target.role}`)}`
                })()}
              </p>
            )}
            <div class="row">
              <button class="btn space" type="button" onClick={advance}>{t('skipAction')}</button>
              <button
                class="btn-primary space"
                type="button"
                disabled={!selected[0]}
                onClick={() => confirmRole(step.role)}
              >
                {t('confirm')}
              </button>
            </div>
          </>
        )}

        {step.kind === 'role' && step.role === 'witch' && witchPhase === 'heal' && (
          <>
            <p class="muted" style="text-align:center">
              {state.players.find((p) => p.id === state.nightActions.werewolfTarget)?.name}
            </p>
            <div class="row">
              <button
                class="btn-primary space"
                type="button"
                onClick={() => {
                  onPatch({ witchHeal: true })
                  setWitchHealChoice(true)
                }}
              >
                {t('yes')}
              </button>
              <button class="btn space" type="button" onClick={() => setWitchHealChoice(false)}>
                {t('no')}
              </button>
            </div>
          </>
        )}

        {step.kind === 'role' && step.role === 'witch' && witchPhase === 'poison' && (
          <>
            <p class="narration">{t('witchPoisonAsk')}</p>
            {state.witch.poisonLeft ? pickButtons(false) : <p class="muted" style="text-align:center">—</p>}
            <div class="row">
              <button class="btn space" type="button" onClick={advance}>{t('skipAction')}</button>
              <button
                class="btn-danger space"
                type="button"
                disabled={!selected[0] || !state.witch.poisonLeft}
                onClick={() => {
                  onPatch({ witchPoisonTarget: selected[0] })
                  advance()
                }}
              >
                {t('confirm')}
              </button>
            </div>
          </>
        )}

        {step.kind === 'done' && (
          <button class="btn-primary btn-block" type="button" onClick={onFinish}>
            {t('continueDay')}
          </button>
        )}
      </div>
    </div>
  )
}
