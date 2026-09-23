import type { ReportType } from "../types/caseManagement.types";
import { REPORT_TYPES } from "./reportFieldOptions.constants";

interface ReportExtraFieldsProps {
  role: "CUSTOMER" | "PROVIDER";
  reportTarget: "participant" | "order";
  reportType: ReportType;
  disabled: boolean;
  onReportTargetChange: (value: "participant" | "order") => void;
  onReportTypeChange: (value: ReportType) => void;
}

export function ReportExtraFields({
  role,
  reportTarget,
  reportType,
  disabled,
  onReportTargetChange,
  onReportTypeChange,
}: ReportExtraFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">
        Đối tượng báo cáo
        <select
          value={reportTarget}
          onChange={(event) => onReportTargetChange(event.target.value as "participant" | "order")}
          disabled={disabled}
          className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3"
        >
          <option value="participant">{role === "CUSTOMER" ? "Nhà cung cấp của đơn" : "Khách hàng của đơn"}</option>
          <option value="order">Đơn dịch vụ</option>
        </select>
      </label>
      <label className="text-sm font-semibold">
        Loại báo cáo
        <select
          value={reportType}
          onChange={(event) => onReportTypeChange(event.target.value as ReportType)}
          disabled={disabled}
          className="mt-2 min-h-12 w-full rounded-xl border border-outline-variant bg-surface px-3"
        >
          {REPORT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
