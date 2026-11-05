import { useCallback, useEffect, useState } from 'preact/hooks'
import { detectLang, t as translate, type Lang, LANG_LABELS } from '../i18n/messages'

const KEY = 'howlnight-lang'

export function useI18n() {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(KEY) as Lang | null
      if (saved === 'en' || saved === 'es' || saved === 'pt') return saved
    }
    return detectLang()
  })

  useEffect(() => {
    localStorage.setItem(KEY, lang)
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const t = useCallback((key: string) => translate(lang, key), [lang])

  return { lang, setLang, t, LANG_LABELS }
}
