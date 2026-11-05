/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getEventCounts,
  GOATCOUNTER_ENDPOINT,
  GOATCOUNTER_SITE_CODE,
  initAnalytics,
  recordProInterest,
  resetEventCounts,
  track,
} from '../src/analytics'

describe('analytics', () => {
  beforeEach(() => {
    resetEventCounts()
    localStorage.clear()
    document.getElementById('gc-script')?.remove()
  })

  it('has GoatCounter site code set for production', () => {
    expect(GOATCOUNTER_SITE_CODE).toBe('howlnight')
    expect(GOATCOUNTER_ENDPOINT).toBe('https://howlnight.goatcounter.com/count')
  })

  it('keeps local in-memory counters regardless of GoatCounter', () => {
    track('pro_click')
    track('pro_click')
    track('game_start')
    expect(getEventCounts()).toEqual({ pro_click: 2, game_start: 1 })
  })

  it('injects GoatCounter script on init for pageviews', () => {
    initAnalytics()
    const s = document.getElementById('gc-script') as HTMLScriptElement | null
    expect(s).toBeTruthy()
    expect(s!.dataset.goatcounter).toBe('https://howlnight.goatcounter.com/count')
    expect(s!.src).toBe('https://gc.zgo.at/count.js')
    // idempotent
    initAnalytics()
    expect(document.querySelectorAll('#gc-script').length).toBe(1)
  })

  it('records pro interest locally without email', () => {
    const first = recordProInterest()
    expect(first.count).toBe(1)
    expect(first.at).toMatch(/^\d{4}-/)
    const second = recordProInterest()
    expect(second.count).toBe(2)
    expect(getEventCounts().pro_notify).toBe(2)
    const raw = localStorage.getItem('howlnight_pro_interest')
    expect(raw).toBeTruthy()
    expect(raw!).not.toMatch(/@/)
  })

  it('counts all product events', () => {
    for (const e of [
      'pro_click',
      'pro_notify',
      'game_start',
      'game_end',
      'room_created',
      'room_joined',
      'join_failed',
    ] as const) {
      track(e)
    }
    expect(Object.keys(getEventCounts()).sort()).toEqual(
      [
        'game_end',
        'game_start',
        'join_failed',
        'pro_click',
        'pro_notify',
        'room_created',
        'room_joined',
      ].sort(),
    )
  })
})
