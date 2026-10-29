import type { IUser, UserRole } from "../models/user.model";

// Tài khoản đăng ký trực tiếp theo luồng cũ chỉ có quyền khách hàng trước khi được duyệt.
export const getEffectiveUserRole = (
  user: Pick<IUser, "role" | "providerOnboardingStatus">,
): UserRole =>
  user.role === "PROVIDER" && user.providerOnboardingStatus &&
  user.providerOnboardingStatus !== "APPROVED"
    ? "CUSTOMER"
    : user.role;
