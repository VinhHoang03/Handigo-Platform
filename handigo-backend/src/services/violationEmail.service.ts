import { randomUUID } from "node:crypto";
import { ClientSession } from "mongoose";
import { ViolationEmail } from "../models/violationEmail.model";
import { IViolation } from "../models/violation.model";
import { buildViolationEmail } from "../utils/violationEmail";
import { sendNotificationEmail } from "../utils/mail";
import { createLogger } from "../utils/logger";

const logger = createLogger("ViolationEmail");
const MAX_ATTEMPTS = 5;
const LEASE_MS = 5 * 60_000;

export const enqueueViolationEmail = async (
  violation: IViolation,
  user: { email?: string | null; fullName?: string | null },
  session: ClientSession,
) => {
  // Một số tài khoản cũ chỉ có số điện thoại; không chặn quyết định xử lý vì thiếu email.
  if (!user.email?.trim()) {
    logger.warn("Không thể tạo email vi phạm vì tài khoản chưa có email.", { violationId: String(violation._id) });
    return;
  }
  await ViolationEmail.create([{
    violationId: violation._id,
    userId: violation.userId,
    to: user.email.trim(),
    ...buildViolationEmail(violation, user.fullName || "", String(violation._id)),
  }], { session });
};

export const processViolationEmails = async () => {
  // Thu hồi công việc đã hết lượt thử nếu tiến trình dừng ở lần gửi cuối cùng.
  await ViolationEmail.updateMany({ status: "processing", attempts: { $gte: MAX_ATTEMPTS },
    nextAttemptAt: { $lte: new Date() } },
  { $set: { status: "failed", leaseId: null } }, { runValidators: true });
  for (let index = 0; index < 10; index += 1) {
    const leaseId = randomUUID();
    const job = await ViolationEmail.findOneAndUpdate({
      status: { $in: ["pending", "processing"] }, attempts: { $lt: MAX_ATTEMPTS },
      nextAttemptAt: { $lte: new Date() },
    }, { $set: { status: "processing", leaseId, nextAttemptAt: new Date(Date.now() + LEASE_MS) },
      $inc: { attempts: 1 } }, { new: true, sort: { nextAttemptAt: 1 }, runValidators: true });
    if (!job) return;
    const ownership = { _id: job._id, status: "processing" as const, leaseId };
    try {
      await sendNotificationEmail({ to: job.to, subject: job.subject, text: job.text, html: job.html,
        messageId: `<violation-${job.violationId}@handigo.notification>` });
    } catch {
      // Không lưu lỗi SMTP thô vì có thể chứa địa chỉ email hoặc thông tin xác thực.
      const failed = job.attempts >= MAX_ATTEMPTS;
      await ViolationEmail.updateOne(ownership, { $set: {
        status: failed ? "failed" : "pending", leaseId: null,
        nextAttemptAt: new Date(Date.now() + 60_000 * 2 ** (job.attempts - 1)),
      } }, { runValidators: true });
      logger.warn(failed ? "Email vi phạm đã hết số lần thử, cần kiểm tra để gửi lại."
        : "Gửi email vi phạm thất bại, hệ thống sẽ thử lại.",
      { violationId: String(job.violationId), attempts: job.attempts });
      continue;
    }
    // Nếu ghi nhận kết quả lỗi, giữ lease để khôi phục sau; không đổi thành lỗi gửi SMTP.
    await ViolationEmail.updateOne(ownership, { $set: {
      status: "sent", sentAt: new Date(), leaseId: null,
    } }, { runValidators: true });
  }
};

let timer: ReturnType<typeof setInterval> | undefined;
let activeRun: Promise<void> | undefined;

export const startViolationEmailMonitor = async () => {
  if (timer) return;
  // Khởi tạo collection và index trước khi ghi email trong transaction.
  await ViolationEmail.init();
  const tick = () => {
    if (activeRun) return;
    activeRun = processViolationEmails().catch(() => {
      logger.error("Không thể xử lý hàng đợi email vi phạm; hệ thống sẽ kiểm tra lại ở lượt kế tiếp.");
    }).finally(() => { activeRun = undefined; });
  };
  timer = setInterval(tick, 15_000);
  timer.unref();
  tick();
};

export const stopViolationEmailMonitor = async () => {
  if (timer) clearInterval(timer);
  timer = undefined;
  await activeRun;
};
