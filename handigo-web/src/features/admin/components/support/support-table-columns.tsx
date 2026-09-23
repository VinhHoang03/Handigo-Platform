import { Clock3 } from "lucide-react";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { AdminSupportTicket } from "../../types/adminSupport.types";
import { SupportPriorityBadge, SupportStatusBadge } from "./SupportBadges";
import { CATEGORY_LABELS, ticketAge } from "./support.constants";

/** Cột dùng chung cho bảng yêu cầu hỗ trợ — trang tự thêm cột "Thao tác". */
export const supportTableColumns: Array<DataTableColumn<AdminSupportTicket>> = [
  {
    key: "ticket",
    header: "Yêu cầu",
    className: "max-w-sm",
    render: (ticket) => (
      <>
        <p className="truncate font-bold">{ticket.subject}</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          {CATEGORY_LABELS[ticket.category]} · #{ticket._id.slice(-8).toUpperCase()}
        </p>
      </>
    ),
  },
  {
    key: "requester",
    header: "Người gửi",
    render: (ticket) => (
      <>
        <p className="font-semibold">{ticket.requesterId.fullName}</p>
        <p className="text-xs text-on-surface-variant">{ticket.requesterId.email}</p>
      </>
    ),
  },
  {
    key: "priority",
    header: "Ưu tiên",
    render: (ticket) => <SupportPriorityBadge priority={ticket.priority} />,
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (ticket) => <SupportStatusBadge status={ticket.status} />,
  },
  {
    key: "assignee",
    header: "Phụ trách",
    className: "text-sm",
    render: (ticket) => ticket.assignedAdminId?.fullName || <span className="text-error">Chưa phân công</span>,
  },
  {
    key: "age",
    header: "Thời gian chờ",
    className: "text-sm tabular-nums",
    render: (ticket) => (
      <>
        <Clock3 size={15} className="mr-1 inline" />
        {ticketAge(ticket.createdAt)}
      </>
    ),
  },
];
