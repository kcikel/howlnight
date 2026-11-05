import type { Lang } from '../i18n/messages'

const LANG_CODE: Record<Lang, string> = {
  en: 'en-US',
  es: 'es-MX',
  pt: 'pt-BR',
}

export type VoiceKey = string

export type SpeakPart =
  | { type: 'clip'; key: VoiceKey }
  | { type: 'text'; text: string }

let muted = false
let unlocked = false
let currentAudio: HTMLAudioElement | null = null
let playToken = 0
const clipCache = new Map<string, HTMLAudioElement>()

function baseUrl(): string {
  const base = (import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL || '/'
  return base.endsWith('/') ? base : `${base}/`
}

function clipUrl(lang: Lang, key: string): string {
  return `${baseUrl()}voice/${lang}/${key}.mp3`
}

export function setSpeechMuted(v: boolean) {
  muted = v
  if (v) stopSpeaking()
}

export function isSpeechMuted() {
  return muted
}

/** Call from a user gesture so iOS/Android allow later clip autoplay. */
export function unlockAudio(): void {
  if (unlocked || typeof window === 'undefined') return
  unlocked = true
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC) {
      const ctx = new AC()
      void ctx.resume().then(() => ctx.close()).catch(() => undefined)
    }
  } catch {
    /* ignore */
  }
}

function getClip(lang: Lang, key: string): HTMLAudioElement {
  const url = clipUrl(lang, key)
  let a = clipCache.get(url)
  if (!a) {
    a = new Audio(url)
    a.preload = 'auto'
    clipCache.set(url, a)
  }
  return a
}

function playClipElement(a: HTMLAudioElement, token: number): Promise<'ok' | 'fail'> {
  return new Promise((resolve) => {
    if (token !== playToken) {
      resolve('fail')
      return
    }
    currentAudio = a
    const done = (status: 'ok' | 'fail') => {
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('error', onErr)
      if (currentAudio === a) currentAudio = null
      resolve(status)
    }
    const onEnd = () => done('ok')
    const onErr = () => done('fail')
    a.addEventListener('ended', onEnd)
    a.addEventListener('error', onErr)
    try {
      a.currentTime = 0
    } catch {
      /* */
    }
    const p = a.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => done('fail'))
    }
  })
}

function speakWeb(text: string, lang: Lang, rate = 0.92): Promise<void> {
  return new Promise((resolve) => {
    if (!text.trim() || typeof window === 'undefined' || !window.speechSynthesis) {
      resolve()
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = LANG_CODE[lang]
    u.rate = rate
    u.pitch = 0.85
    u.onend = () => resolve()
    u.onerror = () => resolve()
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find((v) => v.lang.startsWith(LANG_CODE[lang].slice(0, 2)))
    if (match) u.voice = match
    window.speechSynthesis.speak(u)
  })
}

async function playClipOrFail(lang: Lang, key: string, token: number): Promise<boolean> {
  try {
    const a = getClip(lang, key)
    // If already known broken (network 404), audio error fires on play
    const status = await playClipElement(a, token)
    return status === 'ok'
  } catch {
    return false
  }
}

/**
 * Play a sequence of pre-generated clips and optional Web Speech text
 * (for dynamic player names). Missing clips fall back to Web Speech using
 * the optional `fallbackText` on the whole sequence via speakFallback.
 */
export async function speakParts(
  parts: SpeakPart[],
  lang: Lang,
  fallbackText?: string,
): Promise<void> {
  if (muted || typeof window === 'undefined') return
  unlockAudio()
  stopSpeaking()
  const token = ++playToken

  let anyClipPlayed = false
  for (let i = 0; i < parts.length; i++) {
    if (token !== playToken || muted) return
    const part = parts[i]
    if (part.type === 'text') {
      await speakWeb(part.text, lang)
      continue
    }
    const ok = await playClipOrFail(lang, part.key, token)
    if (ok) {
      anyClipPlayed = true
      if (token === playToken && !muted) {
        await new Promise((r) => setTimeout(r, 160))
      }
    } else if (!anyClipPlayed && fallbackText) {
      // First clip failed and nothing played yet — full Web Speech fallback
      if (token !== playToken || muted) return
      await speakWeb(fallbackText, lang)
      return
    }
    // Mid-sequence missing clip: skip it (UI still shows text)
  }
}

export function speakKeys(keys: VoiceKey[], lang: Lang, fallbackText?: string): Promise<void> {
  return speakParts(
    keys.map((key) => ({ type: 'clip' as const, key })),
    lang,
    fallbackText,
  )
}

/** Full Web Speech fallback (also used if clips are unavailable). */
export function speak(text: string, lang: Lang, rate = 0.92): Promise<void> {
  if (muted || typeof window === 'undefined') return Promise.resolve()
  unlockAudio()
  stopSpeaking()
  const token = ++playToken
  return (async () => {
    if (token !== playToken || muted) return
    await speakWeb(text, lang, rate)
  })()
}

export function stopSpeaking() {
  playToken++
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.currentTime = 0
    } catch {
      /* */
    }
    currentAudio = null
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

export function prefetchVoice(lang: Lang, keys: string[]) {
  if (typeof window === 'undefined') return
  for (const key of keys) {
    try {
      getClip(lang, key)
    } catch {
      /* */
    }
  }
}
