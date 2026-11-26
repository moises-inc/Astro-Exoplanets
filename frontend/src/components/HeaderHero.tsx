import type { TranslationDictionary } from '../i18n';
import type { DataSource, Lang } from '../types/exoplanet';

interface HeaderHeroProps {
  dict: TranslationDictionary;
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  source: DataSource;
  sourceMessage: string;
  loading: boolean;
  onOpenMobileFilters: () => void;
}

export function HeaderHero({
  dict,
  lang,
  onChangeLang,
  source,
  sourceMessage,
  loading,
  onOpenMobileFilters,
}: HeaderHeroProps) {
  const normalizedSource = source.toLowerCase();
  const isLiveApi = normalizedSource === 'api';
  const isOfflineBackup = normalizedSource === 'archivo' || normalizedSource === 'csv_backup';

  const dotClass = isLiveApi
    ? 'status-dot status-dot--api'
    : isOfflineBackup
      ? 'status-dot status-dot--archivo'
      : 'status-dot status-dot--error';

  const statusTag = isLiveApi
    ? dict.status.liveTag
    : isOfflineBackup
      ? dict.status.offlineTag
      : dict.status.errorTag;

  return (
    <>
      <div className="top-utility-bar">
        <div className="top-utility-left">
          <button
            type="button"
            className="btn btn-secondary btn-compact mobile-filter-btn"
            onClick={onOpenMobileFilters}
          >
            {dict.header.openFilters}
          </button>
        </div>

        <div
          className="lang-toggle"
          role="group"
          aria-label={dict.header.langToggleAria}
        >
          <button
            type="button"
            className="lang-btn"
            aria-pressed={lang === 'es'}
            onClick={() => onChangeLang('es')}
          >
            ES
          </button>
          <button
            type="button"
            className="lang-btn"
            aria-pressed={lang === 'en'}
            onClick={() => onChangeLang('en')}
          >
            EN
          </button>
        </div>
      </div>

      <section className="hero-grid" aria-labelledby="app-main-title">
        <header className="exo-header">
          <div>
            <span className="exo-kicker">{dict.header.kicker}</span>
            <h1 id="app-main-title" className="exo-title">
              {dict.header.title}
            </h1>
            <p className="exo-subtitle">{dict.header.subtitle}</p>
          </div>
          <div className="exo-question-band">
            <span className="exo-question-label">{dict.header.questionLabel}</span>
            <p className="exo-question-text">{dict.header.question}</p>
          </div>
        </header>

        <figure className="hero-figure">
          <img
            src="/assets/hero_atacama_exoplanetas.png"
            alt={dict.header.heroAlt}
            loading="eager"
          />
          <figcaption>{dict.header.heroCaption}</figcaption>
        </figure>
      </section>

      <div
        className="exo-banner"
        role={source === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        <span className={dotClass} aria-hidden="true" />
        <span className="exo-banner-tag">{statusTag}</span>
        <span className="exo-banner-msg">
          {loading ? dict.status.loading : sourceMessage}
        </span>
      </div>

      <details className="guide-details">
        <summary className="guide-summary">{dict.guide.summary}</summary>
        <div className="guide-body">
          <div className="guide-col">
            {dict.guide.left.map((item) => (
              <div key={item.title} className="guide-item">
                <h4>{item.title}</h4>
                <p>{item.body}</p>
                {item.bullets ? (
                  <ul>
                    {item.bullets.map((b) => (
                      <li key={b.label}>
                        <strong>{b.label}</strong> {b.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
          <div className="guide-col">
            {dict.guide.right.map((item) => (
              <div key={item.title} className="guide-item">
                <h4>{item.title}</h4>
                <p>{item.body}</p>
                {item.bullets ? (
                  <ul>
                    {item.bullets.map((b) => (
                      <li key={b.label}>
                        <strong>{b.label}</strong> {b.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </details>
    </>
  );
}
