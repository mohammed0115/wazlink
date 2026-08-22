/**
 * محاكاة تقدم عملية الاكتشاف — مقابل `runDiscoverySimulation()` في V1.
 *
 * مؤقت واحد لكل Job خارج شجرة React كي لا يتوقف عند تغيير المسار، تمامًا
 * كما كان `discoveryTimers` في نسخة Vanilla. المحاكاة محلية بالكامل:
 * لا شبكة ولا Scraping ولا مصدر خارجي.
 */
import { progressDiscoveryJob, startDiscoveryJob } from "@services/data";
import { notifyStateChanged } from "../../shared/store/appStore";

const timers = new Map<string, number>();

const TICK_MS = 900;
const STEP = 16;

export function runDiscoverySimulation(jobId: string, onComplete?: (jobId: string) => void): void {
  stopDiscoverySimulation(jobId);
  startDiscoveryJob(jobId);

  const timer = window.setInterval(() => {
    const job = progressDiscoveryJob(jobId, STEP);
    if (job?.status === "completed") {
      stopDiscoverySimulation(jobId);
      onComplete?.(jobId);
    }
    notifyStateChanged();
  }, TICK_MS);

  timers.set(jobId, timer);
}

export function stopDiscoverySimulation(jobId: string): void {
  const timer = timers.get(jobId);
  if (timer) window.clearInterval(timer);
  timers.delete(jobId);
}
