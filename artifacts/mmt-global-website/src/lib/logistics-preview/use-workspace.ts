import { useEffect, useState } from 'react';
import {
  PREVIEW_STORAGE_KEY, PreviewError, createDraft, editDraft, changeStage, readDrafts, serializeDrafts,
  type PreviewDraft, type DraftInput, type DraftStatus, type PreviewErrorCode,
} from './model';

type Snapshot = { records: PreviewDraft[]; error: PreviewErrorCode | null };
function snapshot(): Snapshot {
  try { return { records: readDrafts(window.localStorage.getItem(PREVIEW_STORAGE_KEY)), error: null }; }
  catch (error) { return { records: [], error: error instanceof PreviewError ? error.code : 'storageError' }; }
}

export function usePreviewWorkspace() {
  const [state, setState] = useState<Snapshot>(snapshot);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === PREVIEW_STORAGE_KEY || event.key === null) setState(snapshot());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  function mutate(update: (records: PreviewDraft[]) => PreviewDraft[]): boolean {
    try {
      // Reload storage before every write to avoid overwriting newer changes from another tab.
      const latest = readDrafts(window.localStorage.getItem(PREVIEW_STORAGE_KEY));
      const records = update(latest);
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, serializeDrafts(records));
      setState({ records, error: null });
      return true;
    } catch (error) {
      setState((previous) => ({ ...previous, error: error instanceof PreviewError ? error.code : 'storageError' }));
      return false;
    }
  }

  function saveDraft(input: DraftInput, id?: string, expectedVersion?: number): boolean {
    return mutate((records) => {
      const now = new Date().toISOString();
      if (!id) return [...records, createDraft(input, crypto.randomUUID(), now)];
      const current = records.find((record) => record.id === id);
      if (!current) throw new PreviewError('notFound');
      const updated = editDraft(current, input, expectedVersion ?? -1, now);
      return records.map((record) => record.id === id ? updated : record);
    });
  }

  function setStage(id: string, next: DraftStatus, expectedVersion: number): boolean {
    return mutate((records) => {
      const current = records.find((record) => record.id === id);
      if (!current) throw new PreviewError('notFound');
      const updated = changeStage(current, next, expectedVersion, new Date().toISOString());
      return records.map((record) => record.id === id ? updated : record);
    });
  }

  function downloadDrafts(): boolean {
    try {
      const records = readDrafts(window.localStorage.getItem(PREVIEW_STORAGE_KEY));
      const url = URL.createObjectURL(new Blob([serializeDrafts(records)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mmt-lojistik-preview-taslaklari.json';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (error) {
      setState((previous) => ({ ...previous, error: error instanceof PreviewError ? error.code : 'storageError' }));
      return false;
    }
  }
  return { records: state.records, error: state.error, saveDraft, setStage, downloadDrafts, refresh: () => setState(snapshot()) };
}
