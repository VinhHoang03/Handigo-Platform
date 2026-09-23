import { AsyncState } from "@/components/common/AsyncState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DashboardShell } from "@/components/common/DashboardShell";
import { DataTable } from "@/components/common/dashboard/DataTable";
import { TableSkeleton } from "@/components/common/dashboard/TableSkeleton";
import { TableToolbar } from "@/components/common/dashboard/TableToolbar";
import { NewsFormModal } from "../components/news/NewsFormModal";
import { NewsStatsBar } from "../components/news/NewsStatsBar";
import { newsTableColumns } from "../components/news/news-table-columns";
import { useAdminNewsController } from "../components/news/useAdminNewsController";
import { Pencil, Plus, Trash2 } from "lucide-react";

export default function AdminNewsPage() {
  const news = useAdminNewsController();

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Quản lý tin tức</h1>
            <p className="mt-1 text-on-surface-variant">Soạn thảo, lưu nháp và xuất bản nội dung trên trang tin tức.</p>
          </div>
          <button
            type="button"
            onClick={news.openCreate}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-on-primary shadow-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
          >
            <Plus aria-hidden="true" size={20} className="block leading-none" />
            Đăng bài mới
          </button>
        </header>

        {(news.error || news.notice) && (
          <p aria-live="polite" className={`rounded-xl px-4 py-3 ${news.error ? "bg-error/10 text-error" : "bg-success-container text-on-success-container"}`}>
            {news.error || news.notice}
          </p>
        )}

        <NewsStatsBar {...news.stats} />

        <TableToolbar
          search={{
            value: news.search,
            onChange: news.setSearch,
            placeholder: "Tìm theo tiêu đề hoặc danh mục…",
          }}
          filters={
            <select
              value={news.status}
              onChange={(event) => news.setStatus(event.target.value as typeof news.status)}
              className="min-h-11 rounded-xl border border-outline-variant bg-surface-container-lowest px-3"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản</option>
              <option value="draft">Bản nháp</option>
            </select>
          }
        />

        <AsyncState loading={news.isLoading} skeleton={<TableSkeleton columns={newsTableColumns.length + 1} />}>
          <DataTable
            columns={[
              ...newsTableColumns,
              {
                key: "actions",
                header: "Thao tác",
                className: "text-right",
                render: (article) => (
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => news.openEdit(article)} aria-label={`Sửa ${article.title}`} className="grid h-10 w-10 place-items-center rounded-lg text-primary hover:bg-primary/10">
                      <Pencil aria-hidden="true" size={20} className="block leading-none" />
                    </button>
                    <button type="button" onClick={() => news.setDeleteTarget(article)} aria-label={`Xóa ${article.title}`} className="grid h-10 w-10 place-items-center rounded-lg text-error hover:bg-error/10">
                      <Trash2 aria-hidden="true" size={20} className="block leading-none" />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={news.visibleArticles}
            rowKey={(article) => article.id}
            emptyState={<div className="p-10 text-center text-on-surface-variant">Chưa có bài viết phù hợp.</div>}
            minWidthClassName="min-w-[760px]"
          />
        </AsyncState>
      </div>

      <NewsFormModal
        open={news.isFormOpen}
        editing={news.editing}
        form={news.form}
        onFormChange={news.setForm}
        isSaving={news.isSaving}
        isUploading={news.isUploading}
        error={news.error}
        onSubmit={news.save}
        onClose={() => news.setIsFormOpen(false)}
        onUploadCover={(file) => void news.uploadCover(file)}
      />

      <ConfirmDialog
        open={Boolean(news.deleteTarget)}
        title="Xóa bài viết"
        message={`Bạn chắc chắn muốn xóa bài "${news.deleteTarget?.title ?? ""}"? Bài viết sẽ không còn hiển thị công khai.`}
        variant="danger"
        busy={news.isSaving}
        onCancel={() => news.setDeleteTarget(null)}
        onConfirm={() => void news.confirmDelete()}
      />
    </DashboardShell>
  );
}
