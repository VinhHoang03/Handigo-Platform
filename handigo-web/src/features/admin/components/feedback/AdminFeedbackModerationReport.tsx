import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCheck, CircleAlert, EyeOff, MessageSquare, RefreshCw, ShieldCheck, ShieldX, Sparkles } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { AsyncState } from '@/components/common/AsyncState';
import { FormSelect } from '@/components/common/FormSelect';
import { Pagination } from '@/components/common/Pagination';
import { useToast } from '@/components/common/Toast';
import { getErrorMessage } from '@/utils/apiError';
import { feedbackApi } from '@/features/feedback/api/feedback.api';
import type { ModerationReport, ModerationReportQuery } from '@/features/feedback/types/feedback.types';

interface Props {
  onClose: () => void;
  onOpenFeedback: (id: string) => void;
  onShowFeedback: (id: string, expectedVersion?: string) => void;
  onViewHidden: () => void;
  revision: number;
}

const sourceLabels = { rules: 'Bộ lọc từ ngữ', ai: 'AI', unavailable: 'AI chưa sẵn sàng hoặc lỗi', unknown: 'Dữ liệu cũ' };
const decisionLabels = { allow: 'Cho phép', block: 'Chặn gửi', review: 'Cần kiểm tra' };
const decisionStyles = {
  allow: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  block: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  review: 'bg-amber-50 text-amber-800 ring-amber-600/15',
};

export function AdminFeedbackModerationReport({ onClose, onOpenFeedback, onShowFeedback, onViewHidden, revision }: Props) {
  const { addToast } = useToast();
  const [query, setQuery] = useState<ModerationReportQuery>({ days: '30', view: 'attention', page: 1, limit: 10 });
  const [result, setResult] = useState<ModerationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const reload = () => setRefresh(value => value + 1);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError('');
      try {
        const value = await feedbackApi.moderationReport(query);
        if (active) {
          setResult(value);
          if (query.page > value.pagination.totalPages) setQuery(current => ({ ...current, page: value.pagination.totalPages }));
        }
      } catch (cause) {
        if (active) setError(getErrorMessage(cause, 'Không thể tải báo cáo kiểm duyệt.'));
      } finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [query, refresh, revision]);

  const reviewLegacy = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await feedbackApi.reviewModeration(id, status);
      addToast(status === 'approved' ? 'Đã cho phép người viết gửi lại nội dung.' : 'Đã yêu cầu người viết sửa ngôn từ.', 'success');
      reload();
    } catch (cause) { addToast(getErrorMessage(cause, 'Không thể xử lý nội dung.'), 'error'); }
    finally { setBusy(false); }
  };

  const summary = result?.summary;
  const count = (value?: number) => loading || error ? '—' : (value ?? 0).toLocaleString('vi-VN');
  const statistics = [
    { label: 'Cần xem lại', value: summary?.needsReview, icon: CircleAlert, tone: 'text-amber-700 bg-amber-50', note: 'Đang chờ quyết định' },
    { label: 'Đang ẩn', value: summary?.hidden, icon: EyeOff, tone: 'text-primary bg-primary/8', note: 'Chưa hiển thị công khai' },
    { label: 'Đã chặn', value: summary?.blocked, icon: ShieldX, tone: 'text-rose-700 bg-rose-50', note: `${count(summary?.rulesBlocked)} bởi bộ lọc từ ngữ` },
    { label: 'Được phép', value: summary?.allowed, icon: ShieldCheck, tone: 'text-emerald-700 bg-emerald-50', note: 'Nội dung phù hợp' },
  ] as const;
  const views = [
    { value: 'attention', label: 'Cần xem lại', count: summary?.needsReview },
    { value: 'blocked', label: 'Đã chặn', count: summary?.blocked },
    { value: 'all', label: 'Tất cả', count: summary?.total },
  ] as const;

  return <Modal open title="Báo cáo kiểm duyệt đánh giá" onClose={onClose} size="lg">
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/8 text-primary"><ShieldCheck size={23} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h3 className="font-semibold text-on-surface">Tổng quan kiểm duyệt</h3>
            <p className="mt-1 text-xs text-on-surface-variant">{count(summary?.total)} nội dung đã kiểm tra</p>
          </div>
        </div>
        <div className="flex items-end gap-2 sm:items-center">
          <FormSelect id="moderation-report-period" name="period" label="Thời gian" value={query.days} className="min-w-0 flex-1 sm:w-52 sm:flex-none"
            onValueChange={value => setQuery({ ...query, days: value as ModerationReportQuery['days'], page: 1 })}>
            <option value="7">7 ngày gần đây</option><option value="30">30 ngày gần đây</option>
            <option value="90">90 ngày gần đây</option><option value="all">Toàn bộ thời gian</option>
          </FormSelect>
          <button type="button" aria-label="Làm mới báo cáo" title="Làm mới báo cáo" disabled={loading || busy} onClick={reload}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-outline-variant/50 text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40">
            <RefreshCw size={18} aria-hidden="true" className={loading ? 'animate-spin motion-reduce:animate-none' : ''} />
          </button>
        </div>
      </div>

      <section aria-label="Thống kê kiểm duyệt" aria-busy={loading} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statistics.map(({ label, value, icon: Icon, tone, note }) => <div key={label} className="min-w-0 rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-on-surface-variant">{label}</p>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={16} aria-hidden="true" /></span>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-on-surface tabular-nums">{count(value)}</p>
          <p className="mt-1.5 text-[11px] leading-5 text-on-surface-variant">{note}</p>
        </div>)}
      </section>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-surface-container-low/70 px-4 py-3 text-xs text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5"><EyeOff size={14} aria-hidden="true" />Đã lưu ẩn <strong className="font-semibold text-on-surface tabular-nums">{count(summary?.savedHidden)}</strong></span>
        <span className="inline-flex items-center gap-1.5"><CheckCheck size={14} aria-hidden="true" />Admin đã duyệt <strong className="font-semibold text-on-surface tabular-nums">{count(summary?.approvedByAdmin)}</strong></span>
        <span className="inline-flex items-center gap-1.5"><CircleAlert size={14} aria-hidden="true" />AI cần kiểm tra <strong className={summary?.unavailable ? 'font-semibold text-amber-800 tabular-nums' : 'font-semibold text-on-surface tabular-nums'}>{count(summary?.unavailable)}</strong></span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest" aria-label="Kết quả kiểm duyệt">
        <div className="flex flex-col gap-3 border-b border-outline-variant/35 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 flex-wrap gap-1" role="group" aria-label="Lọc kết quả kiểm duyệt">
            {views.map(view => <button key={view.value} type="button" aria-pressed={query.view === view.value}
              onClick={() => setQuery({ ...query, view: view.value, page: 1 })}
              className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 pb-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${query.view === view.value ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface'}`}>
              {view.label}<span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${query.view === view.value ? 'bg-primary/10 text-primary' : 'bg-surface-container-low text-on-surface-variant'}`}>{count(view.count)}</span>
            </button>)}
          </div>
          <button type="button" onClick={onViewHidden} className="mb-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary">
            Xem đánh giá đã ẩn<ArrowUpRight size={15} aria-hidden="true" />
          </button>
        </div>

        <AsyncState loading={loading} error={error} onRetry={reload} skeleton={<div className="divide-y divide-outline-variant/30" aria-label="Đang tải kết quả">
          {[0, 1, 2].map(index => <div key={index} className="space-y-3 px-5 py-6"><div className="h-3 w-40 rounded bg-surface-container-low" /><div className="h-4 w-4/5 rounded bg-surface-container-low" /><div className="h-3 w-3/5 rounded bg-surface-container-low" /></div>)}
        </div>}>
          {result?.items.length ? <div className="divide-y divide-outline-variant/30">
            {result.items.map(item => <article key={item._id} className="min-w-0 space-y-4 px-4 py-5 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <MessageSquare size={15} className="text-on-surface-variant" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-on-surface">{item.kind === 'comment' ? 'Đánh giá khách hàng' : 'Phản hồi của thợ'}</h4>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${decisionStyles[item.decision]}`}>
                    <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />{decisionLabels[item.decision]}
                  </span>
                </div>
                <time className="text-[11px] text-on-surface-variant" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('vi-VN')}</time>
              </div>
              <p className="whitespace-pre-wrap break-words border-l-2 border-outline-variant/50 pl-3 text-sm leading-7 text-on-surface">{item.content}</p>
              <div className="flex gap-2 rounded-xl bg-surface-container-low/60 p-3">
                <Sparkles size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{sourceLabels[item.source]}</p>
                  <p className="mt-1 break-words text-xs leading-5 text-on-surface-variant">{item.reason}</p>
                </div>
              </div>
              {item.reviewedAt && <p className="text-xs text-on-surface-variant">{item.status === 'approved' ? 'Admin đã cho phép' : 'Admin yêu cầu sửa ngôn từ'} lúc {new Date(item.reviewedAt).toLocaleString('vi-VN')}</p>}
              {item.feedback && !item.isCurrent && <p className="text-xs leading-5 text-on-surface-variant">Đánh giá đã thay đổi hoặc không còn hiệu lực.</p>}
              {item.needsReview && !item.feedback && <p className="text-xs leading-5 text-on-surface-variant">Nội dung chưa đăng. Người viết cần gửi lại sau khi được duyệt.</p>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-on-surface-variant">{item.feedback && item.isCurrent && <>
                  <span className="font-semibold text-on-surface">{item.feedback.rating}/5 sao</span><span className="mx-2" aria-hidden="true">·</span>{item.feedback.isVisible ? 'Đang hiển thị' : 'Đã ẩn'}
                </>}</div>
                <div className="flex flex-wrap gap-2">
                  {item.feedback && <button type="button" className="btn-secondary min-h-11 text-xs" onClick={() => onOpenFeedback(item.feedback!._id)}>Xem đánh giá</button>}
                  {item.needsReview && item.isCurrent && item.feedback && !item.feedback.isVisible && <button type="button" className="btn-primary min-h-11 text-xs" onClick={() => onShowFeedback(item.feedback!._id, item.feedback!.updatedAt)}>Hiện đánh giá</button>}
                  {item.needsReview && !item.feedback && <>
                    <button type="button" className="btn-secondary min-h-11 text-xs" disabled={busy} onClick={() => void reviewLegacy(item._id, 'rejected')}>Yêu cầu sửa ngôn từ</button>
                    <button type="button" className="btn-primary min-h-11 text-xs" disabled={busy} onClick={() => void reviewLegacy(item._id, 'approved')}>Cho phép gửi lại</button>
                  </>}
                </div>
              </div>
            </article>)}
          </div> : <div className="flex w-full min-w-0 flex-col items-center px-5 py-12 text-center">
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck size={27} aria-hidden="true" /></span>
            <h4 className="text-sm font-semibold text-on-surface">{query.view === 'attention' ? 'Không có nội dung cần xem lại' : 'Chưa có kết quả phù hợp'}</h4>
            <p className="mt-2 w-full min-w-0 max-w-[32rem] whitespace-normal break-normal text-sm leading-6 text-on-surface-variant">Bạn có thể chọn khoảng thời gian khác để xem thêm kết quả kiểm duyệt.</p>
          </div>}
        </AsyncState>
      </section>
      {result && !loading && !error && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-on-surface-variant">
        <span>Cập nhật lúc {new Date(result.period.end).toLocaleString('vi-VN')}</span>
        {result.pagination.totalPages > 1 && <Pagination page={query.page} totalPages={result.pagination.totalPages} onChange={page => setQuery({ ...query, page })} />}
      </div>}
    </div>
  </Modal>;
}
