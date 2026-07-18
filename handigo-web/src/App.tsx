import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { RouteGuard } from "./components/common/RouteGuard";
import { AuthBootstrap } from "./components/auth/AuthBootstrap";
import { ToastProvider, ToastContainer } from "./components/common/Toast";
import { useAuthStore } from "./features/auth/store/auth.store";
import "./App.css";

const HomeRoute = lazy(() =>
  import("./components/auth/HomeRoute").then(({ HomeRoute }) => ({
    default: HomeRoute,
  })),
);
const ProfileRoute = lazy(() =>
  import("./components/auth/ProfileRoute").then(({ ProfileRoute }) => ({
    default: ProfileRoute,
  })),
);
const LoginPage = lazy(() => import("./features/auth/pages/LoginPage"));
const RegisterPage = lazy(() => import("./features/auth/pages/RegisterPage"));
const ForgotPasswordPage = lazy(
  () => import("./features/auth/pages/ForgotPasswordPage"),
);
const BookingDetailPage = lazy(
  () => import("./features/booking/pages/BookingDetailPage"),
);
const BookingHistoryPage = lazy(
  () => import("./features/booking/pages/BookingHistoryPage"),
);
const ConfirmPaymentPage = lazy(
  () => import("./features/booking/pages/ConfirmPaymentPage"),
);
const CreateBookingStep1Page = lazy(
  () => import("./features/booking/pages/CreateBookingStep1Page"),
);
const CreateBookingStep2Page = lazy(
  () => import("./features/booking/pages/CreateBookingStep2Page"),
);
const BookingSuccessPage = lazy(
  () => import("./features/booking/pages/BookingSuccessPage"),
);
const CustomerProfilePage = lazy(
  () => import("./features/customer/pages/CustomerProfilePage"),
);
const CustomerServiceDetailPage = lazy(
  () => import("./features/customer-service/pages/CustomerServiceDetailPage"),
);
const CustomerServiceListPage = lazy(
  () => import("./features/customer-service/pages/CustomerServiceListPage"),
);
const PublicProviderProfilePage = lazy(
  () => import("./features/customer-service/pages/PublicProviderProfilePage"),
);
const ProviderHomePage = lazy(
  () => import("./features/provider/pages/ProviderHomePage"),
);
const ProviderOrdersPage = lazy(
  () => import("./features/provider/pages/ProviderOrdersPage"),
);
const ProviderOrderDetailPage = lazy(
  () => import("./features/provider/pages/ProviderOrderDetailPage"),
);
const ProviderSchedulePage = lazy(
  () => import("./features/provider/pages/ProviderSchedulePage"),
);
const ProviderProfilePage = lazy(
  () => import("./features/provider/pages/ProviderProfilePage"),
);
const ProviderBankAccountsPage = lazy(
  () => import("./features/bank-account/pages/ProviderBankAccountsPage"),
);
const NotificationsPage = lazy(
  () => import("./features/notification/pages/NotificationsPage"),
);
const CustomerFeedbackPage = lazy(
  () => import("./features/feedback/pages/CustomerFeedbackPage"),
);
const ProviderFeedbackPage = lazy(
  () => import("./features/feedback/pages/ProviderFeedbackPage"),
);
const AdminFeedbackPage = lazy(
  () => import("./features/feedback/pages/AdminFeedbackPage"),
);
const RegisterProviderPage = lazy(
  () => import("./features/provider-application/pages/RegisterProviderPage"),
);
const AdminUsersPage = lazy(
  () => import("./features/admin/pages/AdminUsersPage"),
);
const AdminProviderApplicationsPage = lazy(
  () => import("./features/admin/pages/AdminProviderApplicationsPage"),
);
const WalletPage = lazy(() =>
  import("./features/wallet/pages/WalletPage").then(({ WalletPage }) => ({
    default: WalletPage,
  })),
);
const AdminCategoriesPage = lazy(
  () => import("./features/admin/pages/AdminCategoriesPage"),
);
const AdminServicesPage = lazy(
  () => import("./features/admin/pages/AdminServicesPage"),
);
const AdminPromotionsPage = lazy(
  () => import("./features/admin/pages/AdminPromotionsPage"),
);
const AdminWithdrawalsPage = lazy(
  () => import("./features/admin/pages/AdminWithdrawalsPage"),
);
const AdminSupportPage = lazy(
  () => import("./features/admin/pages/AdminSupportPage"),
);
const AdminRevenuePage = lazy(
  () => import("./features/admin/pages/AdminRevenuePage"),
);
const AdminCasesPage = lazy(
  () => import("./features/admin/pages/AdminCasesPage"),
);
const AdminDashboardPage = lazy(
  () => import("./features/admin/pages/AdminDashboardPage"),
);
const AdminPaymentsPage = lazy(
  () => import("./features/admin/pages/AdminPaymentsPage"),
);
const AdminWalletsPage = lazy(
  () => import("./features/admin/pages/AdminWalletsPage"),
);
const CaseManagementPage = lazy(
  () => import("./features/case-management/pages/CaseManagementPage"),
);
const AdminSystemConfigsPage = lazy(
  () => import("./features/admin/pages/AdminSystemConfigsPage"),
);
const AdminServiceSuggestionsPage = lazy(
  () =>
    import("./features/service-suggestion/pages/AdminServiceSuggestionsPage"),
);
const ProviderServiceSuggestionPage = lazy(
  () =>
    import("./features/service-suggestion/pages/ProviderServiceSuggestionPage"),
);
const ProviderAssignmentModal = lazy(() =>
  import("./features/provider/components/ProviderAssignmentModal").then(
    ({ ProviderAssignmentModal }) => ({
      default: ProviderAssignmentModal,
    }),
  ),
);
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const AboutPage = lazy(() => import("./features/content/pages/AboutPage"));
const NewsPage = lazy(() => import("./features/content/pages/NewsPage"));
const NewsDetailPage = lazy(
  () => import("./features/content/pages/NewsDetailPage"),
);
const SupportPage = lazy(() => import("./features/content/pages/SupportPage"));

function PageLoading() {
  return (
    <div className="grid min-h-screen place-items-center text-on-surface-variant">
      Đang tải trang...
    </div>
  );
}

function ProviderAssignmentModalGate() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.user?.role);
  const onboardingStatus = useAuthStore(
    (state) => state.user?.providerOnboardingStatus,
  );

  if (
    !isAuthenticated ||
    role !== "PROVIDER" ||
    (onboardingStatus && onboardingStatus !== "APPROVED")
  ) return null;

  return (
    <Suspense fallback={null}>
      <ProviderAssignmentModal />
    </Suspense>
  );
}

function App() {
  return (
    <ToastProvider>
      <Router>
        <AuthBootstrap>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signin" element={<LoginPage />} />
              <Route path="/profile" element={<ProfileRoute />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/gioi-thieu" element={<AboutPage />} />
              <Route path="/tin-tuc" element={<NewsPage />} />
              <Route path="/tin-tuc/:articleId" element={<NewsDetailPage />} />
              <Route path="/ho-tro" element={<SupportPage />} />
              <Route
                path="/customer/bookings"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <BookingHistoryPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/bookings/new"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <CreateBookingStep1Page />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/bookings/new/location"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <CreateBookingStep2Page />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/bookings/new/payment"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <ConfirmPaymentPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/bookings/success"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <BookingSuccessPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/bookings/:bookingId"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <BookingDetailPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <HomeRoute />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/profile"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <CustomerProfilePage />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/services"
                element={<CustomerServiceListPage />}
              />
              <Route
                path="/customer/services/:serviceId"
                element={<CustomerServiceDetailPage />}
              />
              <Route
                path="/customer/providers/:providerId"
                element={
                  <RouteGuard roles={["CUSTOMER", "PROVIDER"]}>
                    <PublicProviderProfilePage />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/wallet"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <WalletPage role="CUSTOMER" />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/support"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <CaseManagementPage role="CUSTOMER" />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <ProviderHomePage />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/orders"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <ProviderOrdersPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/orders/:orderId"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <ProviderOrderDetailPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/schedule"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <ProviderSchedulePage />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/profile"
                element={
                  <RouteGuard roles={["PROVIDER"]} allowUnapprovedProvider>
                    <ProviderProfilePage />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/wallet"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <WalletPage role="PROVIDER" />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/bank-accounts"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <ProviderBankAccountsPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/customer/orders/:orderId/feedback"
                element={
                  <RouteGuard roles={["CUSTOMER"]}>
                    <CustomerFeedbackPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/feedbacks"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <ProviderFeedbackPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/service-suggestions"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <ProviderServiceSuggestionPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/provider/support"
                element={
                  <RouteGuard roles={["PROVIDER"]}>
                    <CaseManagementPage role="PROVIDER" />
                  </RouteGuard>
                }
              />
              <Route
                path="/register-provider"
                element={
                  <RouteGuard
                    roles={["CUSTOMER", "PROVIDER"]}
                    allowUnapprovedProvider
                  >
                    <RegisterProviderPage />
                  </RouteGuard>
                }
              />
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
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <ProviderAssignmentModalGate />
        </AuthBootstrap>
      </Router>
      <ToastContainer />
    </ToastProvider>
  );
}

export default App;
