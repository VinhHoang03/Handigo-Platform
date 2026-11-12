import { createLogger } from "../../utils/logger";
import { AdminAIAssessment } from "./admin-ai.models";
import { initializeAdminAI, processNextAssessment, scanAutomaticSources } from "./admin-ai.service";

const logger = createLogger("AdminAI");
let timer: ReturnType<typeof setInterval> | undefined;
let running: Promise<void> | undefined;
export async function startAdminAIWorker() {
  if (timer) return;
  await initializeAdminAI();
  const tick = () => {
    if (running) return;
    running = (async () => {
      // Tác vụ đã hết lượt thử và mất lease phải rời trạng thái chạy sau khi máy chủ khởi động lại.
      await AdminAIAssessment.updateMany({ status: "running", attempts: { $gte: 3 }, leaseUntil: { $lt: new Date() } }, { $set: { status: "error", outcome: "manual_review", error: "Tác vụ gián đoạn và đã hết lượt thử. Vui lòng kiểm tra thủ công.", leaseUntil: null } }, { runValidators: true });
      if (!process.env.ADMIN_AI_API_KEY?.trim()) return;
      await scanAutomaticSources().catch(() => { logger.warn("Chưa thể quét tài nguyên AI; vẫn tiếp tục xử lý hàng đợi đã lưu."); });
      for (let index = 0; index < 3; index++) if (!await processNextAssessment()) break;
    })().catch(() => { logger.warn("Tác vụ AI quản trị gặp lỗi; sẽ tiếp tục ở chu kỳ sau."); }).finally(() => { running = undefined; });
  };
  timer = setInterval(tick, 15000);
  timer.unref();
  tick();
}
export async function stopAdminAIWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
  await running;
}
