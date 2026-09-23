import { useCallback, useEffect, useState } from "react";
import { bookingApi } from "@/features/booking/api/booking.api";
import { caseManagementApi } from "@/features/case-management/api/caseManagement.api";
import type { SelectedCase } from "@/features/case-management/components/CaseDetailModal";
import type {
  CaseListQuery,
  SupportTicket,
} from "@/features/case-management/types/caseManagement.types";
import { providerOrderApi } from "@/features/provider/api/providerOrder.api";
import type { Order } from "@/types/booking";
import { getErrorMessage } from "@/utils/apiError";

export type SupportRole = "CUSTOMER" | "PROVIDER";

/**
 * Toàn bộ state và thao tác của danh sách yêu cầu hỗ trợ: tải danh sách, mở chi
 * tiết, huỷ, phản hồi. Tách khỏi phần hiển thị để component chỉ còn lo bố cục.
 */
export function useSupportTickets(role: SupportRole) {
  const [ticketQuery, setTicketQuery] = useState<CaseListQuery>({
    page: 1,
    limit: 10,
  });
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selected, setSelected] = useState<SelectedCase | null>(null);

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await caseManagementApi.tickets(ticketQuery);
      setTickets(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải yêu cầu hỗ trợ."));
    } finally {
      setLoading(false);
    }
  }, [ticketQuery]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTickets();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadTickets]);

  // Danh sách đơn dùng cho modal tạo yêu cầu — cho phép gắn yêu cầu vào một đơn.
  useEffect(() => {
    const request =
      role === "CUSTOMER"
        ? bookingApi.getMyOrders(1, 50)
        : providerOrderApi.getProviderOrders(1, 50);
    request.then((result) => setOrders(result.items)).catch(() => setOrders([]));
  }, [role]);

  const openTicketDetail = async (ticketId: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      const ticket = await caseManagementApi.ticket(ticketId);
      setSelected({ kind: "ticket", item: ticket });
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Không thể tải chi tiết yêu cầu hỗ trợ."),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSelected = async (
    action: () => Promise<SupportTicket>,
    fallbackMessage: string,
  ) => {
    try {
      setBusy(true);
      setActionError("");
      const ticket = await action();
      setSelected({ kind: "ticket", item: ticket });
      await loadTickets();
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, fallbackMessage));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const cancelTicket = () => {
    if (!selected || selected.kind !== "ticket") return Promise.resolve(false);
    return refreshSelected(
      () => caseManagementApi.cancelTicket(selected.item._id),
      "Không thể hủy yêu cầu hỗ trợ.",
    );
  };

  const respondTicket = (message: string, files: File[]) => {
    if (!selected || selected.kind !== "ticket") return Promise.resolve(false);
    return refreshSelected(async () => {
      const attachments = files.length
        ? await caseManagementApi.uploadImages(files)
        : undefined;
      return caseManagementApi.respondTicket(
        selected.item._id,
        message,
        attachments,
      );
    }, "Không thể gửi phản hồi.");
  };

  const closeDetail = () => {
    setSelected(null);
    setActionError("");
  };

  return {
    ticketQuery,
    setTicketQuery,
    tickets,
    orders,
    totalPages,
    loading,
    detailLoading,
    busy,
    error,
    actionError,
    selected,
    loadTickets,
    openTicketDetail,
    cancelTicket,
    respondTicket,
    closeDetail,
  };
}
