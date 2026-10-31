import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { CaseRow } from "./case-detail.types";
import { CASE_STATUS_LABELS, VIOLATION_SOURCE_LABELS, getCaseStatusClasses } from "./case-status.constants";
import { CaseTitle } from "@/features/case-management/components/CaseTitle";
import { ticketAge } from "../support/support.constants";

export const caseDateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

/** Các cột thông tin dùng chung cho báo cáo và vi phạm. */
export const caseTableColumns: Array<DataTableColumn<CaseRow>> = [
  {
    key: "code",
    header: "Mã hồ sơ",
    className: "whitespace-nowrap text-sm tabular-nums",
    render: (item) => `#${item._id.slice(-8).toUpperCase()}`,
  },
  {
    key: "case",
    header: "Hồ sơ",
    className: "w-[40%] min-w-[360px]",
    render: (item) => {
      const title = "violationType" in item ? item.violationType : item.title;
      return (
        <>
          <p className="max-w-xl whitespace-normal break-normal font-bold leading-6"><CaseTitle title={title} /></p>
        </>
      );
    },
  },
  {
    key: "source",
    header: "Nguồn / đối tượng",
    className: "min-w-[200px] whitespace-normal break-words text-sm",
    render: (item) =>
      "violationType" in item
        ? (item.sourceType ? VIOLATION_SOURCE_LABELS[item.sourceType] : "Admin xử lý trực tiếp")
        : item.reporterId.fullName,
  },
  {
    key: "status",
    header: "Trạng thái",
    className: "whitespace-nowrap",
    render: (item) => (
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getCaseStatusClasses(item.status)}`}>
        {CASE_STATUS_LABELS[item.status] || item.status}
      </span>
    ),
  },
  {
    key: "createdAt",
    header: "Ngày tạo",
    className: "whitespace-nowrap text-sm tabular-nums",
    render: (item) => caseDateTime.format(new Date(item.createdAt)),
  },
  {
    key: "waitingTime",
    header: "Thời gian chờ",
    className: "whitespace-nowrap text-sm tabular-nums",
    render: (item) => ticketAge(item.createdAt),
  },
];
