import {
  AdminPageTitle,
  AdminRefreshButton,
} from "@/features/admin/components/shared/AdminPageHeader";
import { useState } from "react";
import { BarChart3 } from 'lucide-react';
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
import { AdminFeedbackModerationReport } from '@/features/admin/components/feedback/AdminFeedbackModerationReport';
import { useFeedbackList } from "../hooks/useFeedback";
import { feedbackService } from "../services/feedback.service";
import type { Feedback, FeedbackQuery } from "../types/feedback.types";

export default function AdminFeedbackPage() {
  const { addToast } = useToast();
  const [query, setQuery] = useState<FeedbackQuery>({ page: 1, limit: 30 });
  const { result, loading, error, load } = useFeedbackList("admin", query);
  const [target, setTarget] = useState<Pick<Feedback, '_id' | 'isVisible' | 'updatedAt'> | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportRevision, setReportRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!target) return;
    try {
      setBusy(true);
      await feedbackService.setVisibility(target._id, !target.isVisible, target.updatedAt);
      addToast(target.isVisible ? 'Đã ẩn đánh giá.' : 'Đã hiển thị đánh giá.', 'success');
      setTarget(null);
      setReportRevision(value => value + 1);
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setReportOpen(true)}>
            <BarChart3 size={18} aria-hidden="true" /> Báo cáo
          </button>
          <AdminRefreshButton onRefresh={() => void load()} loading={loading} />
        </div>
      </header>
      <AdminFeedbackStats stats={result?.moderationStats} query={query} onChange={setQuery} />
      <AdminFeedbackFilters query={query} onChange={setQuery} stats={result?.moderationStats} />

      <AsyncState
        loading={loading}
        error={error}
        empty={!result?.items.length}
        emptyMessage="Chưa có đánh giá phù hợp với bộ lọc."
        onRetry={load}
      >
        <AdminFeedbackList items={result?.items || []} onToggle={setTarget} onOpen={feedback => setDetailId(feedback._id)} />
      </AsyncState>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface px-4 py-2">
      <p className="text-xs text-on-surface-variant" aria-live="polite">Hiển thị {result?.items.length || 0} / {result?.pagination.total || 0} đánh giá</p>
      <Pagination
        page={query.page || 1}
        totalPages={result?.pagination.totalPages || 1}
        onChange={(page) => setQuery({ ...query, page })}
      />
      </div>
      {reportOpen && <AdminFeedbackModerationReport onClose={() => setReportOpen(false)} revision={reportRevision}
        onOpenFeedback={setDetailId} onShowFeedback={(id, updatedAt) => setTarget({ _id: id, isVisible: false, updatedAt })}
        onViewHidden={() => { setQuery({ page: 1, limit: 30, isVisible: false }); setReportOpen(false); }} />}
      {detailId && <AdminFeedbackDetailModal key={detailId} feedbackId={detailId} onClose={() => setDetailId(null)} />}
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
