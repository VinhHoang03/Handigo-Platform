import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { CaseRow } from "./case-detail.types";
import { CASE_STATUS_LABELS } from "./case-status.constants";
import { CaseTitle } from "@/features/case-management/components/CaseTitle";

export const caseDateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

/** Cột dùng chung cho cả 3 tab (khiếu nại/báo cáo/vi phạm) — trang tự thêm cột "Thao tác". */
export const caseTableColumns: Array<DataTableColumn<CaseRow>> = [
  {
    key: "case",
    header: "Hồ sơ",
    className: "w-[40%] min-w-[360px]",
    render: (item) => {
      const title = "violationType" in item ? item.violationType : item.title;
      return (
        <>
          <p className="max-w-xl whitespace-normal break-normal font-bold leading-6"><CaseTitle title={title} /></p>
          <p className="mt-1 text-xs text-on-surface-variant">#{item._id.slice(-8).toUpperCase()}</p>
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
        ? item.sourceType
        : "complainantId" in item
          ? item.complainantId.fullName
          : item.reporterId.fullName,
  },
  {
    key: "status",
    header: "Trạng thái",
    className: "whitespace-nowrap",
    render: (item) => (
      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
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
];
