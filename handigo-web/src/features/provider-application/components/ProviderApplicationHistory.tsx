import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import { Skeleton } from "@/components/common/Skeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { providerApplicationApi } from "../api/providerApplication.api";
import type { ProviderApplication } from "../types/providerApplication.types";
import { ApplicationDetail } from "./ProviderApplicationDetailView";
import {
  applicationName,
  formatDate,
  getApplicationSummary,
  statusLabel,
} from "./providerApplicationHistoryHelpers";

/** Vài dòng giả lặp lại hình dạng một mục hồ sơ trong khi chờ tải danh sách. */
function ApplicationListSkeleton() {
  return (
    <div className="space-y-2.5" role="status" aria-busy="true" aria-label="Đang tải lịch sử hồ sơ">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ProviderApplicationHistory({
  canEditRejected,
  compact = false,
  hideLastUpdated = false,
  onEdit,
  canEditApplication = () => true,
}: {
  canEditRejected: boolean;
  compact?: boolean;
  hideLastUpdated?: boolean;
  onEdit?: (application: ProviderApplication) => void;
  canEditApplication?: (application: ProviderApplication) => boolean;
}) {
  const [items, setItems] = useState<ProviderApplication[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ProviderApplication | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await providerApplicationApi.history(page, 10);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch {
      setError("Không thể tải lịch sử hồ sơ Provider.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // Tải dữ liệu từ API khi trang danh sách thay đổi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const openDetail = async (application: ProviderApplication) => {
    setSelected(application);
    try {
      setSelected(await providerApplicationApi.detail(application._id));
    } catch {
      // Bản ghi trong danh sách vẫn đủ để hiển thị thông tin cơ bản.
    }
  };

  if (loading) {
    return <ApplicationListSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error/20 bg-error-container/30 p-5 text-center text-on-error-container">
        <p>{error}</p>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => void load()}
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low p-8 text-center text-on-surface-variant">
        Bạn chưa có hồ sơ đăng ký Provider.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`space-y-2.5 ${compact ? "max-w-none" : ""}`}>
        {items.map((application) => {
          const summary = getApplicationSummary(application);
          const submittedText = summary.submitted
            ? formatDate(summary.submitted)
            : "Chưa gửi";

          return (
            <button
              type="button"
              key={application._id}
              className="group block w-full rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 text-left shadow-sm transition hover:border-primary/25 hover:bg-surface-container-low hover:shadow-[0_10px_24px_rgba(19,27,46,0.08)]"
              onClick={() => void openDetail(application)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate pr-2 text-sm font-bold text-on-surface sm:text-[15px]">
                    {applicationName(application)}
                  </p>

                  <div className="mt-2 grid gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
                    <p className="truncate">{summary.typeLabel}</p>
                    <p className="truncate">{summary.serviceNames.length} dịch vụ</p>
                    <p className="truncate">{submittedText}</p>
                  </div>

                  {!hideLastUpdated && (
                    <p className="mt-1 text-[11px] text-on-surface-variant/80">
                      Cập nhật gần nhất: {formatDate(application.updatedAt)}
                    </p>
                  )}
                </div>

                <div className="shrink-0 pt-0.5">
                  <StatusBadge value={statusLabel[application.status]} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title="Chi tiết hồ sơ Provider"
        size="lg"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4">
            {canEditRejected &&
              canEditApplication(selected) &&
              ["draft", "rejected"].includes(selected.status) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn-primary min-h-10 px-4 py-2 text-sm"
                    onClick={() => onEdit?.(selected)}
                  >
                    <Pencil size={16} />{" "}
                    {selected.status === "draft"
                      ? "Tiếp tục hồ sơ"
                      : "Sửa và gửi lại"}
                  </button>
                </div>
              )}

            <ApplicationDetail application={selected} />
          </div>
        )}
      </Modal>
    </div>
  );
}
