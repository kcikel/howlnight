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
    <div class="landing">
      <MoonArt />
      <section class="landing-intro">
        <h1 class="landing-title">{t('landingTitle')}</h1>
        <p class="lead">{t('landingBody')}</p>
      </section>
      <nav class="landing-actions" aria-label={t('appName')}>
        <button class="btn-primary btn-block" type="button" onClick={onCreateRoom}>
          {t('ctaCreateRoom')}
        </button>
        <button class="btn btn-block" type="button" onClick={onJoinRoom}>
          {t('ctaJoinRoom')}
        </button>
        <button class="btn btn-block" type="button" onClick={onPassPhone}>
          {t('ctaPassPhone')}
        </button>
        <ProComingSoonButton t={t} onOpen={onPro} className="btn-quiet btn-block" />
      </nav>
      <p class="install-hint">{t('installHint')}</p>
      <section class="how">
        <h2 class="how-title">{t('ctaHow')}</h2>
        <ol class="how-list">
          <li>{t('how1')}</li>
          <li>{t('how2')}</li>
          <li>{t('how3')}</li>
          <li>{t('how4')}</li>
        </ol>
      </section>
    </div>
  )
}
