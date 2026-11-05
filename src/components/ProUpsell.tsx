import { useState } from 'preact/hooks'
import { recordProInterest, readProInterest, track } from '../analytics'

interface Props {
  t: (k: string) => string
  onBack: () => void
  /** When true, render as overlay sheet (default). When false, full screen panel. */
  sheet?: boolean
}

const PERKS = ['proPerkRoles', 'proPerkNarrator', 'proPerkRooms', 'proPerkNoAds'] as const
const PRICES = [
  { key: 'proWeekly', price: '$2.99' },
  { key: 'proYearly', price: '$19.99' },
  { key: 'proLifetime', price: '$34.99' },
] as const

export function ProUpsell({ t, onBack, sheet = true }: Props) {
  const existing = typeof window !== 'undefined' ? readProInterest() : null
  const [notified, setNotified] = useState(Boolean(existing))

  const onNotify = () => {
    recordProInterest()
    setNotified(true)
  }

  const body = (
    <div class="panel stack pro-sheet-panel">
      <div class="pro-sheet-head">
        <h2 style="margin:0">{t('proTitle')}</h2>
        <span class="chip" style="pointer-events:none">
          {t('proSoonBadge')}
        </span>
      </div>
      <p class="lead" style="margin-top:0">
        {t('proBody')}
      </p>
      <h3 style="margin-bottom:4px">{t('proPerksTitle')}</h3>
      <ul class="pro-perk-list">
        {PERKS.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
      <h3 style="margin-bottom:4px">{t('proPricesTitle')}</h3>
      {PRICES.map(({ key, price }) => (
        <div class="price-card" key={key}>
          <span>{t(key)}</span>
          <strong>{price}</strong>
        </div>
      ))}
      <p class="muted" style="font-size:0.85rem;margin:0">
        {t('proPricingNote')}
      </p>
      {notified ? (
        <p class="narration" style="min-height:0;font-size:1rem">
          {t('proNotifyDone')}
        </p>
      ) : (
        <button class="btn-primary btn-block" type="button" onClick={onNotify}>
          {t('proNotify')}
        </button>
      )}
      <button class="btn btn-block" type="button" onClick={onBack}>
        {t('back')}
      </button>
    </div>
  )

  if (!sheet) {
    return <div class="stack">{body}</div>
  }

  return (
    <div
      class="pro-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t('proTitle')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBack()
      }}
    >
      <div class="pro-sheet">{body}</div>
    </div>
  )
}

/** Landing / game-over CTA that opens Pro and fires pro_click. */
export function ProComingSoonButton({
  t,
  onOpen,
  className = 'btn btn-block',
}: {
  t: (k: string) => string
  onOpen: () => void
  className?: string
}) {
  return (
    <button
      class={className}
      type="button"
      onClick={() => {
        track('pro_click')
        onOpen()
      }}
    >
      {t('ctaProComingSoon')}
    </button>
  )
}
