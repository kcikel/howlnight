/**
 * Lightweight analytics hook.
 *
 * GoatCounter site code 'howlnight' — active in production builds.
 * track() also keeps in-memory counters for tests / debugging.
 * Script inject is lazy + idempotent; initAnalytics() loads it on boot
 * so GoatCounter records a pageview without waiting for the first event.
 */
export const GOATCOUNTER_SITE_CODE: string | null = 'howlnight'
/** Full count endpoint (committed; not secret). Kept as a plain string so builds retain the hostname. */
export const GOATCOUNTER_ENDPOINT = 'https://howlnight.goatcounter.com/count'

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

type GoatWindow = Window & {
  goatcounter?: { count: (o: { path: string; title?: string; event?: boolean }) => void }
}

function ensureGoatCounter(): void {
  const code = GOATCOUNTER_SITE_CODE
  if (!code || typeof window === 'undefined' || typeof document === 'undefined') return
  if (document.getElementById('gc-script')) return
  try {
    const s = document.createElement('script')
    s.id = 'gc-script'
    s.async = true
    s.dataset.goatcounter = GOATCOUNTER_ENDPOINT
    // GoatCounter ignores localhost unless allow_local is set (prod unchanged).
    const host = location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      s.dataset.goatcounterSettings = JSON.stringify({ allow_local: true })
    }
    s.src = 'https://gc.zgo.at/count.js'
    // Ad blockers / offline: failed load must not break the app
    s.onerror = () => {
      /* ignore */
    }
    document.head.appendChild(s)
  } catch {
    /* ignore */
  }
}

/** Inject GoatCounter so pageviews count on first paint. Safe no-op if blocked. */
export function initAnalytics(): void {
  ensureGoatCounter()
}

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>): void {
  counts[event] = (counts[event] ?? 0) + 1
  if (typeof window === 'undefined') return

  const code = GOATCOUNTER_SITE_CODE
  if (!code) return

  try {
    ensureGoatCounter()
    const w = window as GoatWindow
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
