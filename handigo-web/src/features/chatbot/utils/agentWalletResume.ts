export interface AgentWalletResume {
  sessionId: string;
  orderId?: string;
  orderCode?: string;
  depositOrderCode: string;
  createdAt: number;
}
const key = (userId: string) => `handigo-agent-wallet-resume:${userId}`;
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const objectId = /^[a-f\d]{24}$/i;

export function saveAgentWalletResume(userId: string, value: AgentWalletResume) {
  sessionStorage.setItem(key(userId), JSON.stringify(value));
}

export function readAgentWalletResume(userId?: string): AgentWalletResume | null {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(key(userId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    if (typeof item.sessionId !== "string" || !uuid.test(item.sessionId)
      || typeof item.depositOrderCode !== "string" || !/^\d{1,30}$/.test(item.depositOrderCode)
      || typeof item.createdAt !== "number" || item.createdAt > Date.now() || Date.now() - item.createdAt > 24 * 3600000
      || (item.orderId !== undefined && (typeof item.orderId !== "string" || !objectId.test(item.orderId)))
      || (item.orderCode !== undefined && typeof item.orderCode !== "string")) return null;
    return { sessionId: item.sessionId, depositOrderCode: item.depositOrderCode, createdAt: item.createdAt,
      orderId: item.orderId as string | undefined, orderCode: item.orderCode as string | undefined };
  } catch { return null; }
}

export function clearAgentWalletResume(userId: string) {
  try { sessionStorage.removeItem(key(userId)); } catch { /* Phiên chat vẫn hoạt động nếu lưu trữ bị chặn. */ }
}

export function walletResumeMessage(value: AgentWalletResume) {
  return value.orderId
    ? `Tôi đã quay lại từ nạp ví. Kiểm tra số dư và chuẩn bị thanh toán bằng ví cho đơn ${value.orderId}.`
    : "Tôi đã quay lại từ nạp ví. Kiểm tra số dư và tiếp tục bản nháp đang đặt.";
}
