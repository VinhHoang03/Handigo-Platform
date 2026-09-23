import type { Address } from "@/types/booking";
import {
  isValidVietnamesePhone,
  normalizeVietnamesePhone,
} from "@/utils/phoneValidation";

export interface RecipientContact {
  recipientName: string;
  recipientPhone: string;
}

/** Chọn số điện thoại VN hợp lệ (ưu tiên user, sau đó địa chỉ đã lưu) cho vị trí hiện tại. */
export const resolveRecipientContact = (
  user: { phone?: string; fullName?: string } | null | undefined,
  addresses: Address[],
): RecipientContact | null => {
  const addressWithValidPhone = addresses.find((address) =>
    isValidVietnamesePhone(address.recipientPhone || ""),
  );
  const phoneCandidates = [user?.phone, addressWithValidPhone?.recipientPhone];
  const recipientPhone = normalizeVietnamesePhone(
    phoneCandidates.find((phone) => isValidVietnamesePhone(phone || "")) || "",
  );

  if (!recipientPhone) return null;

  return {
    recipientPhone,
    recipientName: user?.fullName || addressWithValidPhone?.recipientName || "Khách hàng",
  };
};
