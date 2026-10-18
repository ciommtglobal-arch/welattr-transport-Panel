import { refreshPool } from "./logisticsPool";
import { productionAutomationEnabled } from "./logisticsAutomationWorker";
import { logger } from "./logger";
export function startLogisticsPoolWorker() {
  if (!productionAutomationEnabled()) return;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try { await refreshPool(); }
    catch { logger.error("Lojistik havuz taraması doğrulanamadı; tarama başarı olarak kaydedilmedi."); }
    finally { busy = false; }
  };
  const timer = setInterval(() => {void run();},120000);
  timer.unref();
  void run();
}
