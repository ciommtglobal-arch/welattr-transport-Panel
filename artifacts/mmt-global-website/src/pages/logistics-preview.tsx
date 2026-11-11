import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { MODULES, REGION_IDS, type DraftInput, type DraftStatus, type ModuleId, type RegionId } from '@/lib/logistics-preview/model';
import { usePreviewWorkspace } from '@/lib/logistics-preview/use-workspace';
import { LP_LANGS, LP_LANG_LABEL, LP_HTML_LANG, LP_LANG_KEY, lpText, readLpLang, type LpLang } from '@/lib/logistics-preview/i18n';
import { PreviewBanner } from '@/components/logistics-preview/banner';
import { RecordForm } from '@/components/logistics-preview/record-form';
import { RecordDetail } from '@/components/logistics-preview/record-detail';
import { LP_CSS } from '@/components/logistics-preview/styles';

type View = { kind: 'list' } | { kind: 'form'; id?: string; version?: number } | { kind: 'detail'; id: string };

export default function LogisticsPreview() {
  const ws = usePreviewWorkspace();
  const [lang, setLang] = useState<LpLang>(readLpLang);
  const [mod, setMod] = useState<ModuleId | 'overview'>('overview');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [q, setQ] = useState('');
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const [status, setStatus] = useState<DraftStatus | 'all'>('all');
  const [exportMsg, setExportMsg] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = (k: string) => lpText(lang, k);
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  useEffect(() => {
    const html = document.documentElement;
    const prev = { lang: html.lang, dir: html.dir, title: document.title };
    const meta = document.querySelector('meta[name="description"]');
    const prevMeta = meta?.getAttribute('content') ?? null;
    const applyDocumentLanguage = () => {
      html.lang = LP_HTML_LANG[lang]; html.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.title = lpText(lang, 'docTitle'); meta?.setAttribute('content', lpText(lang, 'metaDesc'));
    };
    applyDocumentLanguage();
    // Reapply after parent effects: the existing site provider owns its own language.
    const frame = window.requestAnimationFrame(applyDocumentLanguage);
    try { window.localStorage.setItem(LP_LANG_KEY, lang); } catch { /* ignore */ }
    return () => {
      window.cancelAnimationFrame(frame);
      html.lang = prev.lang; html.dir = prev.dir; document.title = prev.title;
      if (meta && prevMeta !== null) meta.setAttribute('content', prevMeta);
    };
  }, [lang]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {}; const r: Record<string, number> = {};
    ws.records.forEach((x) => { m[x.module] = (m[x.module] ?? 0) + 1; r[x.region] = (r[x.region] ?? 0) + 1; });
    return { m, r };
  }, [ws.records]);

  const list = useMemo(() => {
    const loc = LP_HTML_LANG[lang];
    const needle = q.trim().toLocaleLowerCase(loc);
    return ws.records.filter((r) => r.module === mod && (region === 'all' || r.region === region) && (status === 'all' || r.status === status)
      && (!needle || [r.title, r.note, ...Object.values(r.fields)].join(' ').toLocaleLowerCase(loc).includes(needle)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [ws.records, mod, q, region, status, lang]);

  function go(next: ModuleId | 'overview') { setMod(next); setView({ kind: 'list' }); setQ(''); setRegion('all'); setStatus('all'); setSaved(false); }
  const viewId = view.kind === 'list' ? undefined : view.id;
  const current = viewId ? ws.records.find((r) => r.id === viewId) : undefined;

  function save(input: DraftInput): boolean {
    const id = view.kind === 'form' ? view.id : undefined;
    // Use the revision captured when the editor opened, not a newer tab's revision.
    const ok = ws.saveDraft(input, id, view.kind === 'form' ? view.version : undefined);
    if (ok) { setSaved(true); setView(id ? { kind: 'detail', id } : { kind: 'list' }); }
    return ok;
  }

  return (
    <div className="lp" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={LP_HTML_LANG[lang]}>
      <style>{LP_CSS}</style>
      <PreviewBanner lang={lang} />
      <header className="lp-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={`${base}/logo.svg`} alt="MMT GLOBAL" />
          <div><h1>{t('brand')}</h1><small>{t('subtitle')}</small></div>
        </div>
        <div className="lp-langs" role="group" aria-label={t('lang')}>
          {LP_LANGS.map((l) => <button key={l} aria-pressed={l === lang} onClick={() => setLang(l)} data-testid={`button-lang-${l}`}>{LP_LANG_LABEL[l]}</button>)}
        </div>
      </header>
      <div className="lp-shell">
        <nav className="lp-nav" aria-label={t('modules')}>
          <div className="lp-mobsel">
            <label htmlFor="lp-mod">{t('menu')}</label>
            <select id="lp-mod" className="lp-sel" value={mod} onChange={(e) => go(e.target.value as ModuleId | 'overview')} data-testid="select-module">
              <option value="overview">{t('overview')}</option>
              {MODULES.map((m) => <option key={m.id} value={m.id}>{t('m_' + m.id)} ({counts.m[m.id] ?? 0})</option>)}
            </select>
          </div>
          <ul className="lp-navlist">
            <li><button aria-current={mod === 'overview'} onClick={() => go('overview')} data-testid="nav-overview">{t('overview')}</button></li>
            {MODULES.map((m) => <li key={m.id}><button aria-current={mod === m.id} onClick={() => go(m.id)} data-testid={`nav-${m.id}`}><span>{t('m_' + m.id)}</span><span className="lp-mut">{counts.m[m.id] ?? 0}</span></button></li>)}
          </ul>
        </nav>
        <main className="lp-main">
          {ws.error && (
            <div className="lp-err" role="alert" data-testid="text-store-error">{t('e_' + ws.error)}{' '}
              <button className="lp-btn" onClick={ws.refresh} data-testid="button-retry">{t('retry')}</button></div>
          )}
          {mod === 'overview' ? (
            <>
              <h2 className="lp-h2">{t('overview')}</h2>
              <div className="lp-grid" style={{ margin: '10px 0 16px' }}>
                <div className="lp-stat"><span className="lp-mut">{t('total')}</span><b data-testid="text-total">{ws.records.length}</b></div>
                {REGION_IDS.map((r) => <div className="lp-stat" key={r}><span className="lp-mut">{t('r_' + r)}</span><b>{counts.r[r] ?? 0}</b></div>)}
              </div>
              <div className="lp-card"><h3 className="lp-h2" style={{ fontSize: 16 }}>{t('regions')}</h3>
                {REGION_IDS.map((r) => <p key={r} style={{ margin: '6px 0' }}><b>{t('r_' + r)}</b><br /><span className="lp-mut">{r === 'mersin' ? t('r_active') : t('r_prep')}</span></p>)}
              </div>
              <div className="lp-card"><h3 className="lp-h2" style={{ fontSize: 16 }}>{t('workflow')}</h3>
                <div className="lp-stages"><span className="on">{t('stage_draft')}</span><span>{t('stage_review')}</span><span className="off">{t('stage_publish')} ({t('stage_publish_off')})</span></div>
                <p className="lp-mut">{t('prepareNote')}</p><p className="lp-mut">{t('publishNote')}</p></div>
              <div className="lp-grid">
                {MODULES.map((m) => <button key={m.id} className="lp-item" onClick={() => go(m.id)} data-testid={`card-${m.id}`}><b>{t('m_' + m.id)}</b><br /><span className="lp-mut">{counts.m[m.id] ?? 0}</span></button>)}
              </div>
              <div className="lp-row">
                <button className="lp-btn dark" onClick={() => setExportMsg(ws.downloadDrafts())} data-testid="button-export">{t('export')}</button>
                {exportMsg && <span className="lp-ok" role="status">{t('exportOk')}</span>}
              </div>
            </>
          ) : view.kind === 'form' ? (
            <RecordForm key={view.id ?? 'new'} lang={lang} module={mod} record={current} storeError={ws.error} onSave={save} onCancel={() => setView(view.id ? { kind: 'detail', id: view.id } : { kind: 'list' })} />
          ) : view.kind === 'detail' && current ? (
            <RecordDetail lang={lang} record={current} storeError={ws.error} onRefresh={ws.refresh} onBack={() => setView({ kind: 'list' })} onEdit={() => setView({ kind: 'form', id: current.id, version: current.version })} onStage={(n) => ws.setStage(current.id, n, current.version)} />
          ) : (
            <>
              <div className="lp-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 className="lp-h2">{t('m_' + mod)}</h2>
                <button className="lp-btn pri" onClick={() => { setSaved(false); setView({ kind: 'form' }); }} data-testid="button-new">{t('newDraft')}</button>
              </div>
              {['invitation', 'personnel', 'contract'].includes(mod) && <p className="lp-mut" style={{ marginBottom: 10 }}>{t('n_' + mod)}</p>}
              {saved && <div className="lp-ok" role="status" data-testid="text-saved">{t('saved')}</div>}
              <div className="lp-card">
                <div className="lp-field"><label htmlFor="lp-q">{t('search')}</label>
                  <input id="lp-q" className="lp-in" type="search" value={q} placeholder={t('searchPh')} onChange={(e) => setQ(e.target.value)} data-testid="input-search" /></div>
                <div className="lp-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div><label htmlFor="lp-fr" className="lp-mut">{t('region')}</label>
                    <select id="lp-fr" className="lp-sel" value={region} onChange={(e) => setRegion(e.target.value as RegionId | 'all')} data-testid="filter-region">
                      <option value="all">{t('allRegions')}</option>{REGION_IDS.map((r) => <option key={r} value={r}>{t('r_' + r)}</option>)}</select></div>
                  <div><label htmlFor="lp-fs" className="lp-mut">{t('status')}</label>
                    <select id="lp-fs" className="lp-sel" value={status} onChange={(e) => setStatus(e.target.value as DraftStatus | 'all')} data-testid="filter-status">
                      <option value="all">{t('allStatuses')}</option><option value="draft">{t('s_draft')}</option><option value="founder_review">{t('s_founder_review')}</option></select></div>
                </div>
              </div>
              {list.length === 0 ? (
                <div className="lp-empty" data-testid="empty-state">
                  <h3 className="lp-h2">{counts.m[mod] ? t('emptyFiltered') : t('emptyTitle')}</h3>
                  <p className="lp-mut" style={{ margin: '6px 0 12px' }}>{counts.m[mod] ? t('emptyFilteredBody') : t('emptyBody')}</p>
                  {!counts.m[mod] && <button className="lp-btn pri" onClick={() => setView({ kind: 'form' })}>{t('newDraft')}</button>}
                </div>
              ) : list.map((r) => (
                <button key={r.id} className="lp-item" onClick={() => { setSaved(false); setView({ kind: 'detail', id: r.id }); }} data-testid={`row-draft-${r.id}`}>
                  <b>{r.title}</b>
                  <div className="lp-row" style={{ marginTop: 4 }}>
                    <span className={'lp-badge' + (r.status === 'founder_review' ? ' rv' : '')}>{t(r.status === 'draft' ? 's_draft' : 's_founder_review')}</span>
                    <span className={'lp-badge' + (r.region !== 'mersin' ? ' prep' : '')}>{t('r_' + r.region)}</span>
                    <span className="lp-mut">v{r.version}</span>
                  </div>
                </button>
              ))}
            </>
          )}
          <footer className="lp-foot">
            <p className="lp-mut">{t('other')}</p>
            <Link href="/limit" data-testid="link-finance">{t('o_finance')}</Link>
            <Link href="/ecosystem" data-testid="link-health">{t('o_health')}</Link>
            <Link href="/birimler/medya" data-testid="link-media">{t('o_media')}</Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
