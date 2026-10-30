import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import type { Order } from "@/types/booking";
import { useCaseOrders } from "../hooks/useCaseOrders";
import { getErrorMessage } from "@/utils/apiError";
import { caseManagementApi } from "../api/caseManagement.api";
import type {
  CreateReportPayload,
  ReportType,
  SupportTicketCategory,
} from "../types/caseManagement.types";
import { EvidenceImagePicker } from "./EvidenceImagePicker";
import { ReportExtraFields } from "./ReportExtraFields";
import { SupportOrderPicker } from "./SupportOrderPicker";
import { TicketExtraFields } from "./TicketExtraFields";

export type CreateCaseKind = "ticket" | "report";

interface CreateCaseModalProps {
  open: boolean;
  kind: CreateCaseKind;
  role: "CUSTOMER" | "PROVIDER";
  initialOrderId?: string;
  initialReportType?: ReportType;
  onClose: () => void;
  onCreated: () => void;
}

const KIND_TITLES: Record<CreateCaseKind, string> = {
  ticket: "Tạo yêu cầu hỗ trợ",
  report: "Gửi báo cáo",
};

const getCustomerId = (order: Order) =>
  typeof order.customerId === "string" ? order.customerId : order.customerId._id;

export function CreateCaseModal({
  open,
  kind,
  role,
  initialOrderId,
  initialReportType,
  onClose,
  onCreated,
}: CreateCaseModalProps) {
  const { addToast } = useToast();
  const [orderId, setOrderId] = useState(initialOrderId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>(initialOrderId ? "PAYMENT" : "ACCOUNT");
  const showOrders = kind === "report" || category === "PAYMENT";
  const { orders, loading: ordersLoading, error: ordersError, hasMore, loadMore } = useCaseOrders(role, initialOrderId, showOrders);
  const [reportType, setReportType] = useState<ReportType>(initialReportType ?? "user_behavior");
  const [reportTarget, setReportTarget] = useState<"participant" | "order">(
    initialOrderId ? "order" : "participant",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [, setError] = useToastFeedback<string>("", "error");

  const availableOrders = useMemo(
    () => (kind === "report" && reportType === "service_quality" ? orders.filter((order) => order.status === "completed") : orders),
    [kind, orders, reportType],
  );

  const selectedOrder = orders.find((order) => order._id === orderId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (kind === "ticket" && title.trim().length < 5) {
      setError("Tiêu đề cần có ít nhất 5 ký tự.");
      return;
    }
    if (kind === "report" && !selectedOrder) {
      setError("Vui lòng chọn đơn dịch vụ liên quan.");
      return;
    }

    if (kind === "ticket" && category === "PAYMENT" && orderId && !selectedOrder) {
      setError("Không tìm thấy đơn đã chọn. Vui lòng chọn lại đơn dịch vụ.");
      return;
    }

    if (kind === "report" && reportType === "service_quality" && selectedOrder?.status !== "completed") {
      setError("Báo cáo chất lượng dịch vụ chỉ áp dụng cho đơn đã hoàn thành.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      const uploadedFiles = files.length ? await caseManagementApi.uploadImages(files) : [];
      const imageUrls = uploadedFiles.map((file) => file.url);

      if (kind === "ticket") {
        await caseManagementApi.createTicket({
          subject: title.trim(),
          orderId: category === "PAYMENT" ? orderId || undefined : undefined,
          category,
          description: description.trim(),
          attachments: uploadedFiles,
        });
      } else if (selectedOrder) {
        const payload: CreateReportPayload = {
          targetType: reportType === "service_quality" || reportTarget === "order" ? "order" : role === "CUSTOMER" ? "provider" : "user",
          reportType,
          title: title.trim(),
          description: description.trim(),
          evidenceImages: imageUrls,
          evidenceFiles: uploadedFiles,
        };

        if (reportType === "service_quality" || reportTarget === "order") {
          payload.orderId = selectedOrder._id;
        } else if (role === "CUSTOMER") {
          if (!selectedOrder.providerId?._id) {
            throw new Error("Đơn dịch vụ chưa có nhà cung cấp để báo cáo.");
          }
          payload.targetProviderId = selectedOrder.providerId._id;
          payload.orderId = selectedOrder._id;
        } else {
          payload.targetUserId = getCustomerId(selectedOrder);
          payload.orderId = selectedOrder._id;
        }
        await caseManagementApi.createReport(payload);
      }

      onCreated();
      addToast("Đã gửi yêu cầu.", "success");
      onClose();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể gửi yêu cầu. Vui lòng thử lại."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} title={KIND_TITLES[kind]} onClose={onClose} size="lg" closeOnEsc={!busy} closeOnOverlayClick={!busy}>
      <form onSubmit={submit} className="space-y-5">
        {kind === "ticket" && <TicketExtraFields category={category} disabled={busy}
          onCategoryChange={value => { setCategory(value); setOrderId(""); }} />}
        {kind === "ticket" && category === "PAYMENT" && <SupportOrderPicker orders={orders} value={orderId}
          disabled={busy} loading={ordersLoading} error={ordersError} hasMore={hasMore}
          onChange={setOrderId} onLoadMore={() => void loadMore()} />}
        {kind === "report" && <>
        <label className="block text-sm font-semibold">
          Đơn dịch vụ
          <select
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            required
            disabled={busy || ordersLoading}
            className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3"
          >
            <option value="">Chọn đơn dịch vụ</option>
            {availableOrders.map((order) => (
              <option key={order._id} value={order._id}>
                {order.orderCode} · {order.serviceId?.name || "Dịch vụ"} · {order.status}
              </option>
            ))}
          </select>
        </label>
        {ordersLoading && <p role="status" className="text-sm text-on-surface-variant">Đang tải danh sách đơn...</p>}
        {ordersError && <p role="alert" className="text-sm text-error">{ordersError}</p>}
        {(hasMore || ordersError) && <button type="button" onClick={() => void loadMore()} disabled={busy || ordersLoading} className="text-sm font-semibold text-primary">{ordersError ? "Thử tải lại đơn" : "Tải thêm đơn cũ"}</button>}
        {!ordersLoading && !ordersError && !orders.length && <p className="text-sm text-on-surface-variant">Bạn chưa có đơn dịch vụ.</p>}
        </>}
        {kind === "report" && reportType === "service_quality" && <p className="text-sm text-on-surface-variant">Gửi trong vòng 3 ngày từ khi hoàn thành đơn. Mỗi người chỉ được gửi một báo cáo chất lượng cho mỗi đơn.</p>}
        {kind === "report" && (
          <ReportExtraFields
            role={role}
            reportTarget={reportTarget}
            reportType={reportType}
            disabled={busy}
            onReportTargetChange={setReportTarget}
            onReportTypeChange={setReportType}
          />
        )}

        <label className="block text-sm font-semibold">
          Tiêu đề
          <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={5} maxLength={200} required disabled={busy} className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3" />
        </label>
        <label className="block text-sm font-semibold">
          {kind === "ticket" ? "Mô tả" : "Nội dung chi tiết"}
          <textarea name="description" autoComplete="off" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={3000} rows={6} required disabled={busy} className="mt-2 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3" />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold">Ảnh bằng chứng</p>
          <EvidenceImagePicker files={files} onChange={setFiles} disabled={busy} />
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Quay lại</button>
          <button type="submit" disabled={busy || (kind === "report" && ordersLoading)} className="btn-primary">
            {busy ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
