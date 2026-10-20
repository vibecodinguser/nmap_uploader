import { Send } from 'lucide-react'
import { useTranslate } from '@/hooks/useLocale'
import { RELEASES_URL } from '@/lib/releases_url'
import packageJson from '../package.json'

const SETTINGS_FOOTER_ICON_SIZE = 16

export const SettingsAboutSection = () => {
  const t = useTranslate()

  return (
    <section
      className="settings-section settings-section--about"
      aria-labelledby="settings-about-heading"
    >
      <h3 className="settings-section-title settings-section-title--row">
        <a
          id="settings-about-heading"
          href={RELEASES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="settings-about-link"
        >
          {t('common.version')} {packageJson.version}
        </a>
        <div className="footer-links">
          <a
            href="https://t.me/notebook_loader_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <Send size={SETTINGS_FOOTER_ICON_SIZE} aria-hidden />
            @feedback
          </a>
        </div>
      </h3>
    </section>
  )
}
