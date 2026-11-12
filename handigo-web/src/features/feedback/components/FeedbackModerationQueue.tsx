import { useCallback, useEffect, useState } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { Pagination } from '@/components/common/Pagination';
import { useToast } from '@/components/common/Toast';
import { getErrorMessage } from '@/utils/apiError';
import { feedbackApi } from '../api/feedback.api';
import type { FeedbackModerationList } from '../types/feedback.types';

interface Props {
  admin?: boolean;
  resourceId?: string;
  kind?: 'comment' | 'reply';
  revision?: string;
  onRestore?: (content: string) => void;
}

export function FeedbackModerationQueue({ admin = false, resourceId, kind, revision, onRestore }: Props) {
  const { addToast } = useToast();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<FeedbackModerationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError('');
      try {
        const value = await feedbackApi.moderationList(page, resourceId, kind);
        if (active) {
          setResult(value);
          if (page > value.pagination.totalPages) setPage(value.pagination.totalPages);
        }
      } catch (cause) {
        if (active) setError(getErrorMessage(cause, 'Không thể tải nội dung kiểm duyệt.'));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [page, resourceId, kind, refresh, revision]);

  const review = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(true);
    try {
      await feedbackApi.reviewModeration(id, status);
      addToast(status === 'approved' ? 'Đã duyệt. Người viết có thể gửi lại đúng nội dung này.' : 'Đã từ chối. Người viết cần chỉnh lại ngôn từ.', 'success');
      reload();
    } catch (cause) {
      addToast(getErrorMessage(cause, 'Không thể xử lý nội dung.'), 'error');
    } finally { setBusy(false); }
  };

  if (!admin && !loading && !error && !result?.items.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/40 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{admin ? 'Nội dung chờ kiểm tra ngữ cảnh' : 'Trạng thái kiểm duyệt lời bình'}</h3>
        <button type="button" className="btn-secondary text-sm" disabled={loading || busy} onClick={reload}>Tải lại trạng thái</button>
      </div>
      <p className="text-sm text-on-surface-variant">{admin
        ? 'Cho phép phản ánh tiêu cực về chất lượng. Chỉ từ chối ngôn từ tục tĩu, miệt thị hoặc đe dọa trực tiếp. Duyệt nội dung không tự động đăng hay thay đổi số sao.'
        : 'Nội dung chờ duyệt chưa được đăng. Khi được duyệt, chọn dùng lại lời bình và gửi lại; bạn có thể giữ nguyên số sao.'}</p>
      <AsyncState loading={loading} error={error} empty={!result?.items.length} emptyMessage="Không có nội dung chờ kiểm tra." onRetry={reload}>
        <div className="space-y-3">
          {result?.items.map(item => (
            <article key={item._id} className="space-y-2 rounded-xl border border-outline-variant/40 p-3">
              <p className="text-xs text-on-surface-variant">{item.kind === 'comment' ? 'Đánh giá khách hàng' : 'Phản hồi của thợ'} · {item.status === 'pending' ? 'Chờ duyệt' : item.status === 'approved' ? 'Đã duyệt' : 'Cần chỉnh ngôn từ'}</p>
              <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
              {admin && <p className="text-xs text-on-surface-variant">{item.reason}</p>}
              {admin ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void review(item._id, 'approved')}>Cho phép nội dung</button>
                  <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void review(item._id, 'rejected')}>Yêu cầu sửa ngôn từ</button>
                </div>
              ) : onRestore && <button type="button" className="btn-secondary text-sm" onClick={() => onRestore(item.content)}>Dùng lại lời bình</button>}
            </article>
          ))}
        </div>
      </AsyncState>
      {result && result.pagination.totalPages > 1 && <Pagination page={page} totalPages={result.pagination.totalPages} onChange={setPage} />}
    </section>
  );
}
