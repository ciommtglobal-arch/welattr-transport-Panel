import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * One production service, separate API and worker child processes.
 * No DDL, HTTP server, Telegram sender or permission changes here.
 * Continuous operation requires a Reserved VM; Autoscale may sleep.
 */
export function launchLogisticsServices({
  env = process.env,
  spawnProcess = spawn,
  makeDirectory = () => mkdtempSync(join(tmpdir(), "mmt-logistics-")),
  onFailure = (code) => { process.exitCode = code; },
} = {}) {
  if (env.NODE_ENV !== "production" || !env.REPLIT_DEPLOYMENT) {
    throw new Error("Production supervisor is unavailable outside a published runtime.");
  }
  const enabled = env.MMT_LOGISTICS_POOL_AI_DRAFTS_ENABLED === "true";
  if (enabled && (!env.MMT_FOUNDER_REVIEWER_CLERK_USER_ID?.trim() ||
      !env.AI_INTEGRATIONS_GEMINI_BASE_URL?.trim() || !env.AI_INTEGRATIONS_GEMINI_API_KEY?.trim())) {
    throw new Error("Worker prerequisites are missing; no child process was started.");
  }
  const children = new Set();
  const workerEnv = enabled
    ? { ...env, MMT_LOGISTICS_WORKER_EVIDENCE_PATH: join(makeDirectory(), "evidence.json") }
    : { ...env, MMT_LOGISTICS_WORKER_EVIDENCE_PATH: "" };
  let stopping = false;
  let killTimer;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill("SIGTERM");
    killTimer = setTimeout(() => {
      for (const child of children) child.kill("SIGKILL");
    }, 10_000);
    killTimer.unref();
  };
  const start = (filename, role) => {
    const child = spawnProcess(process.execPath, [
      "--enable-source-maps", fileURLToPath(new URL(`../dist/${filename}.mjs`, import.meta.url)),
    ], { stdio: "inherit", env: { ...workerEnv, MMT_LOGISTICS_POOL_WORKER_ROLE: role } });
    children.add(child);
    child.once("error", () => { onFailure(1); stop(); });
    child.once("close", () => {
      children.delete(child);
      if (!stopping) { onFailure(1); stop(); }
      if (!children.size) clearTimeout(killTimer);
    });
  };
  try {
    start("index", "");
    if (enabled && !stopping) start("logistics-worker", "dedicated");
  } catch {
    onFailure(1);
    stop();
  }
  return { stop };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const services = launchLogisticsServices();
    process.once("SIGTERM", services.stop);
    process.once("SIGINT", services.stop);
  } catch {
    console.error("Lojistik servis başlangıcı reddedildi; yapılandırmayı ve yayın önkoşullarını kontrol edin.");
    process.exitCode = 2;
  }
}
