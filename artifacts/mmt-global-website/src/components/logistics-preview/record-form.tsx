import { useState } from 'react';
import { MODULES, REGION_IDS, validateDraft, PreviewError, type DraftInput, type ModuleId, type PreviewDraft, type RegionId } from '@/lib/logistics-preview/model';
import { lpText, type LpLang } from '@/lib/logistics-preview/i18n';

const CURRENCIES = ['TRY', 'USD', 'EUR', 'AED', 'UAH'];
type Props = { lang: LpLang; module: ModuleId; record?: PreviewDraft; storeError: string | null; onSave: (input: DraftInput) => boolean; onCancel: () => void };

export function RecordForm({ lang, module, record, storeError, onSave, onCancel }: Props) {
  const t = (k: string) => lpText(lang, k);
  const def = MODULES.find((m) => m.id === module)!;
  const [title, setTitle] = useState(record?.title ?? '');
  const [region, setRegion] = useState<RegionId>(record?.region ?? 'mersin');
  const [note, setNote] = useState(record?.note ?? '');
  const [fields, setFields] = useState<Record<string, string>>({ ...(record?.fields ?? {}) });
  const [err, setErr] = useState<string | null>(null);
  const hint = t('n_' + module);
  const hasHint = ['invitation', 'personnel', 'contract'].includes(module);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: DraftInput = { module, title, region, fields, note };
    try { validateDraft(input); } catch (x) { setErr(x instanceof PreviewError ? x.code : 'storageError'); return; }
    setErr(null);
    // Parent closes the form only on success; on failure the typed content stays here.
    if (!onSave(input)) setErr('__store');
  }
  const shown = err === '__store' ? storeError ?? 'storageError' : err;

  return (
    <form className="lp-card" onSubmit={submit} noValidate aria-labelledby="lp-form-h" data-testid="form-draft">
      <h2 className="lp-h2" id="lp-form-h">{t('m_' + module)} - {record ? t('edit') : t('newDraft')}</h2>
      {hasHint && <p className="lp-mut" style={{ marginBottom: 12 }}>{hint}</p>}
      <div className="lp-field">
        <label htmlFor="f-title">{t('titleLabel')} <span className="lp-req">({t('required')})</span></label>
        <input id="f-title" className="lp-in" value={title} maxLength={140} aria-required="true" aria-invalid={!!shown && !title.trim()} onChange={(e) => setTitle(e.target.value)} data-testid="input-title" />
      </div>
      <div className="lp-field">
        <label htmlFor="f-region">{t('region')}</label>
        <select id="f-region" className="lp-sel" value={region} onChange={(e) => setRegion(e.target.value as RegionId)} data-testid="select-region">
          {REGION_IDS.map((r) => <option key={r} value={r}>{t('r_' + r)}{r !== 'mersin' ? ' - ' + t('r_prep').split('.')[0] : ''}</option>)}
        </select>
      </div>
      {def.fields.map((f) => {
        const id = 'f-' + f.key; const val = fields[f.key] ?? '';
        const set = (v: string) => setFields((p) => ({ ...p, [f.key]: v }));
        const common = { id, 'aria-required': f.required ? true : undefined, 'data-testid': 'input-' + f.key } as const;
        return (
          <div className="lp-field" key={f.key}>
            <label htmlFor={id}>{t('f_' + f.key)} {f.required && <span className="lp-req">({t('required')})</span>}</label>
            {f.type === 'textarea' ? <textarea {...common} className="lp-ta" value={val} onChange={(e) => set(e.target.value)} />
              : f.type === 'currency' ? (
                <select {...common} className="lp-sel" value={val} onChange={(e) => set(e.target.value)}>
                  <option value="">{t('select')}</option>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>)
              : <input {...common} className="lp-in" type={f.type === 'number' ? 'number' : f.type} inputMode={f.type === 'number' ? 'decimal' : undefined} step={f.type === 'number' ? 'any' : undefined} min={f.type === 'number' ? '0' : undefined} dir={f.type === 'email' ? 'ltr' : undefined} value={val} onChange={(e) => set(e.target.value)} />}
          </div>
        );
      })}
      <div className="lp-field">
        <label htmlFor="f-note">{t('noteLabel')}</label>
        <textarea id="f-note" className="lp-ta" value={note} maxLength={5000} onChange={(e) => setNote(e.target.value)} data-testid="input-note" />
      </div>
      {shown && <div className="lp-err" role="alert" data-testid="text-form-error">{t('e_' + shown)}</div>}
      <div className="lp-row">
        <button type="submit" className="lp-btn pri" data-testid="button-save">{t('save')}</button>
        <button type="button" className="lp-btn" onClick={onCancel} data-testid="button-cancel">{t('cancel')}</button>
      </div>
    </form>
  );
}
