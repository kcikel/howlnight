import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { startAmbient, stopAmbient } from './audio/ambient'
import { isSpeechMuted, setSpeechMuted, stopSpeaking, unlockAudio, prefetchVoice } from './audio/speech'
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
import { HostLobby } from './components/room/HostLobby'
import { JoinRoom, PlayerLobby } from './components/room/JoinRoom'
import { RoomPlay } from './components/room/RoomPlay'
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
import {
  createPeerTransport,
  generateRoomCode,
  hostPeerId,
  HostSession,
  isValidRoomCode,
  normalizeRoomCode,
  PlayerSession,
  randomToken,
} from './net'
import { useI18n } from './hooks/useI18n'
import type { Lang } from './i18n/messages'

type Screen =
  | 'landing'
  | 'setup'
  | 'reveal'
  | 'play'
  | 'pro'
  | 'host_lobby'
  | 'host_play'
  | 'join'
  | 'player_lobby'
  | 'player_play'

function defaultPlayers(): SetupPlayer[] {
  return [1, 2, 3, 4, 5, 6].map((i) => newPlayer(`Player ${i}`))
}

function readRoomParam(): string | null {
  if (typeof location === 'undefined') return null
  const q = new URLSearchParams(location.search).get('room')
  if (!q) return null
  const code = normalizeRoomCode(q)
  return isValidRoomCode(code) ? code : null
}

export function App() {
  const { lang, setLang, t, LANG_LABELS } = useI18n()
  const [screen, setScreen] = useState<Screen>(() => (readRoomParam() ? 'join' : 'landing'))
  const [joinCode, setJoinCode] = useState(() => readRoomParam() ?? '')
  const [players, setPlayers] = useState<SetupPlayer[]>(defaultPlayers)
  const [roleCounts, setRoleCounts] = useState(() => presetForCount(6))
  const [game, setGame] = useState<GameState | null>(null)
  const [voiceOn, setVoiceOn] = useState(() => !isSpeechMuted())
  const [dawnDied, setDawnDied] = useState<Player[]>([])
  const [lastEliminated, setLastEliminated] = useState<Player | undefined>()
  const [elimExtras, setElimExtras] = useState<Player[]>([])
  const [hostSession, setHostSession] = useState<HostSession | null>(null)
  const [playerSession, setPlayerSession] = useState<PlayerSession | null>(null)
  const [roomBusy, setRoomBusy] = useState(false)
  const [roomError, setRoomError] = useState('')

  useEffect(() => {
    document.title = t('seoTitle')
  }, [t])

  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!voiceOn) return
    prefetchVoice(lang, [
      'nightFalls',
      'everyoneSleep',
      'dawnTitle',
      'wake',
      'role_werewolf',
      'role_seer',
      'role_doctor',
      'role_witch',
      'role_cupid',
      'role_spy',
      'wolvesChoose',
      'seerChoose',
      'doctorChoose',
      'witchHealAsk',
      'witchPoisonAsk',
      'cupidChoose',
      'spyChoose',
      'visionWolf',
      'visionVillager',
    ])
  }, [lang, voiceOn])

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

  const tearDownRooms = () => {
    hostSession?.destroy()
    playerSession?.destroy()
    setHostSession(null)
    setPlayerSession(null)
  }

  const goHome = () => {
    stopSpeaking()
    stopAmbient()
    setGame(null)
    tearDownRooms()
    setScreen('landing')
    setRoomError('')
    if (typeof history !== 'undefined' && location.search.includes('room=')) {
      history.replaceState({}, '', `${location.pathname}`)
    }
  }

  const createRoom = async () => {
    setRoomBusy(true)
    setRoomError('')
    try {
      let code = generateRoomCode()
      let transport = createPeerTransport()
      let attempts = 0
      while (attempts < 5) {
        try {
          await transport.startHost(hostPeerId(code))
          break
        } catch {
          transport.destroy()
          code = generateRoomCode()
          transport = createPeerTransport()
          attempts++
        }
      }
      if (attempts >= 5) throw new Error('Could not claim room code')
      const session = new HostSession(transport, code, {
        hostName: 'Host',
        hostToken: randomToken(),
      })
      await session.init()
      setHostSession(session)
      setScreen('host_lobby')
      startAmbient()
    } catch (e) {
      setRoomError(e instanceof Error ? e.message : t('joinFailed'))
    } finally {
      setRoomBusy(false)
    }
  }

  const phase = game?.phase

  const body = useMemo(() => {
    if (screen === 'landing') {
      return (
        <Landing
          t={t}
          onPassPhone={() => setScreen('setup')}
          onCreateRoom={() => void createRoom()}
          onJoinRoom={() => {
            setJoinCode('')
            setScreen('join')
          }}
          onPro={() => setScreen('pro')}
        />
      )
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
    if (screen === 'join') {
      return (
        <JoinRoom
          t={t}
          initialCode={joinCode}
          onReady={(s) => {
            setPlayerSession(s)
            setScreen('player_lobby')
            startAmbient()
          }}
          onBack={goHome}
        />
      )
    }
    if (screen === 'host_lobby' && hostSession) {
      return (
        <HostLobby
          session={hostSession}
          t={t}
          onStarted={() => {
            setScreen('host_play')
          }}
          onLeave={goHome}
        />
      )
    }
    if (screen === 'player_lobby' && playerSession) {
      return (
        <PlayerLobby
          session={playerSession}
          t={t}
          onStarted={() => setScreen('player_play')}
          onLeave={goHome}
        />
      )
    }
    if (screen === 'host_play' && hostSession) {
      return (
        <RoomPlay
          mode="host"
          session={hostSession}
          hostPlayerId={hostSession.getHostSeat().id}
          lang={lang}
          t={t}
          voiceOn={voiceOn}
          onLeave={goHome}
        />
      )
    }
    if (screen === 'player_play' && playerSession) {
      return (
        <RoomPlay
          mode="player"
          session={playerSession}
          lang={lang}
          t={t}
          voiceOn={voiceOn}
          onLeave={goHome}
        />
      )
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
    if (roomBusy) {
      return (
        <div class="panel">
          <p class="muted">{t('creatingRoom')}</p>
        </div>
      )
    }
    if (roomError) {
      return (
        <div class="panel stack">
          <p style="color:var(--crimson)">{roomError}</p>
          <button class="btn" type="button" onClick={goHome}>
            {t('home')}
          </button>
        </div>
      )
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
    hostSession,
    playerSession,
    joinCode,
    roomBusy,
    roomError,
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
