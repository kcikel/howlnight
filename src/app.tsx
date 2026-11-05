import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { startAmbient, stopAmbient } from './audio/ambient'
import { isSpeechMuted, setSpeechMuted, stopSpeaking } from './audio/speech'
import { BrandMark } from './components/MoonArt'
import {
  DawnScreen,
  DiscussScreen,
  EliminationScreen,
  HunterRevenge,
  VoteScreen,
} from './components/DayFlow'
import { GameOver } from './components/GameOver'
import { Landing } from './components/Landing'
import { NightFlow } from './components/NightFlow'
import { newPlayer, PlayerSetup, type SetupPlayer } from './components/PlayerSetup'
import { ProUpsell } from './components/ProUpsell'
import { RoleReveal } from './components/RoleReveal'
import {
  beginNight,
  castVote,
  continueAfterElimination,
  createGame,
  finishNight,
  finishVote,
  hunterShoot,
  presetForCount,
  setNightAction,
  startDayDiscuss,
  startDayVote,
  type GameState,
  type NightActions,
  type Player,
} from './engine'
import { useI18n } from './hooks/useI18n'
import type { Lang } from './i18n/messages'

type Screen = 'landing' | 'setup' | 'reveal' | 'play' | 'pro'

function defaultPlayers(): SetupPlayer[] {
  return [1, 2, 3, 4, 5, 6].map((i) => newPlayer(`Player ${i}`))
}

export function App() {
  const { lang, setLang, t, LANG_LABELS } = useI18n()
  const [screen, setScreen] = useState<Screen>('landing')
  const [players, setPlayers] = useState<SetupPlayer[]>(defaultPlayers)
  const [roleCounts, setRoleCounts] = useState(() => presetForCount(6))
  const [game, setGame] = useState<GameState | null>(null)
  const [voiceOn, setVoiceOn] = useState(() => !isSpeechMuted())
  const [dawnDied, setDawnDied] = useState<Player[]>([])
  const [lastEliminated, setLastEliminated] = useState<Player | undefined>()
  const [elimExtras, setElimExtras] = useState<Player[]>([])

  useEffect(() => {
    document.title = t('seoTitle')
  }, [t])

  const toggleVoice = () => {
    const next = !voiceOn
    setVoiceOn(next)
    setSpeechMuted(!next)
    if (!next) stopSpeaking()
  }

  const startReveal = () => {
    const g = createGame({
      players: players.map((p) => ({ id: p.id, name: p.name.trim() })),
      roleCounts,
    })
    setGame(g)
    setScreen('reveal')
    startAmbient()
  }

  const startPlay = () => {
    if (!game) return
    setGame(beginNight(game))
    setScreen('play')
  }

  const patchNight = useCallback((patch: Partial<NightActions>) => {
    setGame((g) => (g ? setNightAction(g, patch) : g))
  }, [])

  const onFinishNight = () => {
    setGame((g) => {
      if (!g) return g
      const beforeAlive = new Set(g.players.filter((p) => p.alive).map((p) => p.id))
      const next = finishNight(g)
      const died = next.players.filter((p) => beforeAlive.has(p.id) && !p.alive)
      setDawnDied(died)
      return next
    })
  }

  const resetToSetup = () => {
    stopSpeaking()
    stopAmbient()
    setGame(null)
    setScreen('setup')
    setDawnDied([])
  }

  const goHome = () => {
    stopSpeaking()
    stopAmbient()
    setGame(null)
    setScreen('landing')
  }

  const phase = game?.phase

  const body = useMemo(() => {
    if (screen === 'landing') {
      return <Landing t={t} onStart={() => setScreen('setup')} onPro={() => setScreen('pro')} />
    }
    if (screen === 'pro') {
      return <ProUpsell t={t} onBack={() => setScreen('landing')} />
    }
    if (screen === 'setup') {
      return (
        <PlayerSetup
          players={players}
          roleCounts={roleCounts}
          t={t}
          onChangePlayers={setPlayers}
          onChangeRoles={setRoleCounts}
          onContinue={startReveal}
          onBack={() => setScreen('landing')}
        />
      )
    }
    if (screen === 'reveal' && game) {
      return <RoleReveal players={game.players} t={t} onDone={startPlay} />
    }
    if (screen === 'play' && game) {
      if (phase === 'first_night_cupid' || phase === 'night') {
        return (
          <NightFlow
            state={game}
            lang={lang}
            t={t}
            voiceOn={voiceOn}
            onPatch={patchNight}
            onFinish={onFinishNight}
          />
        )
      }
      if (phase === 'dawn') {
        return (
          <DawnScreen
            state={game}
            died={dawnDied}
            t={t}
            onContinue={() => setGame((g) => (g ? startDayDiscuss(g) : g))}
          />
        )
      }
      if (phase === 'day_discuss') {
        return (
          <DiscussScreen
            seconds={game.discussSeconds}
            t={t}
            onVote={() => setGame((g) => (g ? startDayVote(g) : g))}
          />
        )
      }
      if (phase === 'day_vote') {
        return (
          <VoteScreen
            state={game}
            t={t}
            onCast={(voterId, targetId) =>
              setGame((g) => (g ? castVote(g, voterId, targetId) : g))
            }
            onReveal={() => {
              setGame((g) => {
                if (!g) return g
                const before = new Map(g.players.map((p) => [p.id, p.alive]))
                const next = finishVote(g)
                const changed = next.players.filter((p) => before.get(p.id) && !p.alive)
                setLastEliminated(changed[0])
                setElimExtras(changed.slice(1))
                return next
              })
            }}
          />
        )
      }
      if (phase === 'hunter_revenge') {
        return (
          <HunterRevenge
            state={game}
            t={t}
            onShoot={(id) =>
              setGame((g) => {
                if (!g) return g
                const before = new Set(g.players.filter((p) => p.alive).map((p) => p.id))
                const next = hunterShoot(g, id)
                if (next.phase === 'dawn') {
                  const died = next.players.filter((p) => before.has(p.id) && !p.alive)
                  setDawnDied((prev) => {
                    const ids = new Set(prev.map((p) => p.id))
                    return [...prev, ...died.filter((d) => !ids.has(d.id))]
                  })
                } else {
                  const died = next.players.filter((p) => before.has(p.id) && !p.alive)
                  setLastEliminated(died[0])
                  setElimExtras(died.slice(1))
                }
                return next
              })
            }
          />
        )
      }
      if (phase === 'elimination') {
        return (
          <EliminationScreen
            eliminated={lastEliminated}
            extras={elimExtras}
            t={t}
            onContinue={() => {
              setGame((g) => {
                if (!g) return g
                if (g.winner || g.phase === 'game_over') return g
                return continueAfterElimination(g)
              })
            }}
          />
        )
      }
      if (phase === 'game_over') {
        return <GameOver state={game} t={t} onAgain={resetToSetup} onHome={goHome} />
      }
    }
    return null
  }, [
    screen,
    game,
    phase,
    players,
    roleCounts,
    t,
    lang,
    voiceOn,
    dawnDied,
    lastEliminated,
    elimExtras,
    patchNight,
  ])

  return (
    <div class="app-shell">
      <header class="topbar">
        <div class="brand" onClick={goHome} role="button" style="cursor:pointer">
          <BrandMark />
          <div>
            <div>{t('appName')}</div>
            <div class="muted" style="font-size:0.72rem;font-weight:500">
              {t('tagline')}
            </div>
          </div>
        </div>
        <div class="top-actions">
          <select
            class="select-lang"
            aria-label={t('lang')}
            value={lang}
            onChange={(e) => setLang((e.target as HTMLSelectElement).value as Lang)}
          >
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <option key={l} value={l}>
                {LANG_LABELS[l]}
              </option>
            ))}
          </select>
          <button class="chip" type="button" onClick={toggleVoice}>
            {voiceOn ? '🔊' : '🔇'}
          </button>
        </div>
      </header>
      {body}
    </div>
  )
}
