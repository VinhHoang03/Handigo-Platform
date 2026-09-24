import { lazy } from "react";

// Lazy-loaded admin page components, kept separate from admin-routes.tsx
// purely to stay under the project's 200-line-per-file guideline.

export const AdminUsersPage = lazy(
  () => import("@/features/admin/pages/AdminUsersPage"),
);
export const AdminProviderApplicationsPage = lazy(
  () => import("@/features/admin/pages/AdminProviderApplicationsPage"),
);
export const AdminCategoriesPage = lazy(
  () => import("@/features/admin/pages/AdminCategoriesPage"),
);
export const AdminServicesPage = lazy(
  () => import("@/features/admin/pages/AdminServicesPage"),
);
export const AdminPromotionsPage = lazy(
  () => import("@/features/admin/pages/AdminPromotionsPage"),
);
export const AdminWithdrawalsPage = lazy(
  () => import("@/features/admin/pages/AdminWithdrawalsPage"),
);
export const AdminSupportPage = lazy(
  () => import("@/features/admin/pages/AdminSupportPage"),
);
export const AdminRevenuePage = lazy(
  () => import("@/features/admin/pages/AdminRevenuePage"),
);
export const AdminCasesPage = lazy(
  () => import("@/features/admin/pages/AdminCasesPage"),
);
export const AdminDashboardPage = lazy(
  () => import("@/features/admin/pages/AdminDashboardPage"),
);
export const AdminPaymentsPage = lazy(
  () => import("@/features/admin/pages/AdminPaymentsPage"),
);
export const AdminWalletsPage = lazy(
  () => import("@/features/admin/pages/AdminWalletsPage"),
);
export const AdminSystemConfigsPage = lazy(
  () => import("@/features/admin/pages/AdminSystemConfigsPage"),
);
export const AdminNewsPage = lazy(
  () => import("@/features/admin/pages/AdminNewsPage"),
);
export const AdminServiceSuggestionsPage = lazy(
  () =>
    import("@/features/service-suggestion/pages/AdminServiceSuggestionsPage"),
);
export const AdminFeedbackPage = lazy(
  () => import("@/features/feedback/pages/AdminFeedbackPage"),
);
export const NotificationsPage = lazy(
  () => import("@/features/notification/pages/NotificationsPage"),
);
