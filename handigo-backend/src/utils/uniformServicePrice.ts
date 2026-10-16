interface PricingOption {
  groupId?: unknown;
  price: number;
  optionType: string;
  description?: string | null;
  selectionGroup?: string | null;
  selectionMode: string;
  allowsQuantity: boolean;
  isRequired?: boolean;
}

const normalize = (value?: string | null) => value?.trim().toLocaleLowerCase("vi") || "";

// Chỉ gộp biến thể kỹ thuật tương đương; không suy ra cùng phạm vi từ giá của gói/diện tích/số phòng.
export function getUniformServicePrice(serviceType: string, options: PricingOption[], fixedPrice?: number | null) {
  if (serviceType !== "fixed_price") return null;
  if (options.some(option => option.groupId)) return null;
  if (options.length === 0 && typeof fixedPrice === "number" && Number.isFinite(fixedPrice) && fixedPrice > 0) {
    return { unitPrice: fixedPrice, allowsQuantity: true };
  }
  const base = options.filter((option) => option.optionType !== "add_on");
  if (base.length < 2) return null;
  const first = base[0];
  if (first.optionType !== "other" || !Number.isFinite(first.price) || first.price <= 0) return null;
  if (!base.every((option) => option.optionType === "other" && !option.isRequired && option.price === first.price
    && option.allowsQuantity === first.allowsQuantity && option.selectionMode === first.selectionMode
    && normalize(option.selectionGroup) === normalize(first.selectionGroup)
    && normalize(option.description) === normalize(first.description))) return null;
  return { unitPrice: first.price, allowsQuantity: first.allowsQuantity };
}
