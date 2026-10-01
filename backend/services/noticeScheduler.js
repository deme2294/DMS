import * as noticeService from './noticeService.js';
import * as noticeRepo from '../repository/noticeRepository.js';

let timer = null;

/**
 * Periodically checks for published notices that have reached their expiry date.
 * For each one it warns (email + in-app) every recipient who has not yet
 * acknowledged it, then archives the notice. The `expiry_warned` flag on the
 * notice guarantees each notice is processed only once.
 *
 * @param {number} intervalMs  how often to run (default 30s)
 */
export const startNoticeScheduler = (intervalMs = 30 * 1000) => {
  if (timer) return;

  const tick = async () => {
    try {
      const processed = await noticeService.processExpirations();
      const archived = await noticeRepo.archiveExpiredNotices();
      if (processed > 0 || archived > 0) {
        console.log(`[NOTICES] Expiry job: ${processed} warned/archived, ${archived} automatically archived.`);
      }
    } catch (err) {
      console.error('[NOTICES] Expiry job failed:', err.message);
    }
  };

  // Run once shortly after boot, then on the interval.
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 2000);
  console.log(`[NOTICES] Expiry scheduler started (every ${intervalMs / 1000}s).`);
};

export const stopNoticeScheduler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
