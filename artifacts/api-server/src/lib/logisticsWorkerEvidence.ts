import { readFile, rename, writeFile } from "node:fs/promises";
import { z } from "zod/v4";
import { PRODUCTION_DRAFT_INTERVAL_MS } from "./logisticsPoolDraftPolicy";

const evidenceSchema = z.object({
  at: z.string().datetime(),
  mode: z.enum(["test_drafts", "production_drafts"]),
  result: z.enum(["starting", "queued", "idle", "busy", "blocked", "error"]),
}).strict();
export type WorkerEvidence = z.infer<typeof evidenceSchema>;

/** Process-local evidence only. Never contains records, identifiers or credentials. */
export async function writeWorkerEvidence(evidence: WorkerEvidence) {
  const path = process.env.MMT_LOGISTICS_WORKER_EVIDENCE_PATH;
  if (!path) return;
  const parsed = evidenceSchema.parse(evidence);
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(parsed), { mode: 0o600 });
  await rename(temporary, path);
}

export async function describeWorkerEvidence(now = Date.now()): Promise<string> {
  const path = process.env.MMT_LOGISTICS_WORKER_EVIDENCE_PATH;
  if (!path) return "Bağımsız worker çalışma kanıtı yok; 7/24 çalışma doğrulanmadı.";
  try {
    const raw = await readFile(path, "utf8");
    if (raw.length > 1024) throw new Error("Invalid evidence size");
    const evidence = evidenceSchema.parse(JSON.parse(raw));
    const age = now - Date.parse(evidence.at);
    const maxAge = evidence.mode === "production_drafts" ? PRODUCTION_DRAFT_INTERVAL_MS + 180_000 : 180_000;
    if (age < 0 || age > maxAge) return "Worker çalışma kanıtı eskimiş; çalışıyor sayılmıyor.";
    return `Worker son kontrol: ${evidence.at}; ortam: ${evidence.mode}; sonuç: ${evidence.result}. ` +
      "Bu son tur kanıtıdır; kesintisiz çalışma veya gerçek eşleşme garantisi değildir.";
  } catch {
    return "Worker çalışma kanıtı okunamadı; çalışıyor sayılmıyor.";
  }
}
