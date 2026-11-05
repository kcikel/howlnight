import { useEffect, useMemo, useState } from 'preact/hooks'
import type { GameState, RoleId } from '../engine'
import { livingPlayers, nightWakeOrder, playersWithRole } from '../engine'
import type { Lang } from '../i18n/messages'
import { speakKeys, speakParts, type SpeakPart, unlockAudio } from '../audio/speech'

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

  const { narration, voiceParts, fallbackText } = useMemo(() => {
    const empty = { narration: '', voiceParts: [] as SpeakPart[], fallbackText: '' }
    if (!step) return empty
    if (step.kind === 'intro') {
      const narration = `${t('nightFalls')} ${t('everyoneSleep')}`
      return {
        narration,
        voiceParts: [
          { type: 'clip' as const, key: 'nightFalls' },
          { type: 'clip' as const, key: 'everyoneSleep' },
        ],
        fallbackText: narration,
      }
    }
    if (step.kind === 'done') {
      const narration = t('dawnTitle')
      return {
        narration,
        voiceParts: [{ type: 'clip' as const, key: 'dawnTitle' }],
        fallbackText: narration,
      }
    }
    if (step.kind === 'seer_result') {
      const v = state.seerLastVision
      if (!v) return empty
      const name = state.players.find((p) => p.id === v.targetId)?.name ?? ''
      const suffixKey = v.isWolf ? 'visionWolf' : 'visionVillager'
      const narration = `${name} ${t(suffixKey)}`
      // Name via Web Speech; fixed suffix via neural clip
      return {
        narration,
        voiceParts: [
          { type: 'text' as const, text: name },
          { type: 'clip' as const, key: suffixKey },
        ],
        fallbackText: narration,
      }
    }
    const prompts: Partial<Record<RoleId, string>> = {
      werewolf: 'wolvesChoose',
      seer: 'seerChoose',
      doctor: 'doctorChoose',
      witch: 'witchHealAsk',
      cupid: 'cupidChoose',
      spy: 'spyChoose',
      littlegirl: 'littlegirlChoose',
    }
    const promptKey = prompts[step.role]
    const roleKey = `role_${step.role}`
    const promptText = promptKey ? t(promptKey) : ''
    const narration = `${t('wake')} ${t(roleKey)}. ${promptText}`.trim()
    const voiceParts: SpeakPart[] = [
      { type: 'clip', key: 'wake' },
      { type: 'clip', key: roleKey },
    ]
    if (promptKey) voiceParts.push({ type: 'clip', key: promptKey })
    return { narration, voiceParts, fallbackText: narration }
  }, [step, t, state.seerLastVision, state.players, lang])

  useEffect(() => {
    if (voiceOn && voiceParts.length) {
      void speakParts(voiceParts, lang, fallbackText)
    }
  }, [si, narration, voiceOn, lang])

  useEffect(() => {
    setSelected([])
    setWitchHealChoice(null)
  }, [si])

  const witchPhase =
    step && step.kind === 'role' && step.role === 'witch'
      ? witchHealChoice === null && state.witch.healLeft && state.nightActions.werewolfTarget
        ? 'heal'
        : 'poison'
      : null

  useEffect(() => {
    if (voiceOn && witchPhase === 'poison') {
      void speakKeys(['witchPoisonAsk'], lang, t('witchPoisonAsk'))
    }
  }, [witchPhase, voiceOn, lang, t])

  // Speak seer vision when a target is picked (name via Web Speech + neural suffix)
  useEffect(() => {
    if (!voiceOn || !step || step.kind !== 'role' || (step.role !== 'seer' && step.role !== 'littlegirl') || !selected[0]) return
    const target = state.players.find((p) => p.id === selected[0])
    if (!target) return
    const suffix = target.role === 'werewolf' ? 'visionWolf' : 'visionVillager'
    void speakParts(
      [
        { type: 'text', text: target.name },
        { type: 'clip', key: suffix },
      ],
      lang,
      `${target.name} ${t(suffix)}`,
    )
  }, [selected[0], voiceOn, lang])

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
  }

  function advance() {
    unlockAudio()
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
    if (role === 'littlegirl') {
      if (selected[0]) onPatch({ littleGirlPeekTarget: selected[0] })
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
      advance()
      return
    }
    advance()
  }

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

        {step.kind === 'role' && (step.role === 'seer' || step.role === 'doctor' || step.role === 'spy' || step.role === 'littlegirl') && (
          <>
            {pickButtons(false, playersWithRole(state, step.role).map((p) => p.id))}
            {(step.role === 'seer' || step.role === 'littlegirl') && selected[0] && (
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
