import { StatusBadge } from "@/components/common/StatusBadge";
import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { ServiceSuggestion } from "../types/serviceSuggestion.types";
import {
  formatSuggestionDate,
  getSuggestionName,
  getSuggestionProviderName,
  suggestionTypeLabel,
} from "./service-suggestion.utils";

/** Cột dùng chung cho bảng danh sách — trang tự thêm cột "Thao tác". */
export const serviceSuggestionTableColumns: Array<DataTableColumn<ServiceSuggestion>> = [
  {
    key: "suggestion",
    header: "Đề xuất",
    render: (suggestion) => (
      <>
        <p className="font-bold text-on-surface">{getSuggestionName(suggestion)}</p>
        <p className="mt-1 line-clamp-2 max-w-md text-on-surface-variant">
          {suggestion.description || "Không có mô tả."}
        </p>
      </>
    ),
  },
  {
    key: "provider",
    header: "Provider",
    className: "font-medium",
    render: (suggestion) => getSuggestionProviderName(suggestion),
  },
  {
    key: "type",
    header: "Loại",
    render: (suggestion) => suggestionTypeLabel[suggestion.suggestionType],
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (suggestion) => <StatusBadge value={suggestion.status} />,
  },
  {
    key: "createdAt",
    header: "Ngày gửi",
    className: "text-on-surface-variant tabular-nums",
    render: (suggestion) => formatSuggestionDate(suggestion.createdAt),
  },
];
