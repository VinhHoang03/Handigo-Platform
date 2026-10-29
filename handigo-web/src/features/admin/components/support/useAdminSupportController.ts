import { useToast } from "@/components/common/Toast";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useSupportData } from "@/features/case-management/hooks/useSupportData";
import { getErrorMessage } from "@/utils/apiError";
import { adminSupportApi } from "../../api/adminSupport.api";
import type { AdminUser } from "../../types/admin.types";
import type { AdminSupportTicket, SupportTicketQuery } from "../../types/adminSupport.types";
import { EMPTY_SUMMARY } from "./support.constants";

export function useAdminSupportController() {
  const { addToast } = useToast();
  const revision = useAuthStore(state => state.sessionRevision);
  const [query, setQuery] = useState<SupportTicketQuery>({ page: 1, limit: 10 });
  const [searchInput, setSearchInput] = useState("");
  const [adminState, setAdminState] = useState<{ revision: number; items: AdminUser[]; loading: boolean; error: string }>({ revision, items: [], loading: true, error: "" });
  const [violationTicket, setViolationTicket] = useState<AdminSupportTicket | null>(null);
  const adminSequence = useRef(0);
  const fetchList = useCallback(async () => {
    const result = await adminSupportApi.getTickets(query);
    const lastPage = Math.max(1, result.pagination.totalPages);
    if ((query.page || 1) > lastPage) {
      setQuery(current => current === query ? { ...current, page: lastPage } : current);
    }
    return result;
  }, [query]);
  const support = useSupportData(fetchList, adminSupportApi.getTicket);
  const selected = support.selected;

  const loadAdmins = useCallback(async () => {
    const sequence = ++adminSequence.current;
    setAdminState({ revision, items: [], loading: true, error: "" });
    try {
      const result = await adminSupportApi.getActiveAdmins();
      if (sequence === adminSequence.current && useAuthStore.getState().sessionRevision === revision) {
        setAdminState({ revision, items: result.items, loading: false, error: "" });
      }
    } catch (error) {
      if (sequence === adminSequence.current && useAuthStore.getState().sessionRevision === revision) {
        setAdminState({ revision, items: [], loading: false, error: getErrorMessage(error, "Không thể tải danh sách quản trị viên.") });
      }
    }
  }, [revision]);

  const invalidateAdmins = useCallback(() => { adminSequence.current++; }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadAdmins(), 0);
    return () => { window.clearTimeout(timer); invalidateAdmins(); };
  }, [loadAdmins, invalidateAdmins]);

  const runAction = async (work: () => Promise<AdminSupportTicket>) => {
    const succeeded = await support.runAction(work);
    if (succeeded) addToast("Đã cập nhật yêu cầu hỗ trợ.", "success");
    return succeeded;
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(current => ({ ...current, page: 1, keyword: searchInput.trim() || undefined }));
  };
  const setFilter = <K extends keyof SupportTicketQuery>(key: K, value: SupportTicketQuery[K]) =>
    setQuery(current => ({ ...current, [key]: value || undefined, page: 1 }));

  return {
    ...support, query, setQuery, searchInput, setSearchInput,
    items: support.data?.items ?? [], summary: support.data?.summary ?? EMPTY_SUMMARY,
    totalPages: support.data?.pagination.totalPages || 1,
    admins: adminState.revision === revision ? adminState.items : [],
    adminsLoading: adminState.revision !== revision || adminState.loading,
    adminsError: adminState.revision === revision ? adminState.error : "",
    loadAdmins,
    violationTicket: adminState.revision === revision ? violationTicket : null, setViolationTicket,
    openTicket: support.open, closeDetail: support.close, submitSearch, setFilter,
    onAssign: (adminId: string) => selected ? runAction(() => adminSupportApi.assignTicket(selected._id, adminId)) : Promise.resolve(false),
    onStatusChange: (status: Parameters<typeof adminSupportApi.updateStatus>[1], note?: string) =>
      selected ? runAction(() => adminSupportApi.updateStatus(selected._id, status, note)) : Promise.resolve(false),
    onRespond: (message: string) => selected ? runAction(() => adminSupportApi.respond(selected._id, message)) : Promise.resolve(false),
  };
}
