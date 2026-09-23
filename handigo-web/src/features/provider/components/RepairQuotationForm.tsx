import { useState, type FormEvent } from 'react';
import { CircleAlert, ScanLine, TriangleAlert, UploadCloud } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { getErrorMessage } from '@/utils/apiError';
import { providerOrderApi } from '../api/providerOrder.api';
import type {
  CreateQuotationPayload,
  QuotationRelevanceEvaluation,
  QuotationRelevanceResult,
} from '../types/providerOrder.types';
import { formatMoney } from '../utils/providerOrder.utils';
import { QuotationItemRow } from './orders/QuotationItemRow';
import { QuotationNotesFields } from './orders/QuotationNotesFields';
import type { QuotationFormItem } from './orders/quotationForm.types';

const emptyItem: QuotationFormItem = {
  title: '',
  description: '',
  itemType: 'labor',
  quantity: 1,
  unitPrice: 0,
  note: '',
};

const MAX_QUOTATION_ITEMS = 100;
const MAX_ITEMS_PER_ADD = 20;
const MAX_SCAN_FILE_SIZE = 10 * 1024 * 1024;
const MAX_GENERAL_TEXT_LENGTH = 2000;
const MAX_ITEM_TITLE_LENGTH = 200;
const MAX_ITEM_NOTE_LENGTH = 1000;
const BLOCK_CONFIDENCE = 0.85;

const isEmptyItem = (item: QuotationFormItem) =>
  !item.title &&
  !item.description &&
  !item.note &&
  item.quantity === 1 &&
  item.unitPrice === 0;

interface RepairQuotationFormProps {
  orderId: string;
  serviceName: string;
  onSubmit: (payload: CreateQuotationPayload) => Promise<void>;
  onCancel: () => void;
  busy?: boolean;
}

const isBlockedEvaluation = (evaluation: QuotationRelevanceEvaluation) =>
  evaluation.level === 'irrelevant' &&
  evaluation.confidence >= BLOCK_CONFIDENCE;

export function RepairQuotationForm({
  orderId,
  serviceName,
  onSubmit,
  onCancel,
  busy,
}: RepairQuotationFormProps) {
  const [inspectionNote, setInspectionNote] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [itemCountToAdd, setItemCountToAdd] = useState("1");
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanImageError, setScanImageError] = useState<string | null>(null);
  const [relevance, setRelevance] = useState<QuotationRelevanceResult | null>(null);
  const [isValidatingRelevance, setIsValidatingRelevance] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<CreateQuotationPayload | null>(null);
  const [isRelevanceConfirmOpen, setIsRelevanceConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const updateItem = (index: number, patch: Partial<QuotationFormItem>) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
    setRelevance(null);
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
    setRelevance(null);
    setError(null);
  };

  const handleScanQuotationFile = async (file: File | undefined) => {
    if (!file) return;
    const isSupportedFile =
      ["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.name.toLowerCase().endsWith(".xlsx");
    if (!isSupportedFile) {
      setScanImageError("Chỉ chấp nhận ảnh JPG, JPEG, PNG, WebP hoặc tệp Excel .xlsx.");
      return;
    }
    if (file.size > MAX_SCAN_FILE_SIZE) {
      setScanImageError("Tệp hạng mục không được vượt quá 10 MB.");
      return;
    }

    try {
      setIsScanningImage(true);
      setError(null);
      setScanImageError(null);
      const scanResult = await providerOrderApi.scanQuotationItems(orderId, file);
      const blockedIndexes = new Set(
        scanResult.relevance.evaluations
          .filter(isBlockedEvaluation)
          .map((evaluation) => evaluation.index),
      );
      const scannedItems = scanResult.items.filter(
        (_, index) => !blockedIndexes.has(index),
      );
      const shouldReplaceEmptyItem = items.length === 1 && isEmptyItem(items[0]);
      const currentItems = shouldReplaceEmptyItem ? [] : items;
      const availableSlots = MAX_QUOTATION_ITEMS - currentItems.length;
      const acceptedItems = scannedItems.slice(0, availableSlots);

      if (!acceptedItems.length) {
        setRelevance(scanResult.relevance);
        setScanImageError(
          blockedIndexes.size
            ? `Không thể thêm ${blockedIndexes.size} hạng mục vì không phù hợp với dịch vụ ${scanResult.relevance.serviceName}.`
            : "Form báo giá đã đạt giới hạn 100 hạng mục.",
        );
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
      setRelevance(scanResult.relevance);
      if (acceptedItems.length < scannedItems.length) {
        setError(
          `Đã thêm ${acceptedItems.length} hạng mục. Các hạng mục còn lại vượt quá giới hạn 100 dòng.`,
        );
      }
      if (blockedIndexes.size) {
        setError(
          `Đã bỏ qua ${blockedIndexes.size} hạng mục không phù hợp với dịch vụ ${scanResult.relevance.serviceName}.`,
        );
      }
      setIsScanModalOpen(false);
    } catch (scanError) {
      setScanImageError(
        getErrorMessage(
          scanError,
          "Không thể đọc tệp hạng mục. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsScanningImage(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validItems = items.filter((item) => item.title.trim() && item.unitPrice > 0);
    if (!validItems.length) {
      setError('Vui lòng thêm ít nhất một hạng mục báo giá hợp lệ.');
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
    const payload: CreateQuotationPayload = {
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
    };

    try {
      setError(null);
      setIsValidatingRelevance(true);
      const result = await providerOrderApi.validateQuotationItems(
        orderId,
        payload.items,
      );
      setRelevance(result);

      if (result.status === 'blocked') {
        const blockedCount = result.evaluations.filter(isBlockedEvaluation).length;
        setError(
          `Không thể gửi báo giá: có ${blockedCount} hạng mục không phù hợp với dịch vụ ${result.serviceName}.`,
        );
        return;
      }

      if (result.status === 'warning') {
        setPendingPayload(payload);
        setIsRelevanceConfirmOpen(true);
        return;
      }

      await onSubmit(payload);
    } catch (validationError) {
      setError(
        getErrorMessage(
          validationError,
          'Không thể kiểm tra độ phù hợp của báo giá. Vui lòng thử lại.',
        ),
      );
    } finally {
      setIsValidatingRelevance(false);
    }
  };

  const confirmWarningAndSubmit = async () => {
    if (!pendingPayload) return;
    setIsRelevanceConfirmOpen(false);
    setError(null);
    await onSubmit({ ...pendingPayload, relevanceConfirmed: true });
    setPendingPayload(null);
  };

  const relevanceIssues =
    relevance?.evaluations.filter((evaluation) => evaluation.level !== 'relevant') || [];

  return (
    <form
      onSubmit={handleSubmit}
      className="h-full space-y-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md"
    >
      <div>
        <h3 className="font-headline-md text-on-surface">Tạo báo giá sửa chữa</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Ghi nhận kết quả khảo sát cho dịch vụ <strong>{serviceName}</strong>.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl bg-error/10 px-md py-sm text-sm text-error">
          {error}
        </div>
      )}

      {relevance && relevanceIssues.length > 0 && (
        <div
          aria-live="polite"
          className={`rounded-2xl border px-md py-sm ${
            relevance.status === 'blocked'
              ? 'border-error/30 bg-error/5 text-error'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2">
            <CircleAlert aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">
                {relevance.status === 'blocked'
                  ? 'Có hạng mục không phù hợp và đã bị chặn'
                  : 'Có hạng mục cần bạn kiểm tra lại'}
              </p>
              {relevance.systemWarning && (
                <p className="mt-1 text-sm">{relevance.systemWarning}</p>
              )}
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {relevanceIssues.slice(0, 5).map((issue) => (
                  <li key={`${issue.index}-${issue.title}`}>
                    <strong>{issue.title}</strong>: {issue.reason}
                  </li>
                ))}
              </ul>
              {relevanceIssues.length > 5 && (
                <p className="mt-2 text-xs">
                  Và {relevanceIssues.length - 5} hạng mục khác cần kiểm tra.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <QuotationNotesFields
        inspectionNote={inspectionNote}
        recommendation={recommendation}
        maxLength={MAX_GENERAL_TEXT_LENGTH}
        onInspectionNoteChange={setInspectionNote}
        onRecommendationChange={setRecommendation}
      />

      <div className="space-y-sm">
        <div className="flex flex-wrap items-end justify-between gap-sm">
          <div>
            <h4 className="font-label-md text-on-surface">Hạng mục báo giá</h4>
            <p className="mt-1 text-xs text-on-surface-variant">Thành tiền từng hạng mục = Số lượng × Đơn giá.</p>
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
            <button
              type="button"
              disabled={isScanningImage || items.length >= MAX_QUOTATION_ITEMS}
              onClick={() => {
                setScanImageError(null);
                setIsScanModalOpen(true);
              }}
              className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Nhập hạng mục từ ảnh hoặc tệp Excel"
              title="Nhập từ ảnh hoặc Excel"
            >
              <ScanLine aria-hidden="true" size={20} />
            </button>
          </div>
        </div>

        <div className="hidden grid-cols-12 gap-sm px-sm text-xs font-medium text-on-surface-variant md:grid">
          <span className="md:col-span-4">Tên hạng mục</span>
          <span className="md:col-span-2">Loại</span>
          <span className="md:col-span-1">Số lượng</span>
          <span className="md:col-span-2">Đơn giá (VND)</span>
          <span className="md:col-span-2">Thành tiền</span>
        </div>

        {items.map((item, index) => (
          <QuotationItemRow
            key={`quotation-item-${index}`}
            item={item}
            removable={items.length > 1}
            maxTitleLength={MAX_ITEM_TITLE_LENGTH}
            onUpdate={(patch) => updateItem(index, patch)}
            onRemove={() => {
              setItems((current) => current.filter((_, i) => i !== index));
              setRelevance(null);
            }}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <div className="rounded-2xl bg-primary/5 px-md py-sm text-right">
          <p className="text-xs text-on-surface-variant">Tổng báo giá (tổng thành tiền các hạng mục)</p>
          <p className="text-headline-md font-bold tabular-nums text-primary">{formatMoney(subtotal)}</p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-sm border-t border-outline-variant/30 pt-md sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm font-bold text-error transition hover:border-error/50 hover:bg-error/10 active:scale-[0.98] disabled:opacity-50"
        >
          <TriangleAlert aria-hidden="true" size={20} />
          Hủy đơn hàng
        </button>
        <button
          type="submit"
          disabled={busy || isValidatingRelevance}
          className="btn-primary w-full sm:w-auto"
        >
          {isValidatingRelevance
            ? 'Đang kiểm tra hạng mục…'
            : busy
              ? 'Đang gửi báo giá…'
              : 'Gửi báo giá cho khách hàng'}
        </button>
      </div>

      <Modal
        open={isScanModalOpen}
        title="Nhập hạng mục từ ảnh hoặc Excel"
        onClose={() => {
          if (!isScanningImage) setIsScanModalOpen(false);
        }}
        size="sm"
        closeOnEsc={!isScanningImage}
        closeOnOverlayClick={!isScanningImage}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm leading-6 text-on-surface-variant">
              Tải lên ảnh hoặc tệp Excel có danh sách hạng mục cần báo giá. Hệ thống
              sẽ đọc dữ liệu và đối chiếu với dịch vụ <strong>{serviceName}</strong> trước
              khi thêm vào biểu mẫu.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-on-surface-variant">
              <li>Ảnh giấy viết tay, bảng Excel hoặc bảng báo giá.</li>
              <li>Chụp thẳng, đủ sáng, rõ chữ và không bị cắt mất nội dung.</li>
              <li>
                Tệp Excel cần có cột “Tên hạng mục” hoặc “Hạng mục”; có thể kèm
                “Loại”, “Số lượng”, “Đơn giá”, “Mô tả” và “Ghi chú”.
              </li>
              <li>Hỗ trợ JPG, JPEG, PNG, WebP, XLSX; dung lượng tối đa 10 MB.</li>
            </ul>
          </div>

          {scanImageError && (
            <div
              role="alert"
              className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error"
            >
              {scanImageError}
            </div>
          )}

          <label
            className={`flex min-h-52 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-8 text-center transition ${
              isScanningImage
                ? "cursor-wait opacity-70"
                : "cursor-pointer hover:border-primary hover:bg-primary/10"
            }`}
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <UploadCloud
                aria-hidden="true"
                size={28}
                className={isScanningImage ? "animate-pulse motion-reduce:animate-none" : ""}
              />
            </span>
            <span className="mt-4 font-semibold text-on-surface" aria-live="polite">
              {isScanningImage ? "Đang đọc dữ liệu…" : "Nhấp để chọn ảnh hoặc tệp Excel"}
            </span>
            <span className="mt-1 text-xs text-on-surface-variant">
              {isScanningImage
                ? "Vui lòng chờ trong giây lát."
                : "Chọn một tệp từ thiết bị của bạn."}
            </span>
            <input
              type="file"
              name="quotationFile"
              accept="image/jpeg,image/png,image/webp,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isScanningImage}
              onChange={(event) => {
                void handleScanQuotationFile(event.target.files?.[0]);
                event.target.value = "";
              }}
              className="sr-only"
            />
          </label>

          <p className="rounded-xl bg-surface-container-low px-4 py-3 text-xs leading-5 text-on-surface-variant">
            Sau khi quét, hãy kiểm tra lại thông tin và đơn giá trước khi gửi báo giá
            cho khách hàng.
          </p>
        </div>
      </Modal>

      <Modal
        open={isRelevanceConfirmOpen}
        title="Xác nhận hạng mục cần kiểm tra"
        onClose={() => {
          if (!busy) setIsRelevanceConfirmOpen(false);
        }}
        size="sm"
        closeOnEsc={!busy}
        closeOnOverlayClick={!busy}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-start gap-3">
              <CircleAlert aria-hidden="true" size={22} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  Một số hạng mục chưa thể xác định chắc chắn có phù hợp với dịch vụ
                  {` ${relevance?.serviceName || serviceName}`}.
                </p>
                <p className="mt-1 text-sm">
                  Hãy kiểm tra kỹ trước khi xác nhận gửi cho khách hàng.
                </p>
              </div>
            </div>
          </div>

          <ul className="max-h-64 list-disc space-y-2 overflow-y-auto pl-5 text-sm text-on-surface-variant">
            {relevanceIssues.map((issue) => (
              <li key={`confirm-${issue.index}-${issue.title}`}>
                <strong className="text-on-surface">{issue.title}</strong>: {issue.reason}
              </li>
            ))}
          </ul>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => setIsRelevanceConfirmOpen(false)}
              className="h-11 rounded-xl border border-outline-variant px-4 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50"
            >
              Quay lại chỉnh sửa
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmWarningAndSubmit()}
              className="btn-primary h-11 px-4"
            >
              {busy ? 'Đang gửi báo giá…' : 'Tôi đã kiểm tra, tiếp tục gửi'}
            </button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
