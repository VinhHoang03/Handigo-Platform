import type { AgentSession } from "./agent-state";

// Giới hạn ngữ cảnh gửi model; lịch sử đầy đủ và biên nhận vẫn được lưu để đối soát.
export function agentContext(session: AgentSession) {
  const conversation = [];
  let size = 0;
  for (const message of [...session.conversation].reverse()) {
    const length = JSON.stringify(message).length;
    if (conversation.length >= 40 || (conversation.length > 0 && size + length > 48000)) break;
    conversation.unshift(message);
    size += length;
  }
  const latestUser = [...session.conversation].reverse().find((message) => message.role === "user");
  return {
    goal: latestUser?.content ?? session.currentGoal,
    conversation,
    taskContext: {
      bookingDraft: session.bookingDraft,
      actions: session.actions.map((action) => ({ tool: action.tool, status: action.status,
        taskVersion: action.taskVersion, result: action.result && typeof action.result === "object"
          ? Object.fromEntries(Object.entries(action.result).filter(([key]) => ["id", "orderId", "orderCode", "status",
            "bookingStatus", "paymentStatus", "amount", "paymentType", "method"].includes(key))) : undefined })),
      requiresReconciliation: session.requiresReconciliation,
      note: "Bản nháp và hành động là trạng thái hệ thống. Ưu tiên yêu cầu mới nhất; không thực hiện lại hành động đã thành công hoặc chưa rõ kết quả.",
    },
  };
}
