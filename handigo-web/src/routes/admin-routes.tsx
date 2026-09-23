import { Route } from "react-router-dom";
import { RouteGuard } from "@/components/common/RouteGuard";
import {
  AdminUsersPage,
  AdminProviderApplicationsPage,
  AdminCategoriesPage,
  AdminServicesPage,
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
  AdminServiceSuggestionsPage,
  AdminFeedbackPage,
  NotificationsPage,
} from "./admin-lazy-pages";

/** Admin-area routes (all guarded by RouteGuard roles={["ADMIN"]}). Called
 * as a function inside <Routes> so the returned Fragment's <Route> children
 * are hoisted to the top level exactly like inline JSX would be. */
export function AdminRoutes() {
  return (
    <>
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
        path="/admin/services"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminServicesPage />
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
      <Route
        path="/admin/news"
        element={
          <RouteGuard roles={["ADMIN"]}>
            <AdminNewsPage />
          </RouteGuard>
        }
      />
    </>
  );
}
