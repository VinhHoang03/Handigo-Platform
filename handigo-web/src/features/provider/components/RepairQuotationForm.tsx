import { useState, type FormEvent } from "react";
import type {
  CreateQuotationPayload,
  QuotationItem,
} from "../types/providerOrder.types";
import { providerOrderApi } from "../api/providerOrder.api";
import { formatMoney } from "../utils/providerOrder.utils";
import { getErrorMessage } from "@/utils/apiError";

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

const MAX_QUOTATION_ITEMS = 100;
const MAX_ITEMS_PER_ADD = 20;
const MAX_SCAN_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_GENERAL_TEXT_LENGTH = 2000;
const MAX_ITEM_TITLE_LENGTH = 200;
const MAX_ITEM_NOTE_LENGTH = 1000;

const isEmptyItem = (item: QuotationFormItem) =>
  !item.title &&
  !item.description &&
  !item.note &&
  item.quantity === 1 &&
  item.unitPrice === 0;

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
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [itemCountToAdd, setItemCountToAdd] = useState("1");
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const updateItem = (index: number, patch: Partial<QuotationFormItem>) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const handleAddItems = () => {
    const count = Number(itemCountToAdd);
    if (!Number.isInteger(count) || count < 1 || count > MAX_ITEMS_PER_ADD) {
      setError("Số hạng mục thêm mỗi lần phải là số nguyên từ 1 đến 20.");
      return;
    }
    if (items.length + count > MAX_QUOTATION_ITEMS) {
      setError(`Bạn chỉ có thể thêm tối đa ${MAX_QUOTATION_ITEMS - items.length} hạng mục nữa.`);
      return;
    }

    setItems((current) => [
      ...current,
      ...Array.from({ length: count }, () => ({ ...emptyItem })),
    ]);
    setError(null);
  };

  const handleScanQuotationImage = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WebP.");
      return;
    }
    if (file.size > MAX_SCAN_IMAGE_SIZE) {
      setError("Ảnh hạng mục không được vượt quá 10 MB.");
      return;
    }

    try {
      setIsScanningImage(true);
      setError(null);
      const scannedItems = await providerOrderApi.scanQuotationItems(file);
      const shouldReplaceEmptyItem = items.length === 1 && isEmptyItem(items[0]);
      const currentItems = shouldReplaceEmptyItem ? [] : items;
      const availableSlots = MAX_QUOTATION_ITEMS - currentItems.length;
      const acceptedItems = scannedItems.slice(0, availableSlots);

      if (!acceptedItems.length) {
        setError("Form báo giá đã đạt giới hạn 100 hạng mục.");
        return;
      }

      setItems([
        ...currentItems,
        ...acceptedItems.map((item) => ({
          ...item,
          description: item.description || "",
          note: item.note || "",
        })),
      ]);
      if (acceptedItems.length < scannedItems.length) {
        setError(
          `Đã thêm ${acceptedItems.length} hạng mục. Các hạng mục còn lại vượt quá giới hạn 100 dòng.`,
        );
      }
    } catch (scanError) {
      setError(
        getErrorMessage(
          scanError,
          "Không thể quét ảnh hạng mục. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsScanningImage(false);
    }
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
    if (
      inspectionNote.trim().length > MAX_GENERAL_TEXT_LENGTH ||
      recommendation.trim().length > MAX_GENERAL_TEXT_LENGTH
    ) {
      setError('Ghi chú khảo sát và đề xuất không được vượt quá 2000 ký tự.');
      return;
    }
    if (
      validItems.some(
        (item) =>
          item.title.trim().length > MAX_ITEM_TITLE_LENGTH ||
          item.description.trim().length > MAX_GENERAL_TEXT_LENGTH ||
          item.note.trim().length > MAX_ITEM_NOTE_LENGTH ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 1000 ||
          !Number.isFinite(item.unitPrice) ||
          item.unitPrice < 0,
      )
    ) {
      setError('Có hạng mục báo giá chưa hợp lệ.');
      return;
    }
    setError(null);
    await onSubmit({
      inspectionNote: inspectionNote.trim() || undefined,
      recommendation: recommendation.trim() || undefined,
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
            maxLength={MAX_GENERAL_TEXT_LENGTH}
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
            maxLength={MAX_GENERAL_TEXT_LENGTH}
            rows={4}
            className="w-full rounded-2xl border border-outline-variant bg-white px-4 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
            placeholder="Phương án sửa chữa đề xuất..."
          />
        </label>
      </div>

      <div className="space-y-sm">
        <div className="flex flex-wrap items-end justify-between gap-sm">
          <div>
            <h4 className="font-label-md text-on-surface">Hạng mục báo giá</h4>
            <p className="mt-1 text-xs text-on-surface-variant">
              Thành tiền từng hạng mục = Số lượng × Đơn giá.
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-end gap-2">
            <label className="space-y-1">
              <span className="block text-xs text-on-surface-variant">
                Số hạng mục muốn thêm
              </span>
              <input
                type="number"
                min={1}
                max={MAX_ITEMS_PER_ADD}
                step={1}
                value={itemCountToAdd}
                onChange={(event) => setItemCountToAdd(event.target.value)}
                className="h-10 w-24 rounded-xl border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </label>
            <button
              type="button"
              disabled={items.length >= MAX_QUOTATION_ITEMS || isScanningImage}
              onClick={handleAddItems}
              className="h-10 rounded-xl border border-primary/30 px-3 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Thêm hạng mục
            </button>
            <label
              className={`flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white transition hover:bg-primary/90 ${
                isScanningImage || items.length >= MAX_QUOTATION_ITEMS
                  ? "pointer-events-none opacity-50"
                  : ""
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${isScanningImage ? "animate-spin" : ""}`}>
                {isScanningImage ? "progress_activity" : "document_scanner"}
              </span>
              {isScanningImage ? "AI đang quét..." : "Quét ảnh hạng mục"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isScanningImage || items.length >= MAX_QUOTATION_ITEMS}
                onChange={(event) => {
                  void handleScanQuotationImage(event.target.files?.[0]);
                  event.target.value = "";
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <p className="rounded-xl bg-primary/5 px-3 py-2 text-xs text-on-surface-variant">
          Có thể chụp giấy viết tay, bảng Excel hoặc bảng báo giá rõ nét. AI sẽ đọc tên hạng mục,
          loại, số lượng và đơn giá; bạn nên kiểm tra lại trước khi gửi khách hàng.
        </p>

        <div className="hidden grid-cols-12 gap-sm px-sm text-xs font-medium text-on-surface-variant md:grid">
          <span className="md:col-span-4">Tên hạng mục</span>
          <span className="md:col-span-2">Loại</span>
          <span className="md:col-span-1">Số lượng</span>
          <span className="md:col-span-2">Đơn giá (VND)</span>
          <span className="md:col-span-2">Thành tiền</span>
        </div>

        {items.map((item, index) => (
          <div
            key={`quotation-item-${index}`}
            className="grid min-w-0 gap-sm rounded-2xl border border-outline-variant/30 bg-white p-sm md:grid-cols-12"
          >
            <input
              value={item.title}
              maxLength={MAX_ITEM_TITLE_LENGTH}
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
              max={1000}
              step={1}
              value={item.quantity}
              onChange={(event) =>
                updateItem(index, { quantity: Number(event.target.value) })
              }
              aria-label="Số lượng"
              placeholder="Số lượng"
              className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-1"
            />
            <input
              type="number"
              min={0}
              step={1}
              value={item.unitPrice}
              onChange={(event) => {
                const unitPrice = event.target.value.replace(/^0+(?=\d)/, "");
                updateItem(index, { unitPrice: Number(unitPrice) });
              }}
              aria-label="Đơn giá (VND)"
              placeholder="Đơn giá (VND)"
              className="min-w-0 rounded-xl border border-outline-variant px-3 py-2 md:col-span-2"
            />
            <div className="flex items-center justify-between gap-2 md:col-span-2">
              <div>
                <span className="block text-xs text-on-surface-variant md:hidden">Thành tiền</span>
                <span className="text-sm font-semibold text-primary">
                  {formatMoney(item.quantity * item.unitPrice)}
                </span>
              </div>
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

      <div className="flex justify-end">
        <div className="rounded-2xl bg-primary/5 px-md py-sm text-right">
          <p className="text-xs text-on-surface-variant">Tổng báo giá (tổng thành tiền các hạng mục)</p>
          <p className="text-headline-md font-bold text-primary">
            {formatMoney(subtotal)}
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
