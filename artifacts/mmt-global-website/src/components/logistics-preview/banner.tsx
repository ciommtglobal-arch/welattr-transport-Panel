import { lpText, type LpLang } from '@/lib/logistics-preview/i18n';
export function PreviewBanner({ lang }: { lang: LpLang }) {
  const t = (k: string) => lpText(lang, k);
  return (
    <div className="lp-banner" role="note" data-testid="banner-preview">
      <b>{t('previewTag')}</b>
      <ul>{['banner1', 'banner2', 'banner3', 'banner4'].map((k) => <li key={k}>{t(k)}</li>)}</ul>
      <p>{t('localNote')}</p>
    </div>
  );
}
