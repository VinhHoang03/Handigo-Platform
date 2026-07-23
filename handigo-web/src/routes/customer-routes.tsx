import { lazy } from "react";
import { Route } from "react-router-dom";
import { RouteGuard } from "@/components/common/RouteGuard";
import { HomeRoute, WalletPage, CaseManagementPage } from "./shared-lazy-pages";

const BookingDetailPage = lazy(
  () => import("@/features/booking/pages/BookingDetailPage"),
);
const BookingHistoryPage = lazy(
  () => import("@/features/booking/pages/BookingHistoryPage"),
);
const ConfirmPaymentPage = lazy(
  () => import("@/features/booking/pages/ConfirmPaymentPage"),
);
const CreateBookingStep1Page = lazy(
  () => import("@/features/booking/pages/CreateBookingStep1Page"),
);
const CreateBookingStep2Page = lazy(
  () => import("@/features/booking/pages/CreateBookingStep2Page"),
);
const BookingSuccessPage = lazy(
  () => import("@/features/booking/pages/BookingSuccessPage"),
);
const CustomerProfilePage = lazy(
  () => import("@/features/customer/pages/CustomerProfilePage"),
);
const CustomerServiceDetailPage = lazy(
  () => import("@/features/customer-service/pages/CustomerServiceDetailPage"),
);
const CustomerServiceListPage = lazy(
  () => import("@/features/customer-service/pages/CustomerServiceListPage"),
);
const PublicProviderProfilePage = lazy(
  () => import("@/features/customer-service/pages/PublicProviderProfilePage"),
);
const CustomerFeedbackPage = lazy(
  () => import("@/features/feedback/pages/CustomerFeedbackPage"),
);

/** Customer-area routes (guarded by RouteGuard where required). Called as a
 * function inside <Routes> so the returned Fragment's <Route> children are
 * hoisted to the top level exactly like inline JSX would be. */
export function CustomerRoutes() {
  return (
    <>
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
        path="/customer/orders/:orderId/feedback"
        element={
          <RouteGuard roles={["CUSTOMER"]}>
            <CustomerFeedbackPage />
          </RouteGuard>
        }
      />
    </>
  );
}
