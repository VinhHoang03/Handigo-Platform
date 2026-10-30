import { Suspense } from "react";
import { Outlet, Route } from "react-router-dom";
import { RouteGuard } from "@/components/common/RouteGuard";
import { DashboardShell } from "@/components/common/DashboardShell";
import { AdminLayoutContext } from "@/components/common/dashboard/adminLayout.context";
import {
  AdminUsersPage,
  AdminProviderApplicationsPage,
  AdminCategoriesPage,
  AdminPromotionsPage,
  AdminWithdrawalsPage,
  AdminSupportPage,
  AdminRevenuePage,
  AdminCasesPage,
  AdminDashboardPage,
  AdminPaymentsPage,
  AdminWalletsPage,
  AdminSystemConfigsPage,
  AdminNewsPage,
  AdminNewsEditorPage,
  AdminServiceSuggestionsPage,
  AdminFeedbackPage,
  NotificationsPage,
} from "./admin-lazy-pages";

function AdminRouteLayout() {
  return (
    <RouteGuard roles={["ADMIN"]}>
      <DashboardShell role="ADMIN">
        <AdminLayoutContext.Provider value={true}>
          <Suspense fallback={<div role="status" className="rounded-xl bg-surface-container-low p-6 text-on-surface-variant">Đang tải trang…</div>}>
            <Outlet />
          </Suspense>
        </AdminLayoutContext.Provider>
      </DashboardShell>
    </RouteGuard>
  );
}

// Giữ layout admin trên route cha để sidebar không bị dựng lại khi chuyển mục.
export function AdminRoutes() {
  return (
    <Route element={<AdminRouteLayout />}>
      <Route
        path="/admin"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminDashboardPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminUsersPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/provider-applications"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminProviderApplicationsPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminCategoriesPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/service-suggestions"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminServiceSuggestionsPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/feedbacks"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminFeedbackPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/promotions"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminPromotionsPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/withdrawals"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminWithdrawalsPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/support"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminSupportPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/cases"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminCasesPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/revenue"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminRevenuePage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminPaymentsPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/wallets"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminWalletsPage />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <NotificationsPage role="ADMIN" />
          </RouteGuard>
        }
      />
      <Route
        path="/admin/system-configs"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminSystemConfigsPage />
          </RouteGuard>
        }
      />
      <Route path="/admin/news">
        <Route index element={<AdminNewsPage />} />
        <Route path="new" element={<AdminNewsEditorPage />} />
        <Route path=":articleId/edit" element={<AdminNewsEditorPage />} />
      </Route>
    </Route>
  );
}
