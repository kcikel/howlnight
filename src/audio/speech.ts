import type { Lang } from '../i18n/messages'

const LANG_CODE: Record<Lang, string> = {
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
}

let muted = false

export function setSpeechMuted(v: boolean) {
  muted = v
  if (v && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}

export function isSpeechMuted() {
  return muted
}

export function speak(text: string, lang: Lang, rate = 0.92): Promise<void> {
  return new Promise((resolve) => {
    if (muted || typeof window === 'undefined' || !window.speechSynthesis) {
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
    // Prefer a local voice matching language
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find((v) => v.lang.startsWith(LANG_CODE[lang].slice(0, 2)))
    if (match) u.voice = match
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
