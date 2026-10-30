import type { CaseUser, SupportTicket } from "@/features/case-management/types/caseManagement.types";

export interface ViolationTargetOption {
  userId: string;
  label: string;
}

export function getSupportViolationTargets(ticket: SupportTicket): ViolationTargetOption[] {
  const users = new Map<string, { user: CaseUser; roles: string[] }>();
  const add = (user: CaseUser | null | undefined, role: string) => {
    if (!user?._id || user.role === "ADMIN") return;
    const existing = users.get(user._id);
    if (existing) existing.roles.push(role);
    else users.set(user._id, { user, roles: [role] });
  };
  add(ticket.requesterId, "Người gửi hỗ trợ");
  add(ticket.orderId?.customerId, "Khách trong đơn");
  add(ticket.orderId?.providerId?.userId, "Thợ trong đơn");
  return Array.from(users, ([userId, { user, roles }]) => ({
    userId,
    label: `${user.fullName || "Người dùng"}${user.email ? ` · ${user.email}` : ""} — ${roles.join(", ")}`,
  }));
}
