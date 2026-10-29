import { useCallback, useState } from "react";
import { useToast } from "@/components/common/Toast";
import { caseManagementApi } from "../api/caseManagement.api";
import type { CaseListQuery } from "../types/caseManagement.types";
import { useSupportData } from "./useSupportData";

export type SupportRole = "CUSTOMER" | "PROVIDER";

export function useSupportTickets() {
  const { addToast } = useToast();
  const [ticketQuery, setTicketQuery] = useState<CaseListQuery>({ page: 1, limit: 10 });
  const fetchList = useCallback(async () => {
    const result = await caseManagementApi.tickets(ticketQuery);
    const lastPage = Math.max(1, result.pagination.totalPages);
    if ((ticketQuery.page || 1) > lastPage) {
      setTicketQuery(current => current === ticketQuery ? { ...current, page: lastPage } : current);
    }
    return result;
  }, [ticketQuery]);
  const support = useSupportData(fetchList, caseManagementApi.ticket);
  const selected = support.selected;
  const run = async (work: () => ReturnType<typeof caseManagementApi.ticket>) => {
    const succeeded = await support.runAction(work);
    if (succeeded) addToast("Đã cập nhật yêu cầu hỗ trợ.", "success");
    return succeeded;
  };
  return {
    ...support, ticketQuery, setTicketQuery,
    tickets: support.data?.items ?? [], totalPages: support.data?.pagination.totalPages || 1,
    selected: selected ? { kind: "ticket" as const, item: selected } : null,
    loadTickets: support.load, openTicketDetail: support.open, closeDetail: support.close,
    cancelTicket: () => selected ? run(() => caseManagementApi.cancelTicket(selected._id)) : Promise.resolve(false),
    respondTicket: (message: string, files: File[]) => selected ? run(async () => {
      const attachments = files.length ? await caseManagementApi.uploadImages(files) : undefined;
      return caseManagementApi.respondTicket(selected._id, message, attachments);
    }) : Promise.resolve(false),
  };
}
