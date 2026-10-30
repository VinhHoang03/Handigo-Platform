import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getErrorMessage } from "@/utils/apiError";

// Dùng chung cơ chế đồng bộ hồ sơ cho màn hình người yêu cầu và admin.
export function useSupportData<T extends { _id: string }, L>(
  fetchList: () => Promise<L>,
  fetchTicket: (id: string) => Promise<T>,
) {
  const revision = useAuthStore(state => state.sessionRevision);
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const [list, setList] = useState<{ revision: number; source: typeof fetchList; data: L | null; loading: boolean; error: string }>({ revision, source: fetchList, data: null, loading: true, error: "" });
  const [detail, setDetail] = useState<{ revision: number; item: T | null; loading: boolean; error: string }>({ revision, item: null, loading: false, error: "" });
  const [action, setAction] = useState({ revision, busy: false, error: "" });
  const selectedId = useRef<string | null>(null);
  const mounted = useRef(false);
  const busy = useRef(false);
  const listSequence = useRef(0);
  const detailSequence = useRef(0);
  const listFlight = useRef<{ source: typeof fetchList; promise: Promise<void> } | null>(null);
  const activeSource = useRef(fetchList);
  const reload = useRef<(background?: boolean) => Promise<void>>(async () => {});
  const detailFlight = useRef<{ id: string; promise: Promise<void> } | null>(null);

  const currentSession = useCallback(() => mounted.current && authenticated
    && useAuthStore.getState().sessionRevision === revision
    && useAuthStore.getState().isAuthenticated, [authenticated, revision]);

  const invalidateList = useCallback(() => {
    listSequence.current++;
    listFlight.current = null;
  }, []);
  const invalidateDetail = useCallback(() => {
    detailSequence.current++;
    detailFlight.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    selectedId.current = null;
    busy.current = false;
    return () => {
      mounted.current = false;
      selectedId.current = null;
      invalidateList();
      invalidateDetail();
    };
  }, [revision, authenticated, invalidateList, invalidateDetail]);

  const load = useCallback((background = false): Promise<void> => {
    if (!currentSession() || busy.current || activeSource.current !== fetchList) return Promise.resolve();
    if (listFlight.current?.source === fetchList) return listFlight.current.promise;
    const sequence = ++listSequence.current;
    setList(previous => ({ ...previous, revision, source: fetchList,
      data: previous.revision === revision && previous.source === fetchList ? previous.data : null,
      loading: !background || previous.revision !== revision || previous.source !== fetchList || !previous.data, error: "" }));
    const promise = (async () => {
      try {
        const data = await fetchList();
        if (currentSession() && activeSource.current === fetchList && sequence === listSequence.current) {
          setList({ revision, source: fetchList, data, loading: false, error: "" });
        }
      } catch (error) {
        if (currentSession() && activeSource.current === fetchList && sequence === listSequence.current) {
          setList(previous => ({ ...previous, loading: false, error: getErrorMessage(error, "Không thể cập nhật danh sách hỗ trợ. Vui lòng thử lại.") }));
        }
      }
    })().finally(() => {
      if (listFlight.current?.promise === promise) listFlight.current = null;
    });
    listFlight.current = { source: fetchList, promise };
    return promise;
  }, [currentSession, fetchList, revision]);

  const refreshDetail = useCallback((id = selectedId.current, foreground = false): Promise<void> => {
    if (!id || !currentSession() || busy.current) return Promise.resolve();
    if (detailFlight.current?.id === id) return detailFlight.current.promise;
    const sequence = ++detailSequence.current;
    if (foreground) setDetail({ revision, item: null, loading: true, error: "" });
    const promise = (async () => {
      try {
        const item = await fetchTicket(id);
        if (currentSession() && selectedId.current === id && sequence === detailSequence.current) {
          setDetail({ revision, item, loading: false, error: "" });
        }
      } catch (error) {
        if (currentSession() && selectedId.current === id && sequence === detailSequence.current) {
          setDetail(previous => ({ ...previous, revision, loading: false, error: getErrorMessage(error, "Không thể cập nhật chi tiết hỗ trợ. Vui lòng thử lại.") }));
        }
      }
    })().finally(() => {
      if (detailFlight.current?.promise === promise) detailFlight.current = null;
    });
    detailFlight.current = { id, promise };
    return promise;
  }, [currentSession, fetchTicket, revision]);

  const refresh = useCallback(async (background = false) => {
    await Promise.all([load(background), refreshDetail()]);
  }, [load, refreshDetail]);

  useEffect(() => {
    activeSource.current = fetchList;
    reload.current = refresh;
    const initial = window.setTimeout(() => { if (!document.hidden) void load(); }, 0);
    const onVisible = () => { if (!document.hidden) void refresh(true); };
    const interval = window.setInterval(onVisible, 30_000);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      invalidateList();
    };
  }, [fetchList, load, refresh, invalidateList]);

  const open = useCallback(async (id: string) => {
    if (busy.current || !currentSession()) return;
    selectedId.current = id;
    detailSequence.current++;
    detailFlight.current = null;
    setAction({ revision, busy: false, error: "" });
    await refreshDetail(id, true);
  }, [currentSession, refreshDetail, revision]);

  const close = useCallback(() => {
    if (busy.current) return;
    selectedId.current = null;
    detailSequence.current++;
    detailFlight.current = null;
    setDetail({ revision, item: null, loading: false, error: "" });
    setAction({ revision, busy: false, error: "" });
  }, [revision]);

  const runAction = useCallback(async (work: () => Promise<T>) => {
    const id = selectedId.current;
    if (!id || busy.current || !currentSession()) return false;
    busy.current = true;
    listSequence.current++;
    detailSequence.current++;
    listFlight.current = null;
    detailFlight.current = null;
    setAction({ revision, busy: true, error: "" });
    let succeeded = false;
    try {
      const item = await work();
      if (currentSession() && selectedId.current === id) {
        setDetail({ revision, item, loading: false, error: "" });
        succeeded = true;
      }
    } catch (error) {
      if (currentSession()) setAction({ revision, busy: true, error: getErrorMessage(error, "Không thể cập nhật hỗ trợ. Vui lòng tải lại và thử lại.") });
    } finally {
      if (currentSession()) {
        busy.current = false;
        setAction(previous => ({ ...previous, busy: false }));
        void reload.current(true);
      }
    }
    return succeeded;
  }, [currentSession, revision]);

  const visibleList = authenticated && list.revision === revision && list.source === fetchList;
  const visibleDetail = authenticated && detail.revision === revision;
  return {
    data: visibleList ? list.data : null,
    loading: authenticated && (!visibleList || list.loading),
    error: visibleList && !list.data ? list.error : "",
    refreshError: visibleList && list.data ? list.error : "",
    selected: visibleDetail ? detail.item : null,
    detailLoading: visibleDetail && detail.loading,
    detailError: visibleDetail ? detail.error : "",
    busy: action.revision === revision && action.busy,
    actionError: action.revision === revision ? action.error : "",
    load: refresh, open, close, runAction,
  };
}
