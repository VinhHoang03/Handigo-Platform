import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CircleAlert, FileSpreadsheet, ImagePlus, Mic, ScanLine, TriangleAlert, UploadCloud, X } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { ReliableImage } from '@/components/common/ReliableImage';
import { getErrorMessage } from '@/utils/apiError';
import { providerOrderApi } from '../api/providerOrder.api';
import type {
  CreateQuotationPayload,
  QuotationDetail,
  QuotationRelevanceEvaluation,
  QuotationRelevanceResult,
} from '../types/providerOrder.types';
import { formatMoney } from '../utils/providerOrder.utils';
import { getDirectRepairPayment } from '@/utils/quotationPayment';
import { QuotationItemRow } from './orders/QuotationItemRow';
import { QuotationNotesFields } from './orders/QuotationNotesFields';
import type { QuotationFormItem } from './orders/quotationForm.types';
import { QuotationAgentPanel } from './orders/QuotationAgentPanel';
import type { QuotationAgentResult, QuotationHistoryItem, QuotationFields } from '../types/quotationAgent.types';

const emptyItem: QuotationFields = {
  title: '',
  description: '',
  itemType: 'labor',
  quantity: 1,
  unitPrice: 0,
  note: '',
};

const MAX_QUOTATION_ITEMS = 100;
const newItem = (): QuotationFormItem => ({ ...emptyItem, rowId: crypto.randomUUID() });
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
  depositAmount?: number;
  appliedDepositAmount?: number;
  defaultDurationMinutes?: number;
  orderId: string;
  serviceName: string;
  initialQuotation?: QuotationDetail | null;
  onSubmit: (payload: CreateQuotationPayload) => Promise<boolean>;
  onDiscard?: () => void;
  onCancel: () => void;
  busy?: boolean;
}

const isBlockedEvaluation = (evaluation: QuotationRelevanceEvaluation) =>
  evaluation.level === 'irrelevant' &&
  evaluation.confidence >= BLOCK_CONFIDENCE;

export function RepairQuotationForm({
  appliedDepositAmount = 0,
  depositAmount = appliedDepositAmount,
  orderId,
  serviceName,
  onSubmit,
  onCancel,
  busy,
  defaultDurationMinutes,
  initialQuotation,
  onDiscard,
}: RepairQuotationFormProps) {
  const [inspectionNote, setInspectionNote] = useState(initialQuotation?.quotation.inspectionNote ?? '');
  const estimatedDurationMinutes = initialQuotation?.quotation.estimatedDurationMinutes ?? defaultDurationMinutes ?? 60;
  const [recommendation, setRecommendation] = useState(initialQuotation?.quotation.recommendation ?? '');
  const discountAmount = initialQuotation?.quotation.discountAmount ?? 0;
  const [items, setItems] = useState<QuotationFormItem[]>(() => initialQuotation?.items.length
    ? initialQuotation.items.map((item) => ({
      ...newItem(), ...item, description: item.description ?? '', note: item.note ?? '',
      manualFields: Object.keys(emptyItem) as Array<keyof QuotationFields>,
    })) : [newItem()]);
  const revision = useRef(0);
  const [formRevision, setFormRevision] = useState(0);
  const [agentBusy, setAgentBusy] = useState(false);
  const [undo, setUndo] = useState<{ items: QuotationFormItem[]; inspectionNote: string; recommendation: string; revision: number } | null>(null);
  const [itemCountToAdd, setItemCountToAdd] = useState("1");
  const [scanOpen, setScanOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [, setScanImageError] = useToastFeedback<string | null>(null, "error");
  const [relevance, setRelevance] = useState<QuotationRelevanceResult | null>(null);
  const [isValidatingRelevance, setIsValidatingRelevance] = useState(false);
  const [, setError] = useToastFeedback<string | null>(null, "error");
  const [discardOpen, setDiscardOpen] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const finalAmount = Math.max(subtotal - discountAmount, 0);
  const inputBusy = Boolean(busy || agentBusy || isScanningImage || isValidatingRelevance);
  const selectedImageUrl = useMemo(() => selectedFile?.type.startsWith('image/')
    ? URL.createObjectURL(selectedFile) : null, [selectedFile]);

  useEffect(() => () => {
    if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
  }, [selectedImageUrl]);

  useEffect(() => {
    if (!formRevision) return;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [formRevision]);

  const changed = () => { revision.current++; setFormRevision(revision.current); setUndo(null); setRelevance(null); };

  const applyAgent = (result: QuotationAgentResult) => {
    if (result.revision !== revision.current || busy || isValidatingRelevance || isScanningImage) return false;
    const previous = { items, inspectionNote, recommendation };
    const next = [...items];
    for (const update of result.updates) {
      const target = update.rowId ? next.findIndex((item) => item.rowId === update.rowId) : next.findIndex(isEmptyItem);
      const source = result.sources.find((item) => item.id === update.historyId);
      if (target >= 0) next[target] = { ...next[target], ...update.fields,
        historySource: update.fields.unitPrice !== undefined ? source : next[target].historySource };
      else if (!update.rowId) next.push({ ...newItem(), ...update.fields, historySource: source });
      else return false;
    }
    if (next.length > MAX_QUOTATION_ITEMS) return false;
    changed(); setItems(next);
    if (result.inspectionNote !== undefined) setInspectionNote(result.inspectionNote);
    if (result.recommendation !== undefined) setRecommendation(result.recommendation);
    setUndo({ ...previous, revision: revision.current });
    return true;
  };

  const applyHistory = (rowId: string, expectedTitle: string, source: QuotationHistoryItem) => {
    const item = items.find((entry) => entry.rowId === rowId);
    if (!item || item.title !== expectedTitle || busy || isValidatingRelevance) return;
    const manual = new Set(item.manualFields);
    const patch: Partial<QuotationFormItem> = { title: source.title };
    if (!manual.has('itemType')) patch.itemType = source.itemType;
    if (!item.description && !manual.has('description')) patch.description = source.description;
    if (!item.unitPrice && !manual.has('unitPrice')) { patch.unitPrice = source.unitPrice; patch.historySource = source; }
    changed();
    setItems((current) => current.map((entry) => entry.rowId === rowId ? { ...entry, ...patch } : entry));
  };

  const updateItem = (index: number, patch: Partial<QuotationFormItem>) => {
    changed();
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, ...patch, manualFields: [...new Set([...(item.manualFields || []), ...Object.keys(patch) as Array<keyof QuotationFields>])] };
      if (patch.title !== undefined && patch.title !== item.title && item.historySource) {
        if (!item.manualFields?.includes('unitPrice')) next.unitPrice = 0;
        if (!item.manualFields?.includes('description')) next.description = '';
        next.historySource = undefined;
      }
      if (patch.unitPrice !== undefined) next.historySource = undefined;
      return next;
    }));
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

    changed();
    setItems((current) => [
      ...current,
      ...Array.from({ length: count }, newItem),
    ]);
    setRelevance(null);
    setError(null);
  };

  const handleSelectFile = (file: File | undefined) => {
    setScanImageError(null);
    setScanStatus('');
    setScanComplete(false);
    setSelectedFile(null);
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
    setSelectedFile(file);
  };

  const handleScanQuotationFile = async () => {
    if (!selectedFile || inputBusy || scanComplete) return;
    try {
      setIsScanningImage(true);
      setError(null);
      setScanImageError(null);
      const scanRevision = revision.current;
      const scanResult = await providerOrderApi.scanQuotationItems(orderId, selectedFile);
      if (scanRevision !== revision.current) {
        setScanImageError('Form đã thay đổi trong lúc đọc tệp. Vui lòng thử lại để giữ thông tin mới.');
        return;
      }
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

      changed();
      setItems([
        ...currentItems,
        ...acceptedItems.map((item) => ({
          ...item,
          rowId: crypto.randomUUID(),
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
      setScanComplete(true);
      setScanStatus(`Đã thêm ${acceptedItems.length} hạng mục vào danh sách.`);
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
    if (agentBusy || isScanningImage || busy || isValidatingRelevance) return;
    const validItems = items.filter((item) => !isEmptyItem(item));
    if (validItems.some((item) => !item.title.trim() || item.unitPrice <= 0)) {
      setError('Vui lòng hoàn tất tên và đơn giá của tất cả hạng mục, hoặc xóa dòng chưa dùng.');
      return;
    }
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
    if (!Number.isInteger(estimatedDurationMinutes) || estimatedDurationMinutes < 1 || estimatedDurationMinutes > 1440) {
      setError('Thời gian sửa chữa phải là số nguyên từ 1 đến 1440 phút.');
      return;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal) {
      setError('Giảm giá phải từ 0 đến tổng thành tiền các hạng mục.');
      return;
    }
    if (finalAmount <= depositAmount) {
      setError(`Tổng báo giá phải lớn hơn tiền cọc ${formatMoney(depositAmount)}.`);
      return;
    }
    const payload: CreateQuotationPayload = {
      estimatedDurationMinutes,
      inspectionNote: inspectionNote.trim() || undefined,
      recommendation: recommendation.trim() || undefined,
      discountAmount,
      attachments: initialQuotation?.quotation.attachments,
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
          `Không thể lưu báo giá: có ${blockedCount} hạng mục không phù hợp với dịch vụ ${result.serviceName}.`,
        );
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

  const relevanceIssues =
    relevance?.evaluations.filter((evaluation) => evaluation.level !== 'relevant') || [];

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="h-full space-y-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-md"
    >
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
        <h3 className="font-headline-md text-on-surface">{initialQuotation ? 'Chỉnh sửa báo giá' : 'Lập báo giá sửa chữa'}</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          Ghi nhận kết quả khảo sát cho dịch vụ <strong>{serviceName}</strong>.
        </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <button type="button" disabled={inputBusy} onClick={() => setScanOpen(true)}
            className="btn-secondary flex min-h-11 items-center justify-center gap-2 px-3 text-sm">
            <ImagePlus size={18} aria-hidden="true" />Thêm ảnh
          </button>
          <button type="button" disabled={inputBusy} onClick={() => setVoiceOpen(true)}
            className="btn-secondary flex min-h-11 items-center justify-center gap-2 px-3 text-sm">
            <Mic size={18} aria-hidden="true" />Giọng nói AI
          </button>
        </div>
      </div>


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

      {undo && <button type="button" className="text-sm text-primary underline" disabled={agentBusy || busy || isValidatingRelevance}
        onClick={() => { if (revision.current !== undo.revision) return; const previous = undo; changed(); setItems(previous.items); setInspectionNote(previous.inspectionNote); setRecommendation(previous.recommendation); }}>Hoàn tác lần điền AI vừa rồi</button>}

      <fieldset disabled={busy || isValidatingRelevance} className="space-y-md">
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
              disabled={items.length >= MAX_QUOTATION_ITEMS || isScanningImage || agentBusy}
              onClick={handleAddItems}
              className="h-10 rounded-xl border border-primary/30 px-3 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Thêm hạng mục
            </button>
          </div>
        </div>

        <div className="hidden grid-cols-12 gap-sm px-sm text-xs font-medium text-on-surface-variant md:grid">
          <span className="md:col-span-4">Tên hạng mục</span>
          <span className="md:col-span-2">Loại</span>
          <span className="md:col-span-1">Số lượng</span>
          <span className="md:col-span-2">Đơn giá (VND)</span>
          <span className="md:col-span-3">Thành tiền</span>
        </div>

        {items.map((item, index) => (
          <QuotationItemRow
            key={item.rowId}
            orderId={orderId}
            item={item}
            removable={items.length > 1}
            maxTitleLength={MAX_ITEM_TITLE_LENGTH}
            onUpdate={(patch) => updateItem(index, patch)}
            onHistory={(source, expectedTitle) => applyHistory(item.rowId, expectedTitle, source)}
            onRemove={() => {
              changed();
              setItems((current) => current.filter((_, i) => i !== index));
              setRelevance(null);
            }}
          />
        ))}
      </div>

      <QuotationNotesFields
        inspectionNote={inspectionNote}
        recommendation={recommendation}
        maxLength={MAX_GENERAL_TEXT_LENGTH}
        onInspectionNoteChange={(value) => { changed(); setInspectionNote(value); }}
        onRecommendationChange={(value) => { changed(); setRecommendation(value); }}
      />
      </fieldset>
      <dl className="space-y-3 rounded-2xl bg-primary/5 p-md">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-on-surface-variant">Tổng báo giá</dt>
          <dd className="text-right font-semibold tabular-nums text-on-surface">{formatMoney(finalAmount)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-on-surface-variant">Khách đã thanh toán</dt>
          <dd className="text-right text-sm tabular-nums text-on-surface-variant">−{formatMoney(appliedDepositAmount)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-primary/15 pt-3">
          <dt className="font-semibold text-primary">Cần thu từ khách</dt>
          <dd className="text-right text-headline-md font-bold tabular-nums text-primary">{formatMoney(getDirectRepairPayment(finalAmount, appliedDepositAmount))}</dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 items-center gap-sm sm:flex sm:flex-wrap">
        <button type="button" onClick={onCancel} disabled={inputBusy}
          className="col-start-1 row-start-2 flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-error hover:bg-error/5 disabled:opacity-50 sm:mr-auto">
          <TriangleAlert size={18} aria-hidden="true" />Hủy đơn
        </button>
        {onDiscard && <button type="button" disabled={inputBusy}
          onClick={() => formRevision ? setDiscardOpen(true) : onDiscard()} className="btn-secondary col-start-2 row-start-2">Đóng chỉnh sửa</button>}
        <button
          type="submit"
          disabled={inputBusy}
          className="btn-primary col-span-2 row-start-1 w-full sm:w-auto"
        >
          {isValidatingRelevance
            ? 'Đang kiểm tra hạng mục…'
            : busy
              ? 'Đang lưu báo giá…'
              : initialQuotation ? 'Lưu thay đổi' : 'Lưu báo giá'}
        </button>
      </div>

      <Modal open={scanOpen} title="Thêm hạng mục từ ảnh" size="sm"
        onClose={() => { if (!isScanningImage) setScanOpen(false); }}
        closeOnEsc={!isScanningImage} closeOnOverlayClick={!isScanningImage}>
          <section aria-label="Nhập hạng mục từ ảnh hoặc Excel" className="space-y-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
            <label className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest px-4 py-5 text-center text-primary focus-within:ring-2 focus-within:ring-primary ${inputBusy ? 'opacity-50' : 'cursor-pointer hover:border-primary'}`}>
              <UploadCloud size={24} aria-hidden="true" />
              <span className="text-sm font-semibold">{selectedFile ? 'Chọn ảnh hoặc tệp Excel khác' : 'Chọn ảnh hoặc tệp Excel'}</span>
              <input type="file" name="quotationFile" aria-label="Chọn ảnh hoặc tệp Excel" className="sr-only"
                accept="image/jpeg,image/png,image/webp,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={inputBusy} onChange={(event) => { handleSelectFile(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
            <p className="text-xs text-on-surface-variant">JPG, PNG, WebP hoặc Excel .xlsx, tối đa 10 MB.</p>
            {selectedFile && <div className="flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
              {selectedImageUrl ? <ReliableImage src={selectedImageUrl} alt="Ảnh hạng mục đã chọn" className="h-20 w-20 shrink-0 rounded-lg object-contain" /> : <FileSpreadsheet size={32} aria-hidden="true" className="shrink-0 text-primary" />}
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-on-surface">{selectedFile.name}</p><p className="text-xs text-on-surface-variant">{Math.ceil(selectedFile.size / 1024)} KB</p></div>
              <button type="button" aria-label="Bỏ tệp đã chọn" disabled={inputBusy} onClick={() => handleSelectFile(undefined)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"><X size={18} aria-hidden="true" /></button>
            </div>}
            {scanStatus && <p role="status" className="text-sm text-on-surface-variant">{scanStatus}</p>}
            <button type="button" disabled={!selectedFile || inputBusy || scanComplete || items.length >= MAX_QUOTATION_ITEMS}
              onClick={() => void handleScanQuotationFile()} className="btn-secondary flex min-h-11 w-full items-center justify-center gap-2 sm:w-auto">
              <ScanLine size={18} aria-hidden="true" />{isScanningImage ? 'Đang đọc hạng mục…' : scanComplete ? 'Đã thêm hạng mục' : 'Đọc hạng mục'}
            </button>
            {isScanningImage && <p role="status" className="text-sm text-on-surface-variant">Đang đọc tệp và kiểm tra hạng mục.</p>}
          </section>
        <div className="mt-4 flex justify-end">
          <button type="button" disabled={isScanningImage} onClick={() => setScanOpen(false)} className="btn-secondary">Trở về báo giá</button>
        </div>
      </Modal>
          <QuotationAgentPanel orderId={orderId} key={orderId} open={voiceOpen} onClose={() => setVoiceOpen(false)} disabled={busy || isScanningImage || isValidatingRelevance}
            snapshot={{ revision: formRevision, inspectionNote, recommendation,
              items: items.map(({ rowId, title, description, itemType, quantity, unitPrice, note }) => ({ rowId, title, description, itemType, quantity, unitPrice, note })) }}
            onApply={applyAgent} onBusyChange={setAgentBusy} />

      <Modal open={discardOpen} title="Bỏ thay đổi chưa lưu?" onClose={() => setDiscardOpen(false)}>
        <p className="text-sm text-on-surface-variant">Bản báo giá đã lưu vẫn được giữ lại. Các thay đổi đang nhập sẽ bị bỏ.</p>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" onClick={() => setDiscardOpen(false)} className="btn-secondary">Tiếp tục chỉnh sửa</button>
          <button type="button" onClick={onDiscard} className="btn-primary">Bỏ thay đổi</button>
        </div>
      </Modal>
    </form>
    </>
  );
}
