import { Clock3 } from "lucide-react";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { AdminSupportTicket } from "../../types/adminSupport.types";
import { SupportPriorityBadge, SupportStatusBadge } from "./SupportBadges";
import { CATEGORY_LABELS, ticketAge } from "./support.constants";

/** Các cột thông tin của bảng yêu cầu hỗ trợ. */
export const supportTableColumns: Array<DataTableColumn<AdminSupportTicket>> = [
  {
    key: "ticket",
    header: "Yêu cầu",
    className: "min-w-[280px] w-[30%]",
    render: (ticket) => (
      <div className="w-full max-w-[384px] whitespace-normal [overflow-wrap:anywhere]">
        <p className="font-bold">{ticket.subject}</p>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          {CATEGORY_LABELS[ticket.category]} · #{ticket._id.slice(-8).toUpperCase()}
        </p>
      </div>
    ),
  },
  {
    key: "requester",
    header: "Người gửi",
    className: "min-w-[220px]",
    render: (ticket) => (
      <div className="w-full max-w-[320px] whitespace-normal [overflow-wrap:anywhere]">
        <p className="font-semibold">{(ticket.requesterId?.fullName || "Người dùng không còn khả dụng")}</p>
        <p className="text-xs text-on-surface-variant">{ticket.requesterId?.email}</p>
      </div>
    ),
  },
  {
    key: "priority",
    header: "Ưu tiên",
    className: "min-w-[100px] whitespace-nowrap",
    render: (ticket) => <SupportPriorityBadge priority={ticket.priority} />,
  },
  {
    key: "status",
    header: "Trạng thái",
    className: "min-w-[150px] whitespace-nowrap",
    render: (ticket) => <SupportStatusBadge status={ticket.status} />,
  },
  {
    key: "assignee",
    header: "Phụ trách",
    className: "min-w-[170px] text-sm [overflow-wrap:anywhere]",
    render: (ticket) => ticket.assignedAdminId?.fullName || <span className="text-error">Chưa phân công</span>,
  },
  {
    key: "age",
    header: "Thời gian chờ",
    className: "min-w-[150px] whitespace-nowrap text-sm tabular-nums",
    render: (ticket) => (
      <>
        <Clock3 size={15} className="mr-1 inline" />
        {ticketAge(ticket.createdAt)}
      </>
    ),
  },
];
