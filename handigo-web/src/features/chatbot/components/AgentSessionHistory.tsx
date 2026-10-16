import { useToastFeedback } from "@/components/common/Toast";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, LoaderCircle, MessageSquare, Trash2 } from "lucide-react";
import { agentApi } from "../api/agent.api";
import type { AgentSessionHistory as History } from "../types/agent.types";
import { getErrorMessage } from "@/utils/apiError";
import { agentDisplayText } from "../utils/agentDisplayText";

export function AgentSessionHistory({ currentId, disabled, onSelect, onDelete }: {
  currentId: string; disabled: boolean; onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useToastFeedback<string>("", "error");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, setDeleteError] = useToastFeedback<string>("", "error");
  const deleting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void agentApi.list(page, controller.signal).then((result) => {
      if (!controller.signal.aborted) setHistory(result);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(getErrorMessage(error, "Chưa tải được lịch sử trò chuyện."));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, attempt, setError]);
  const changePage = (next: number) => { setLoading(true); setError(""); setPage(next); };
  const deleteSession = async (id: string) => {
    if (disabled || deleting.current) return;
    deleting.current = true;
    setDeletingId(id);
    setDeleteError("");
    try {
      await onDelete(id);
      setHistory((current) => current ? { ...current, items: current.items.filter((item) => item.sessionId !== id) } : current);
      setLoading(true);
      setError("");
      if (history?.items.length === 1 && page > 1) setPage(page - 1);
      else setAttempt((value) => value + 1);
    } catch (error) {
      setDeleteError(getErrorMessage(error, "Chưa xóa được cuộc trò chuyện. Vui lòng thử lại."));
    } finally {
      deleting.current = false;
      setDeletingId(null);
    }
  };
  return <section aria-label="Lịch sử trò chuyện" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-surface-container-low/40 p-4 sm:p-5">
    <div className="mb-5"><p className="mb-1 text-xs font-medium text-primary">LỊCH SỬ</p><h3 className="font-headline-md text-xl font-semibold tracking-tight text-on-surface">Cuộc trò chuyện của bạn</h3><p className="mt-1 text-xs leading-5 text-on-surface-variant">Mở lại cuộc trò chuyện để tiếp tục yêu cầu.</p></div>
    {loading ? <p role="status" className="text-sm">Đang tải lịch sử…</p>
      : error ? <div role="alert" className="text-sm text-error">{error}
        <button type="button" className="ml-2 underline" onClick={() => { setLoading(true); setError(""); setAttempt(attempt + 1); }}>Thử lại</button>
      </div>
      : <>
        {!history?.items.length && <p className="text-sm text-on-surface-variant">Chưa có cuộc trò chuyện nào.</p>}
        {history?.items.map((item) => <div key={item.sessionId}
          className={`group flex items-center rounded-2xl border bg-surface-container-lowest transition-colors hover:border-primary/40 ${item.sessionId === currentId ? "border-primary/45 bg-primary/5" : "border-outline-variant/40"}`}>
          <button type="button" disabled={disabled || Boolean(deletingId)}
          aria-current={item.sessionId === currentId ? "true" : undefined} onClick={() => onSelect(item.sessionId)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-container-low text-primary"><MessageSquare size={17} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{agentDisplayText(item.title)}</span>
          <time className="mt-1 block text-xs text-on-surface-variant">{new Date(item.updatedAt).toLocaleString("vi-VN")}</time>
          {item.needsAttention && <span className="mt-1 block text-xs text-primary">Có thao tác cần xử lý</span>}
          </span><ChevronRight size={15} aria-hidden="true" className="shrink-0 text-on-surface-variant" />
          </button>
          <button type="button" disabled={disabled || Boolean(deletingId)}
            aria-label={`Xóa cuộc trò chuyện: ${agentDisplayText(item.title)}`} title="Xóa cuộc trò chuyện"
            onClick={() => void deleteSession(item.sessionId)}
            className="mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition-opacity hover:bg-error/10 hover:text-error focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-40 [@media(hover:hover)]:opacity-0">
            {deletingId === item.sessionId ? <LoaderCircle size={18} aria-label="Đang xóa" className="animate-spin" /> : <Trash2 size={18} aria-hidden="true" />}
          </button>
        </div>)}
        {history && history.pagination.totalPages > 1 && <nav aria-label="Phân trang lịch sử" className="flex items-center justify-between text-sm">
          <button type="button" disabled={disabled || page === 1} className="min-h-11 px-2 disabled:opacity-40" onClick={() => changePage(page - 1)}>Trang trước</button>
          <span>{page}/{history.pagination.totalPages}</span>
          <button type="button" disabled={disabled || page >= history.pagination.totalPages} className="min-h-11 px-2 disabled:opacity-40" onClick={() => changePage(page + 1)}>Trang sau</button>
        </nav>}
      </>}
  </section>;
}
