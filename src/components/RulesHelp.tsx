import type { RoleId } from '../engine'
import { PREMIUM_ROLES, ROLES } from '../engine'

const ORDER: RoleId[] = [
  'werewolf',
  'villager',
  'seer',
  'doctor',
  'witch',
  'hunter',
  'cupid',
  'spy',
  'littlegirl',
]

interface Props {
  t: (k: string) => string
  onClose: () => void
}

export function RulesHelp({ t, onClose }: Props) {
  return (
    <div class="panel stack" role="dialog" aria-label={t('rulesTitle')}>
      <div class="row">
        <h2 class="space">{t('rulesTitle')}</h2>
        <button class="btn-ghost" type="button" onClick={onClose}>
          {t('close')}
        </button>
      </div>
      <p class="muted">{t('landingBody')}</p>
      <ol class="log-list">
        <li>{t('how1')}</li>
        <li>{t('how2')}</li>
        <li>{t('how3')}</li>
        <li>{t('how4')}</li>
      </ol>
      <h3>{t('roles')}</h3>
      <ul class="log-list">
        {ORDER.map((id) => (
          <li key={id}>
            <strong>
              {t(`role_${id}`)}
              {PREMIUM_ROLES.includes(id) || ROLES[id].premium ? ` (${t('premium')})` : ''}
            </strong>
            — {t(`desc_${id}`)}
          </li>
        ))}
      </ul>
      <button class="btn-primary btn-block" type="button" onClick={onClose}>
        {t('close')}
      </button>
    </div>
  )
}
