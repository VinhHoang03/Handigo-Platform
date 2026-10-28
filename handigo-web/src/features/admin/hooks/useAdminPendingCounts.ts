import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "@/api/client";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { adminDashboardApi } from "../api/adminDashboard.api";
import type { AdminPendingCounts } from "../types/adminDashboard.types";
import { isPendingWorkMutation } from "../utils/adminPendingNavigation";

export function useAdminPendingCounts(enabled: boolean) {
  const { pathname } = useLocation();
  const sessionRevision = useAuthStore((state) => state.sessionRevision);
  const [snapshot, setSnapshot] = useState<{ revision: number; data: AdminPendingCounts | null; stale: boolean } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let inFlight = false;
    let refreshAgain = false;
    let timer: number | undefined;
    const controller = new AbortController();
    const schedule = () => {
      if (!active) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 250);
    };
    const load = async () => {
      if (!active || document.hidden) return;
      if (inFlight) { refreshAgain = true; return; }
      inFlight = true;
      try {
        const data = await adminDashboardApi.pendingCounts(controller.signal);
        if (active) setSnapshot({ revision: sessionRevision, data, stale: false });
      } catch {
        if (active) setSnapshot((previous) => ({ revision: sessionRevision, data: previous?.revision === sessionRevision ? previous.data : null, stale: true }));
      } finally {
        inFlight = false;
        if (active && refreshAgain) { refreshAgain = false; schedule(); }
      }
    };
    const onVisible = () => { if (!document.hidden) schedule(); };
    const interceptor = api.interceptors.response.use((response) => {
      if (response.data?.success !== false && isPendingWorkMutation(response.config.method, response.config.url)) schedule();
      return response;
    });
    timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(onVisible, 30_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      api.interceptors.response.eject(interceptor);
    };
  }, [enabled, pathname, sessionRevision]);

  return enabled && snapshot?.revision === sessionRevision
    ? { counts: snapshot.data, stale: snapshot.stale } : { counts: null, stale: false };
}
