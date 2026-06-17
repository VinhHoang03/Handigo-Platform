import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./features/auth/pages/LoginPage";
import RegisterPage from "./features/auth/pages/RegisterPage";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage";
import BookingDetailPage from "./features/booking/pages/BookingDetailPage";
import BookingHistoryPage from "./features/booking/pages/BookingHistoryPage";
import ConfirmPaymentPage from "./features/booking/pages/ConfirmPaymentPage";
import CreateBookingStep1Page from "./features/booking/pages/CreateBookingStep1Page";
import CreateBookingStep2Page from "./features/booking/pages/CreateBookingStep2Page";
import BookingSuccessPage from "./features/booking/pages/BookingSuccessPage";
import CustomerProfilePage from "./features/customer/pages/CustomerProfilePage";
import ProviderHomePage from "./features/provider/pages/ProviderHomePage";
import ProviderOrdersPage from "./features/provider/pages/ProviderOrdersPage";
import ProviderOrderDetailPage from "./features/provider/pages/ProviderOrderDetailPage";
import ProviderProfilePage from "./features/provider/pages/ProviderProfilePage";
import ProviderBankAccountsPage from "./features/bank-account/pages/ProviderBankAccountsPage";
import NotificationsPage from "./features/notification/pages/NotificationsPage";
import CustomerFeedbackPage from "./features/feedback/pages/CustomerFeedbackPage";
import ProviderFeedbackPage from "./features/feedback/pages/ProviderFeedbackPage";
import AdminFeedbackPage from "./features/feedback/pages/AdminFeedbackPage";
import RegisterProviderPage from "./features/provider-application/pages/RegisterProviderPage";
import AdminUsersPage from "./features/admin/pages/AdminUsersPage";
import AdminProviderApplicationsPage from "./features/admin/pages/AdminProviderApplicationsPage";
import { WalletPage } from "./features/wallet/pages/WalletPage";
import AdminCategoriesPage from "./features/admin/pages/AdminCategoriesPage";
import AdminServicesPage from "./features/admin/pages/AdminServicesPage";
import AdminPromotionsPage from "./features/admin/pages/AdminPromotionsPage";
import { RouteGuard } from "./components/common/RouteGuard";
import { AuthBootstrap } from "./components/auth/AuthBootstrap";
import { HomeRoute } from "./components/auth/HomeRoute";
import { ProfileRoute } from "./components/auth/ProfileRoute";
import NotFoundPage from "./pages/NotFoundPage";
import "./App.css";

function App() {
  return (
    <Router>
      <AuthBootstrap>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signin" element={<LoginPage />} />
          <Route path="/profile" element={<ProfileRoute />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/customer/bookings" element={<BookingHistoryPage />} />
          <Route
            path="/customer/bookings/new"
            element={<CreateBookingStep1Page />}
          />
          <Route
            path="/customer/bookings/new/location"
            element={<CreateBookingStep2Page />}
          />
          <Route
            path="/customer/bookings/new/payment"
            element={<ConfirmPaymentPage />}
          />
          <Route
            path="/customer/bookings/success"
            element={<BookingSuccessPage />}
          />
          <Route
            path="/customer/bookings/:bookingId"
            element={<BookingDetailPage />}
          />
          <Route path="/customer/profile" element={<CustomerProfilePage />} />
          <Route path="/provider" element={<ProviderHomePage />} />
          <Route path="/provider/profile" element={<ProviderProfilePage />} />
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
            path="/customer/wallet"
            element={
              <RouteGuard roles={["CUSTOMER"]}>
                <WalletPage role="CUSTOMER" />
              </RouteGuard>
            }
          />
          <Route
            path="/customer/notifications"
            element={
              <RouteGuard roles={["CUSTOMER"]}>
                <NotificationsPage role="CUSTOMER" />
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
            path="/provider/profile"
            element={
              <RouteGuard roles={["PROVIDER"]}>
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
            path="/provider/notifications"
            element={
              <RouteGuard roles={["PROVIDER"]}>
                <NotificationsPage role="PROVIDER" />
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
            path="/register-provider"
            element={
              <RouteGuard roles={["CUSTOMER"]}>
                <RegisterProviderPage />
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
            path="/admin/notifications"
            element={
              <RouteGuard roles={["ADMIN"]}>
                <NotificationsPage role="ADMIN" />
              </RouteGuard>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthBootstrap>
    </Router>
  );
}

export default App;
