import { useState } from 'react';
import { MODULES, canPublish, type PreviewDraft } from '@/lib/logistics-preview/model';
import { lpText, LP_LOCALE, type LpLang } from '@/lib/logistics-preview/i18n';

type Props = { lang: LpLang; record: PreviewDraft; storeError: string | null; onEdit: () => void; onBack: () => void; onStage: (next: 'draft' | 'founder_review') => boolean; onRefresh: () => void };

export function RecordDetail({ lang, record, storeError, onEdit, onBack, onStage, onRefresh }: Props) {
  const t = (k: string) => lpText(lang, k);
  const [msg, setMsg] = useState(false);
  const def = MODULES.find((m) => m.id === record.module)!;
  const fmt = (s: string) => new Date(s).toLocaleString(LP_LOCALE[lang]);
  const review = record.status === 'founder_review';
  function stage(next: 'draft' | 'founder_review') {
    const ok = onStage(next); setMsg(ok);
  }
  return (
    <section aria-labelledby="lp-detail-h" data-testid="detail-draft">
      <button className="lp-btn" onClick={onBack} data-testid="button-back">{t('back')}</button>
      <div className="lp-card" style={{ marginTop: 12 }}>
        <p className="lp-mut">{t('detail')} / {t('m_' + record.module)}</p>
        <h2 className="lp-h2" id="lp-detail-h">{record.title}</h2>
        <div className="lp-row" style={{ margin: '6px 0' }}>
          <span className={'lp-badge' + (review ? ' rv' : '')}>{t(review ? 's_founder_review' : 's_draft')}</span>
          <span className={'lp-badge' + (record.region !== 'mersin' ? ' prep' : '')}>{t('r_' + record.region)}</span>
          <span className="lp-mut">{t('version')} {record.version}</span>
        </div>
        {record.region !== 'mersin' && <p className="lp-mut">{t('r_prep')}</p>}
        {['invitation', 'personnel', 'contract'].includes(record.module) && <p className="lp-mut" style={{ marginTop: 6 }}>{t('n_' + record.module)}</p>}
        <div className="lp-stages" aria-label={t('workflow')}>
          <span className={review ? '' : 'on'}>{t('stage_draft')}</span>
          <span className={review ? 'on' : ''}>{t('stage_review')}</span>
          <span className="off">{t('stage_publish')} ({t('stage_publish_off')})</span>
        </div>
        <dl style={{ marginTop: 10 }}>
          {def.fields.map((f) => <div key={f.key}><dt>{t('f_' + f.key)}</dt><dd>{record.fields[f.key] || '-'}</dd></div>)}
          <div><dt>{t('noteLabel')}</dt><dd>{record.note || '-'}</dd></div>
          <div><dt>{t('created')}</dt><dd>{fmt(record.createdAt)}</dd></div>
          <div><dt>{t('updated')}</dt><dd>{fmt(record.updatedAt)}</dd></div>
        </dl>
      </div>
      <div className="lp-card">
        {review ? <p className="lp-mut" style={{ marginBottom: 8 }}>{t('lockedMsg')}</p> : <p className="lp-mut" style={{ marginBottom: 8 }}>{t('prepareNote')}</p>}
        <div className="lp-row">
          {review
            ? <button className="lp-btn dark" onClick={() => stage('draft')} data-testid="button-return">{t('returnDraft')}</button>
            : <>
                <button className="lp-btn" onClick={onEdit} data-testid="button-edit">{t('edit')}</button>
                <button className="lp-btn dark" onClick={() => stage('founder_review')} data-testid="button-prepare">{t('prepare')}</button>
              </>}
          <button className="lp-btn" disabled aria-disabled="true" title={t('publishOff')} data-testid="button-publish">{t('publish')}</button>
        </div>
        <p className="lp-mut" style={{ marginTop: 8 }}>{canPublish() ? '' : t('publishNote')}</p>
        {msg && <div className="lp-ok" role="status">{t('stageDone')}</div>}
        {storeError && <div className="lp-err" role="alert" data-testid="text-stage-error">{t('e_' + storeError)} <button className="lp-btn" onClick={onRefresh}>{t('refresh')}</button></div>}
      </div>
      <div className="lp-card">
        <h3 className="lp-h2" style={{ fontSize: 16 }}>{t('history')}</h3>
        <ul className="lp-hist">{[...record.history].reverse().map((h, i) => <li key={i}><span>{t('h_' + h.action)}</span><span className="lp-mut">{fmt(h.at)}</span></li>)}</ul>
      </div>
    </section>
  );
}
