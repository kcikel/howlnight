interface Props {
  t: (k: string) => string
  onBack: () => void
}

export function ProUpsell({ t, onBack }: Props) {
  return (
    <div class="stack">
      <div class="panel stack">
        <h2>{t('proTitle')}</h2>
        <p class="lead">{t('proBody')}</p>
        {[
          ['proWeekly', '$2.99'],
          ['proYearly', '$19.99'],
          ['proLifetime', '$34.99'],
          ['proRoles', '$4.99'],
        ].map(([key]) => (
          <div class="price-card" key={key}>
            <span>{t(key)}</span>
            <button class="chip" type="button" disabled>
              {t('proSoon')}
            </button>
          </div>
        ))}
      </div>
      <button class="btn btn-block" type="button" onClick={onBack}>
        {t('back')}
      </button>
    </div>
  )
}
