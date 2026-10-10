// Isolated preview data only. This module has no API, database or identity client.
export const PREVIEW_STORAGE_KEY = 'mmt-logistics-preview-drafts-v1';
export const REGION_IDS = ['mersin', 'ukraine', 'dubai'] as const;
export type RegionId = typeof REGION_IDS[number];
export type DraftStatus = 'draft' | 'founder_review';
export type ModuleId = 'company' | 'invitation' | 'partnership' | 'shipper' | 'carrier' | 'dealer' | 'personnel' | 'quote' | 'contract' | 'operation';
export type FieldKey = 'companyName' | 'email' | 'partner' | 'origin' | 'destination' | 'cargo' | 'capacity' | 'vehicleType' | 'territory' | 'assignee' | 'task' | 'amount' | 'currency' | 'validUntil' | 'terms' | 'reference' | 'plannedDate';
export type FieldDefinition = { key: FieldKey; type: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'currency'; required?: boolean };
export type ModuleDefinition = { id: ModuleId; fields: FieldDefinition[] };
export const MODULES: ModuleDefinition[] = [
  { id: 'company', fields: [{ key: 'companyName', type: 'text', required: true }, { key: 'email', type: 'email' }] },
  { id: 'invitation', fields: [{ key: 'companyName', type: 'text', required: true }, { key: 'email', type: 'email', required: true }] },
  { id: 'partnership', fields: [{ key: 'partner', type: 'text', required: true }, { key: 'terms', type: 'textarea', required: true }] },
  { id: 'shipper', fields: [{ key: 'origin', type: 'text', required: true }, { key: 'destination', type: 'text', required: true }, { key: 'cargo', type: 'text', required: true }, { key: 'capacity', type: 'number', required: true }] },
  { id: 'carrier', fields: [{ key: 'companyName', type: 'text', required: true }, { key: 'vehicleType', type: 'text', required: true }, { key: 'capacity', type: 'number', required: true }] },
  { id: 'dealer', fields: [{ key: 'partner', type: 'text', required: true }, { key: 'territory', type: 'text', required: true }, { key: 'terms', type: 'textarea' }] },
  { id: 'personnel', fields: [{ key: 'assignee', type: 'text', required: true }, { key: 'task', type: 'textarea', required: true }, { key: 'plannedDate', type: 'date' }] },
  { id: 'quote', fields: [{ key: 'partner', type: 'text', required: true }, { key: 'amount', type: 'number', required: true }, { key: 'currency', type: 'currency', required: true }, { key: 'validUntil', type: 'date', required: true }] },
  { id: 'contract', fields: [{ key: 'partner', type: 'text', required: true }, { key: 'terms', type: 'textarea', required: true }] },
  { id: 'operation', fields: [{ key: 'reference', type: 'text', required: true }, { key: 'origin', type: 'text', required: true }, { key: 'destination', type: 'text', required: true }, { key: 'plannedDate', type: 'date', required: true }] },
];
export type DraftInput = { module: ModuleId; title: string; region: RegionId; fields: Partial<Record<FieldKey, string>>; note: string };
export type HistoryAction = 'created' | 'edited' | 'prepared_review' | 'returned';
export type PreviewDraft = DraftInput & {
  id: string;
  status: DraftStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  history: { action: HistoryAction; at: string }[];
};
export type PreviewErrorCode = 'required' | 'invalidEmail' | 'invalidNumber' | 'invalidDate' | 'tooLong' | 'invalidCurrency' | 'invalidModule' | 'conflict' | 'locked' | 'notFound' | 'storageError' | 'corruptStorage';
export class PreviewError extends Error {
  constructor(public code: PreviewErrorCode) { super(code); }
}

export function validateDraft(input: DraftInput): DraftInput {
  const definition = MODULES.find((module) => module.id === input.module);
  if (!definition || !REGION_IDS.includes(input.region)) throw new PreviewError('invalidModule');
  if (!input.title.trim()) throw new PreviewError('required');
  if (input.title.length > 140 || input.note.length > 5000) throw new PreviewError('tooLong');
  const fields: DraftInput['fields'] = {};
  for (const field of definition.fields) {
    const value = (input.fields[field.key] ?? '').trim();
    if (field.required && !value) throw new PreviewError('required');
    if (value.length > 5000) throw new PreviewError('tooLong');
    if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new PreviewError('invalidEmail');
    if (value && field.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) <= 0)) throw new PreviewError('invalidNumber');
    if (value && field.type === 'currency' && !['TRY', 'USD', 'EUR', 'AED', 'UAH'].includes(value)) throw new PreviewError('invalidCurrency');
    if (value && field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new PreviewError('invalidDate');
    fields[field.key] = value;
  }
  return { module: input.module, title: input.title.trim(), region: input.region, fields, note: input.note.trim() };
}

export function createDraft(input: DraftInput, id: string, now: string): PreviewDraft {
  return { ...validateDraft(input), id, status: 'draft', version: 1, createdAt: now, updatedAt: now, history: [{ action: 'created', at: now }] };
}

export function editDraft(record: PreviewDraft, input: DraftInput, expectedVersion: number, now: string): PreviewDraft {
  if (record.version !== expectedVersion) throw new PreviewError('conflict');
  if (record.status !== 'draft') throw new PreviewError('locked');
  if (record.module !== input.module) throw new PreviewError('invalidModule');
  return { ...record, ...validateDraft(input), version: record.version + 1, updatedAt: now, history: [...record.history, { action: 'edited', at: now }] };
}

export function changeStage(record: PreviewDraft, next: DraftStatus, expectedVersion: number, now: string): PreviewDraft {
  if (record.version !== expectedVersion) throw new PreviewError('conflict');
  if (record.status === next) throw new PreviewError('locked');
  if (next !== 'draft' && next !== 'founder_review') throw new PreviewError('locked');
  validateDraft(record);
  return { ...record, status: next, version: record.version + 1, updatedAt: now, history: [...record.history, { action: next === 'founder_review' ? 'prepared_review' : 'returned', at: now }] };
}

// Publication is deliberately unavailable, including for records forged in localStorage.
export function canPublish(): false { return false; }

export function readDrafts(raw: string | null): PreviewDraft[] {
  if (raw === null) return [];
  try {
    const envelope = JSON.parse(raw);
    if (envelope.schema !== 1 || !Array.isArray(envelope.records) || envelope.records.length > 1000) throw new Error();
    const seen = new Set<string>();
    return envelope.records.map((record: PreviewDraft) => {
      if (!record || typeof record.title !== 'string' || typeof record.note !== 'string' || !record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields)) throw new Error();
      if (Object.values(record.fields).some((value) => typeof value !== 'string')) throw new Error();
      const input = validateDraft(record);
      if (typeof record.id !== 'string' || !record.id || seen.has(record.id) || !['draft', 'founder_review'].includes(record.status) || !Number.isSafeInteger(record.version) || record.version < 1) throw new Error();
      if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string' || Number.isNaN(Date.parse(record.createdAt)) || Number.isNaN(Date.parse(record.updatedAt))) throw new Error();
      if (!Array.isArray(record.history) || record.history.some((item) => !item || !['created', 'edited', 'prepared_review', 'returned'].includes(item.action) || typeof item.at !== 'string' || Number.isNaN(Date.parse(item.at)))) throw new Error();
      seen.add(record.id);
      return { ...input, id: record.id, status: record.status, version: record.version, createdAt: record.createdAt, updatedAt: record.updatedAt, history: record.history };
    });
  } catch { throw new PreviewError('corruptStorage'); }
}

export function serializeDrafts(records: PreviewDraft[]): string {
  const json = JSON.stringify({ schema: 1, records });
  readDrafts(json);
  return json;
}
