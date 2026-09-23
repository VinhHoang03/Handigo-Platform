import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getErrorMessage } from "@/utils/apiError";
import { adminSupportApi } from "../../api/adminSupport.api";
import type { AdminUser } from "../../types/admin.types";
import type { AdminSupportTicket, SupportTicketQuery, SupportSummary } from "../../types/adminSupport.types";
import { EMPTY_SUMMARY } from "./support.constants";

/**
 * Toàn bộ state + hành động của trang yêu cầu hỗ trợ. Tách khỏi
 * `AdminSupportPage` để trang chính chỉ còn lo bố cục (bảng, modal).
 */
export function useAdminSupportController() {
  const [query, setQuery] = useState<SupportTicketQuery>({ page: 1, limit: 10 });
  const [searchInput, setSearchInput] = useState("");
  const [items, setItems] = useState<AdminSupportTicket[]>([]);
  const [summary, setSummary] = useState<SupportSummary>(EMPTY_SUMMARY);
  const [totalPages, setTotalPages] = useState(1);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null);
  const [violationTicket, setViolationTicket] = useState<AdminSupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await adminSupportApi.getTickets(query);
      setItems(result.items);
      setSummary(result.summary ?? EMPTY_SUMMARY);
      setTotalPages(result.pagination.totalPages || 1);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải yêu cầu hỗ trợ."));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    adminSupportApi
      .getActiveAdmins()
      .then((result) => setAdmins(result.items))
      .catch(() => setAdmins([]));
  }, []);

  const openTicket = async (ticketId: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      setSelected(await adminSupportApi.getTicket(ticketId));
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Không thể tải chi tiết yêu cầu."));
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (action: () => Promise<AdminSupportTicket>) => {
    try {
      setBusy(true);
      setActionError("");
      setSelected(await action());
      await load();
      return true;
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, "Không thể cập nhật yêu cầu hỗ trợ."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery((current) => ({ ...current, page: 1, keyword: searchInput.trim() || undefined }));
  };

  const setFilter = <K extends keyof SupportTicketQuery>(key: K, value: SupportTicketQuery[K]) =>
    setQuery((current) => ({ ...current, [key]: value || undefined, page: 1 }));

  const closeDetail = () => {
    setSelected(null);
    setActionError("");
  };

  return {
    query,
    setQuery,
    searchInput,
    setSearchInput,
    items,
    summary,
    totalPages,
    admins,
    selected,
    violationTicket,
    setViolationTicket,
    loading,
    detailLoading,
    busy,
    error,
    actionError,
    load,
    openTicket,
    closeDetail,
    submitSearch,
    setFilter,
    // An toàn vì các callback này chỉ được truyền cho `TicketDetail`, vốn chỉ
    // render khi `selected` đã tồn tại (xem điều kiện trong AdminSupportPage).
    onAssign: (adminId: string) => runAction(() => adminSupportApi.assignTicket(selected!._id, adminId)),
    onStatusChange: (status: Parameters<typeof adminSupportApi.updateStatus>[1], note?: string) =>
      runAction(() => adminSupportApi.updateStatus(selected!._id, status, note)),
    onRespond: (message: string) => runAction(() => adminSupportApi.respond(selected!._id, message)),
  };
}
