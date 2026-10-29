import {
  AdminPageTitle,
  AdminRefreshButton,
} from "@/features/admin/components/shared/AdminPageHeader";
import { useCallback, useRef, useState } from "react";
import { AsyncState } from "@/components/common/AsyncState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useToast } from '@/components/common/Toast';
import { getErrorMessage } from '@/utils/apiError';
import { DashboardShell } from "@/components/common/DashboardShell";
import { Pagination } from "@/components/common/Pagination";
import { AdminFeedbackFilters } from "@/features/admin/components/feedback/AdminFeedbackFilters";
import { AdminFeedbackList } from "@/features/admin/components/feedback/AdminFeedbackList";
import { AdminFeedbackStats } from "@/features/admin/components/feedback/AdminFeedbackStats";
import { AdminFeedbackDetailModal } from "@/features/admin/components/feedback/AdminFeedbackDetailModal";
import { useFeedbackList } from "../hooks/useFeedback";
import { feedbackService } from "../services/feedback.service";
import type { Feedback, FeedbackList, FeedbackQuery } from "../types/feedback.types";

export default function AdminFeedbackPage() {
  const { addToast } = useToast();
  const [query, setQuery] = useState<FeedbackQuery>({ page: 1, limit: 30, ratingBelow: 4 });
  const autoFilter = useRef(true);
  const handleLoaded = useCallback((value: FeedbackList) => {
    if (autoFilter.current && query.ratingBelow === 4 && value.pagination.total === 0) {
      setQuery((current) => ({ ...current, ratingBelow: undefined, page: 1 }));
    }
    autoFilter.current = false;
  }, [query.ratingBelow]);
  const changeQuery = (value: FeedbackQuery) => { autoFilter.current = false; setQuery(value); };
  const { result, loading, error, load } = useFeedbackList("admin", query, handleLoaded);
  const [target, setTarget] = useState<Feedback | null>(null);
  const [detail, setDetail] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!target) return;
    try {
      setBusy(true);
      await feedbackService.setVisibility(target._id, !target.isVisible);
      addToast(target.isVisible ? 'Đã ẩn đánh giá.' : 'Đã hiển thị đánh giá.', 'success');
      setTarget(null);
      await load();
    } catch (cause) {
      addToast(getErrorMessage(cause, 'Không thể cập nhật đánh giá.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <header className="admin-page-header">
        <AdminPageTitle title="Kiểm duyệt đánh giá" />
        <AdminRefreshButton onRefresh={() => void load()} loading={loading} />
      </header>
      <AdminFeedbackStats stats={result?.moderationStats} query={query} onChange={changeQuery} />
      <AdminFeedbackFilters query={query} onChange={changeQuery} stats={result?.moderationStats} />

      <AsyncState
        loading={loading}
        error={error}
        empty={!result?.items.length}
        emptyMessage="Chưa có đánh giá phù hợp với bộ lọc."
        onRetry={load}
      >
        <AdminFeedbackList items={result?.items || []} onToggle={setTarget} onOpen={setDetail} />
      </AsyncState>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface px-4 py-2">
      <p className="text-xs text-on-surface-variant" aria-live="polite">Hiển thị {result?.items.length || 0} / {result?.pagination.total || 0} đánh giá</p>
      <Pagination
        page={query.page || 1}
        totalPages={result?.pagination.totalPages || 1}
        onChange={(page) => setQuery({ ...query, page })}
      />
      </div>
      {detail && <AdminFeedbackDetailModal key={detail._id} feedbackId={detail._id} onClose={() => setDetail(null)} />}
      <ConfirmDialog
        open={Boolean(target)}
        title={target?.isVisible ? "Ẩn đánh giá" : "Hiện đánh giá"}
        message="Thao tác này sẽ cập nhật điểm tổng hợp của thợ."
        busy={busy}
        onCancel={() => setTarget(null)}
        onConfirm={confirm}
      />
    </DashboardShell>
  );
}
