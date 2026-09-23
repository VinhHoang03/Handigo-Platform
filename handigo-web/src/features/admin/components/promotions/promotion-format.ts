import type {
  Voucher,
  VoucherDiscountType,
  VoucherPayload,
  VoucherStatus,
} from "../../types/voucher.types";

export type VoucherFormState = {
  code: string;
  name: string;
  description: string;
  discountType: VoucherDiscountType;
  discountValue: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  usageLimit: string;
  startAt: string;
  endAt: string;
  status: Exclude<VoucherStatus, "EXPIRED">;
};

export const emptyForm: VoucherFormState = {
  code: "",
  name: "",
  description: "",
  discountType: "PERCENT",
  discountValue: "",
  maxDiscountAmount: "",
  minOrderAmount: "",
  usageLimit: "",
  startAt: "",
  endAt: "",
  status: "ACTIVE",
};

export const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
export const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});

export const getErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error
    ? error.message
    : "Có lỗi xảy ra, vui lòng thử lại.";
};

export const toLocalInputValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export const toIsoString = (value: string) => new Date(value).toISOString();
export const optionalNumber = (value: string) =>
  value.trim() === "" ? null : Number(value);

export const statusValue = (voucher: Voucher) => {
  if (voucher.status === "ACTIVE") return "active";
  if (voucher.status === "EXPIRED") return "expired";
  return "inactive";
};

export const discountText = (voucher: Voucher) =>
  voucher.discountType === "PERCENT"
    ? `${voucher.discountValue}%${voucher.maxDiscountAmount ? ` tối đa ${money.format(voucher.maxDiscountAmount)}` : ""}`
    : money.format(voucher.discountValue);

export const buildPayload = (form: VoucherFormState): VoucherPayload => ({
  code: form.code.trim().toUpperCase(),
  name: form.name.trim() || form.code.trim().toUpperCase(),
  description: form.description.trim() || null,
  discountType: form.discountType,
  discountValue: Number(form.discountValue),
  maxDiscountAmount: optionalNumber(form.maxDiscountAmount),
  minOrderAmount: optionalNumber(form.minOrderAmount),
  usageLimit: optionalNumber(form.usageLimit),
  startAt: toIsoString(form.startAt),
  endAt: toIsoString(form.endAt),
  status: form.status,
});
