import { useState, type FormEvent } from "react";
import type {
  CreateQuotationPayload,
  QuotationItem,
} from "../types/providerOrder.types";
import { formatMoney } from "../utils/providerOrder.utils";

type QuotationFormItem = CreateQuotationPayload["items"][number] & {
  description: string;
  note: string;
};

const itemTypes: Array<{ value: QuotationItem["itemType"]; label: string }> = [
  { value: "labor", label: "Nhân công" },
  { value: "material", label: "Vật tư" },
  { value: "replacement_part", label: "Linh kiện thay thế" },
  { value: "other", label: "Khác" },
];

const emptyItem: QuotationFormItem = {
  title: "",
  description: "",
  itemType: "labor",
  quantity: 1,
  unitPrice: 0,
  note: "",
};

interface RepairQuotationFormProps {
  onSubmit: (payload: CreateQuotationPayload) => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

export function RepairQuotationForm({
  onSubmit,
  onCancel,
  busy,
}: RepairQuotationFormProps) {
  const [inspectionNote, setInspectionNote] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const finalAmount = Math.max(subtotal - discountAmount, 0);

  const updateItem = (index: number, patch: Partial<QuotationFormItem>) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validItems = items.filter(
      (item) => item.title.trim() && item.unitPrice > 0,
    );
    if (!validItems.length) {
      setError("Vui lòng thêm ít nhất một hạng mục báo giá hợp lệ.");
      return;
    }

    setError(null);
    await onSubmit({
      inspectionNote: inspectionNote.trim() || undefined,
      recommendation: recommendation.trim() || undefined,
      discountAmount: discountAmount || undefined,
      items: validItems.map((item) => ({
        title: item.title.trim(),
        description: item.description.trim() || undefined,
        itemType: item.itemType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        note: item.note.trim() || undefined,
      })),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card h-full space-y-md rounded-3xl p-md"
    >
      <div>
        <h3 className="font-headline-md text-on-surface">
          Tạo báo giá sửa chữa
        </h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Ghi nhận kết quả khảo sát và các hạng mục cần thực hiện.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-error/10 px-md py-sm text-sm text-error">
          {error}
        </div>
      )}

      <div className="grid gap-md md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-label-sm text-on-surface-variant">
            Ghi chú khảo sát
          </span>
          <textarea
            value={inspectionNote}
            onChange={(event) => setInspectionNote(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Mô tả tình trạng thiết bị sau khi kiểm tra..."
          />
        </label>
        <label className="space-y-2">
          <span className="text-label-sm text-on-surface-variant">
            Đề xuất xử lý
          </span>
          <textarea
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Phương án sửa chữa đề xuất..."
          />
        </label>
      </div>

      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <h4 className="font-label-md text-on-surface">Hạng mục báo giá</h4>
          <button
            type="button"
            onClick={() =>
              setItems((current) => [...current, { ...emptyItem }])
            }
            className="text-sm font-medium text-primary hover:underline"
          >
            + Thêm hạng mục
          </button>
        </div>

        {items.map((item, index) => (
          <div
            key={`quotation-item-${index}`}
            className="grid min-w-0 gap-sm rounded-2xl border border-outline-variant/30 bg-white p-sm md:grid-cols-12"
          >
            <input
              value={item.title}
              onChange={(event) =>
                updateItem(index, { title: event.target.value })
              }
              placeholder="Tên hạng mục"
              className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-4"
            />
            <select
              value={item.itemType}
              onChange={(event) =>
                updateItem(index, {
                  itemType: event.target.value as QuotationItem["itemType"],
                })
              }
              className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-2"
            >
              {itemTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(event) =>
                updateItem(index, { quantity: Number(event.target.value) })
              }
              className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-1"
            />
            <input
              type="number"
              min={0}
              value={item.unitPrice}
              onChange={(event) =>
                updateItem(index, { unitPrice: Number(event.target.value) })
              }
              placeholder="Đơn giá"
              className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-2"
            />
            <div className="flex items-center justify-between gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-primary">
                {formatMoney(item.quantity * item.unitPrice)}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) => current.filter((_, i) => i !== index))
                  }
                  className="text-error"
                >
                  <span className="material-symbols-outlined text-base">
                    delete
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-md md:grid-cols-[1fr_auto] md:items-end">
        <label className="space-y-2">
          <span className="text-label-sm text-on-surface-variant">
            Giảm giá (VND)
          </span>
          <input
            type="number"
            min={0}
            value={discountAmount}
            onChange={(event) => setDiscountAmount(Number(event.target.value))}
            className="w-full rounded-2xl border border-outline-variant px-4 py-3"
          />
        </label>
        <div className="rounded-2xl bg-primary/5 px-md py-sm text-right">
          <p className="text-xs text-on-surface-variant">Tổng báo giá</p>
          <p className="text-headline-md font-bold text-primary">
            {formatMoney(finalAmount)}
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-sm border-t border-outline-variant/30 pt-md sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-bold text-error transition hover:border-error/50 hover:bg-error/10 active:scale-[0.98] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-xl">warning</span>
          Hủy đơn hàng
        </button>
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full sm:w-auto"
        >
          {busy ? "Đang gửi báo giá..." : "Gửi báo giá cho khách hàng"}
        </button>
      </div>
    </form>
  );
}
