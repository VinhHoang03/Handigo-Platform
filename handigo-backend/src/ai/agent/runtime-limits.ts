export const AGENT_REQUEST_TIMEOUT_MS = 180_000;
// Socket phải còn mở khi runtime kết thúc và lưu phản hồi; nhỏ hơn timeout 200 giây của web.
export const AGENT_HTTP_TIMEOUT_MS = AGENT_REQUEST_TIMEOUT_MS + 15_000;
// Lease bao phủ cả lượt xử lý và khoảng đệm lưu kết quả, tránh được lấy lại khi request còn hạn.
export const AGENT_SESSION_LEASE_MS = AGENT_REQUEST_TIMEOUT_MS + 60_000;
