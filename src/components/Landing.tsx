import { MoonArt } from './MoonArt'
import { ProComingSoonButton } from './ProUpsell'

interface Props {
  t: (k: string) => string
  onPassPhone: () => void
  onCreateRoom: () => void
  onJoinRoom: () => void
  onPro: () => void
}

export function Landing({ t, onPassPhone, onCreateRoom, onJoinRoom, onPro }: Props) {
  return (
    <div class="stack">
      <div class="panel">
        <MoonArt />
        <h1 style="font-size:1.55rem;margin-top:0">{t('landingTitle')}</h1>
        <p class="lead">{t('landingBody')}</p>
        <button class="btn-primary btn-block" type="button" onClick={onCreateRoom} style="margin-top:8px">
          {t('ctaCreateRoom')}
        </button>
        <button class="btn btn-block" type="button" onClick={onJoinRoom} style="margin-top:8px">
          {t('ctaJoinRoom')}
        </button>
        <button class="btn btn-block" type="button" onClick={onPassPhone} style="margin-top:8px">
          {t('ctaPassPhone')}
        </button>
        <div style="margin-top:8px"><ProComingSoonButton t={t} onOpen={onPro} className="btn btn-block" /></div>
        <p class="muted" style="font-size:0.85rem;margin-bottom:0;margin-top:12px">{t('installHint')}</p>
      </div>
      <div class="panel">
        <h3>{t('ctaHow')}</h3>
        <ol class="how-list">
          <li>{t('how1')}</li>
          <li>{t('how2')}</li>
          <li>{t('how3')}</li>
          <li>{t('how4')}</li>
        </ol>
      </div>
    </div>
  )
}
