/**
 * Lightweight analytics hook.
 *
 * GoatCounter: set GOATCOUNTER_SITE_CODE below (e.g. 'howlnight') once the
 * account exists. Until then every track() is a local no-op that still
 * increments in-memory counters (useful for tests / debugging).
 *
 * One-line enable later:
 *   export const GOATCOUNTER_SITE_CODE: string | null = 'howlnight'
 */
export const GOATCOUNTER_SITE_CODE: string | null = null

export type AnalyticsEvent =
  | 'pro_click'
  | 'pro_notify'
  | 'game_start'
  | 'game_end'
  | 'room_created'
  | 'room_joined'
  | 'join_failed'

const counts: Record<string, number> = Object.create(null)

const INTEREST_KEY = 'howlnight_pro_interest'

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  counts[event] = (counts[event] ?? 0) + 1
  if (typeof window === 'undefined') return

  const code = GOATCOUNTER_SITE_CODE
  if (!code) return

  try {
    const w = window as Window & {
      goatcounter?: { count: (o: { path: string; title?: string; event?: boolean }) => void }
    }
    // Lazy-inject GoatCounter script once
    if (!document.getElementById('gc-script')) {
      const s = document.createElement('script')
      s.id = 'gc-script'
      s.async = true
      s.dataset.goatcounter = `https://${code}.goatcounter.com/count`
      s.src = '//gc.zgo.at/count.js'
      document.head.appendChild(s)
    }
    const path = `event:${event}`
    const title = props ? `${event} ${JSON.stringify(props)}` : event
    const fire = () => w.goatcounter?.count({ path, title, event: true })
    if (w.goatcounter?.count) fire()
    else setTimeout(fire, 400)
  } catch {
    /* ignore */
  }
}

export function getEventCounts(): Record<string, number> {
  return { ...counts }
}

export function resetEventCounts(): void {
  for (const k of Object.keys(counts)) delete counts[k]
}

export function recordProInterest(): { at: string; count: number } {
  const at = new Date().toISOString()
  let count = 1
  try {
    const prev = localStorage.getItem(INTEREST_KEY)
    const parsed = prev ? (JSON.parse(prev) as { count?: number }) : null
    count = (parsed?.count ?? 0) + 1
    localStorage.setItem(INTEREST_KEY, JSON.stringify({ at, count }))
  } catch {
    /* private mode etc. */
  }
  track('pro_notify')
  return { at, count }
}

export function readProInterest(): { at: string; count: number } | null {
  try {
    const raw = localStorage.getItem(INTEREST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: string; count?: number }
    if (!parsed?.at) return null
    return { at: parsed.at, count: parsed.count ?? 1 }
  } catch {
    return null
  }
}
