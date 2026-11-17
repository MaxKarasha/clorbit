// EN/UK language toggle used in the galaxy HUD and in the analytics navigation.
import { LANGS, setLang, t, useLang } from '../i18n';

export default function LangSwitch({ className = 'lang-switch', btnClass = 'lang-switch__btn' }: { className?: string; btnClass?: string }) {
  const lang = useLang();
  return (
    <div className={className} role="radiogroup" aria-label={t('lang.switch')}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          className={`${btnClass}${lang === l ? ' is-active on' : ''}`}
          title={t(l === 'en' ? 'lang.en.title' : 'lang.uk.title')}
          onClick={() => setLang(l)}
        >
          {t(l === 'en' ? 'lang.en' : 'lang.uk')}
        </button>
      ))}
    </div>
  );
}
