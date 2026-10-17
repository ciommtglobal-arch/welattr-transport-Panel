import { describe, expect, it } from 'vitest';
import {
  MODULES, PREVIEW_STORAGE_KEY, REGION_IDS, PreviewError,
  createDraft, editDraft, changeStage, canPublish, readDrafts, serializeDrafts,
  type DraftInput, type ModuleId, type PreviewDraft,
} from '../../../mmt-global-website/src/lib/logistics-preview/model';
import { LP_DICT, LP_LANGS, LP_HTML_LANG, lpText } from '../../../mmt-global-website/src/lib/logistics-preview/i18n';

const now = '2026-10-06T00:00:00.000Z';
function input(module: ModuleId = 'company'): DraftInput {
  const definition = MODULES.find((entry) => entry.id === module)!;
  return {
    module, title: 'ÖRNEK — önizleme taslağı', region: 'mersin', note: 'Gerçek veri değil',
    fields: Object.fromEntries(definition.fields.map((field) => [
      field.key,
      field.type === 'email' ? 'preview@example.invalid'
        : field.type === 'number' ? '24'
          : field.type === 'currency' ? 'USD'
            : field.type === 'date' ? '2026-10-07' : 'ÖRNEK',
    ])),
  };
}
function expectCode(run: () => unknown, code: string) {
  try { run(); throw new Error('Expected a validation error'); }
  catch (error) {
    expect(error).toBeInstanceOf(PreviewError);
    expect((error as PreviewError).code).toBe(code);
  }
}

describe('isolated logistics preview', () => {
  it('preserves six complete UI dictionaries without silent mixed-language fallbacks', () => {
    expect(LP_LANGS).toEqual(['tr', 'en', 'ar', 'ku', 'ru', 'ua']);
    expect(LP_HTML_LANG.ua).toBe('uk');
    const requiredKeys = Object.keys(LP_DICT.tr).sort();
    for (const language of LP_LANGS) {
      expect(Object.keys(LP_DICT[language]).sort()).toEqual(requiredKeys);
      for (const key of requiredKeys) expect(lpText(language, key).length).toBeGreaterThan(0);
      for (const module of MODULES) {
        expect(lpText(language, `m_${module.id}`).length).toBeGreaterThan(0);
        for (const field of module.fields) expect(lpText(language, `f_${field.key}`).length).toBeGreaterThan(0);
      }
    }
    expect(() => lpText('tr', 'unknown-key')).toThrow('Missing preview translation');
  });
  it('contains ten modules and the five requested regions without changing storage identity', () => {
    expect(MODULES.map((module) => module.id)).toEqual([
      'company', 'invitation', 'partnership', 'shipper', 'carrier',
      'dealer', 'personnel', 'quote', 'contract', 'operation',
    ]);
    expect(REGION_IDS).toEqual(['mersin', 'ukraine', 'dubai', 'iraq', 'russia']);
    expect(PREVIEW_STORAGE_KEY).toBe('mmt-logistics-preview-drafts-v1');
  });
  it.each(['iraq', 'russia'] as const)('preserves existing drafts when reloading a new %s regional draft', (region) => {
    const existing = createDraft(input(), 'existing-mersin', now);
    const added = createDraft({ ...input(), region }, `test-${region}`, now);
    expect(readDrafts(serializeDrafts([existing, added]))).toEqual([existing, added]);
    expect(added.status).toBe('draft');
    expect(canPublish()).toBe(false);
  });
  it.each(MODULES.map((module) => module.id))('creates and reloads a %s draft without publishing', (module) => {
    const record = createDraft(input(module), `preview-${module}`, now);
    expect(record.status).toBe('draft');
    expect(readDrafts(serializeDrafts([record]))).toEqual([record]);
    expect(canPublish()).toBe(false);
  });
  it('starts empty and never seeds fake companies or staff', () => expect(readDrafts(null)).toEqual([]));
  it('rejects blank titles and required module fields', () => {
    expectCode(() => createDraft({ ...input(), title: ' ' }, 'id', now), 'required');
    expectCode(() => createDraft({ ...input('shipper'), fields: {} }, 'id', now), 'required');
  });
  it('validates invitation email without sending an invitation', () => {
    const value = input('invitation');
    value.fields.email = 'invalid';
    expectCode(() => createDraft(value, 'id', now), 'invalidEmail');
  });
  it.each(['0', '-2', 'Infinity', 'not a number'])('rejects invalid capacity %s', (capacity) => {
    const value = input('carrier');
    value.fields.capacity = capacity;
    expectCode(() => createDraft(value, 'id', now), 'invalidNumber');
  });
  it('rejects impossible dates and unsupported currencies', () => {
    const value = input('quote');
    value.fields.validUntil = '2026-02-30';
    expectCode(() => createDraft(value, 'id', now), 'invalidDate');
    value.fields.validUntil = '2026-10-07';
    value.fields.currency = 'INVALID';
    expectCode(() => createDraft(value, 'id', now), 'invalidCurrency');
  });
  it('preserves previous input objects and edit history', () => {
    const record = createDraft(input(), 'id', now);
    const updated = editDraft(record, { ...input(), title: 'Yeni taslak' }, 1, now);
    expect(record.title).toBe('ÖRNEK — önizleme taslağı');
    expect(updated.title).toBe('Yeni taslak');
    expect(updated.version).toBe(2);
    expect(updated.history.map((entry) => entry.action)).toEqual(['created', 'edited']);
  });
  it('requires returning review-preparation drafts before editing', () => {
    const record = createDraft(input(), 'id', now);
    const pending = changeStage(record, 'founder_review', 1, now);
    expectCode(() => editDraft(pending, input(), 2, now), 'locked');
    const returned = changeStage(pending, 'draft', 2, now);
    expect(returned.status).toBe('draft');
    expect(returned.history.map((entry) => entry.action)).toEqual(['created', 'prepared_review', 'returned']);
  });
  it('rejects stale edits and stage changes without overwriting newer versions', () => {
    const original = createDraft(input(), 'id', now);
    const updated = editDraft(original, input(), 1, now);
    expectCode(() => editDraft(updated, input(), 1, now), 'conflict');
    expectCode(() => changeStage(updated, 'founder_review', 1, now), 'conflict');
  });
  it('cannot change a saved record into another module', () => {
    expectCode(() => editDraft(createDraft(input(), 'id', now), input('personnel'), 1, now), 'invalidModule');
  });
  it('rejects forged publication or approval states both in memory and storage', () => {
    const record = createDraft(input(), 'id', now);
    expectCode(() => changeStage(record, 'published' as never, 1, now), 'locked');
    for (const status of ['published', 'approved']) {
      expectCode(() => readDrafts(JSON.stringify({ schema: 1, records: [{ ...record, status }] })), 'corruptStorage');
    }
    expect(canPublish()).toBe(false);
  });
  it('does not silently erase corrupt or incompatible browser storage', () => {
    expectCode(() => readDrafts('broken-json'), 'corruptStorage');
    expectCode(() => readDrafts('{"schema":2,"records":[]}'), 'corruptStorage');
    expectCode(() => readDrafts('{"schema":1,"records":[null]}'), 'corruptStorage');
  });
  it('rejects duplicate record ids and non-string fields', () => {
    const record = createDraft(input(), 'id', now);
    expectCode(() => serializeDrafts([record, record]), 'corruptStorage');
    const forged = { ...record, fields: { companyName: 10 } } as unknown as PreviewDraft;
    expectCode(() => serializeDrafts([forged]), 'corruptStorage');
  });
});
