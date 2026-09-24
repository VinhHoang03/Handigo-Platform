import type { DataTableColumn } from "@/components/common/dashboard/DataTable";
import type { NewsArticleRecord } from "@/features/content/api/news.api";
import { NEWS_STATUS_LABELS, newsStatusChipClass } from "./news.constants";

/** Cột dùng chung cho bảng bài viết — trang tự thêm cột "Thao tác". */
export const newsTableColumns: Array<DataTableColumn<NewsArticleRecord>> = [
  {
    key: "article",
    header: "Bài viết",
    render: (article) => (
      <div className="flex items-center gap-3">
        <img
          src={article.coverImage}
          alt=""
          width="80"
          height="56"
          loading="lazy"
          className="h-14 w-20 rounded-lg object-cover"
        />
        <div className="min-w-0">
          <p className="max-w-md truncate font-bold">{article.title}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{article.authorName}</p>
        </div>
      </div>
    ),
  },
  {
    key: "category",
    header: "Danh mục",
    className: "text-sm",
    render: (article) => article.category,
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (article) => (
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${newsStatusChipClass(article.status)}`}>
        {NEWS_STATUS_LABELS[article.status]}
      </span>
    ),
  },
  {
    key: "updatedAt",
    header: "Cập nhật",
    className: "text-sm tabular-nums",
    render: (article) => new Date(article.updatedAt).toLocaleDateString("vi-VN"),
  },
];
