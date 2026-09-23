import { useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import type { Order } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";
import { caseManagementApi } from "../api/caseManagement.api";
import type {
  CreateReportPayload,
  ReportType,
  SupportTicketCategory,
  SupportTicketPriority,
} from "../types/caseManagement.types";
import { EvidenceImagePicker } from "./EvidenceImagePicker";
import { ReportExtraFields } from "./ReportExtraFields";
import { TicketExtraFields } from "./TicketExtraFields";

export type CreateCaseKind = "complaint" | "ticket" | "report";

interface CreateCaseModalProps {
  open: boolean;
  kind: CreateCaseKind;
  role: "CUSTOMER" | "PROVIDER";
  orders: Order[];
  initialOrderId?: string;
  onClose: () => void;
  onCreated: () => void;
}

const KIND_TITLES: Record<CreateCaseKind, string> = {
  complaint: "Tạo khiếu nại",
  ticket: "Tạo yêu cầu hỗ trợ",
  report: "Gửi báo cáo",
};

const getCustomerId = (order: Order) =>
  typeof order.customerId === "string" ? order.customerId : order.customerId._id;

export function CreateCaseModal({
  open,
  kind,
  role,
  orders,
  initialOrderId,
  onClose,
  onCreated,
}: CreateCaseModalProps) {
  const [orderId, setOrderId] = useState(initialOrderId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("ORDER");
  const [priority, setPriority] = useState<SupportTicketPriority>("MEDIUM");
  const [reportType, setReportType] = useState<ReportType>("user_behavior");
  const [reportTarget, setReportTarget] = useState<"participant" | "order">(
    initialOrderId ? "order" : "participant",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const availableOrders = useMemo(
    () => (kind === "complaint" ? orders.filter((order) => order.status === "completed") : orders),
    [kind, orders],
  );

  const selectedOrder = orders.find((order) => order._id === orderId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((kind === "complaint" || kind === "report") && !selectedOrder) {
      setError("Vui lòng chọn đơn dịch vụ liên quan.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      const uploadedFiles = files.length ? await caseManagementApi.uploadImages(files) : [];
      const imageUrls = uploadedFiles.map((file) => file.url);

      if (kind === "complaint") {
        await caseManagementApi.createComplaint({
          orderId,
          title: title.trim(),
          description: description.trim(),
          evidenceImages: imageUrls,
        });
      } else if (kind === "ticket") {
        await caseManagementApi.createTicket({
          orderId: orderId || undefined,
          category,
          priority,
          subject: title.trim(),
          description: description.trim(),
          attachments: uploadedFiles,
        });
      } else if (selectedOrder) {
        const payload: CreateReportPayload = {
          targetType: reportTarget === "order" ? "order" : role === "CUSTOMER" ? "provider" : "user",
          reportType,
          title: title.trim(),
          description: description.trim(),
          evidenceImages: imageUrls,
          evidenceFiles: uploadedFiles,
        };

        if (reportTarget === "order") {
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
        <label className="block text-sm font-semibold">
          Đơn dịch vụ {kind === "ticket" ? "(không bắt buộc)" : ""}
          <select
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            required={kind !== "ticket"}
            disabled={busy}
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
        {kind === "ticket" && (
          <TicketExtraFields
            category={category}
            priority={priority}
            disabled={busy}
            onCategoryChange={setCategory}
            onPriorityChange={setPriority}
          />
        )}
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
          Nội dung chi tiết
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={3000} rows={6} required disabled={busy} className="mt-2 w-full resize-y rounded-xl border border-outline-variant bg-surface p-3" />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold">Ảnh bằng chứng</p>
          <EvidenceImagePicker files={files} onChange={setFiles} disabled={busy} />
        </div>

        {error && <p className="rounded-xl bg-error/10 p-3 text-sm font-semibold text-error">{error}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Quay lại</button>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Đang gửi..." : "Gửi yêu cầu"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
