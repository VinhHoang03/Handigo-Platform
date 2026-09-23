import { lazy } from "react";
import { Route } from "react-router-dom";
import { RouteGuard } from "@/components/common/RouteGuard";
import { WalletPage, CaseManagementPage } from "./shared-lazy-pages";

const ProviderHomePage = lazy(
  () => import("@/features/provider/pages/ProviderHomePage"),
);
const ProviderOrdersPage = lazy(
  () => import("@/features/provider/pages/ProviderOrdersPage"),
);
const ProviderOrderDetailPage = lazy(
  () => import("@/features/provider/pages/ProviderOrderDetailPage"),
);
const ProviderSchedulePage = lazy(
  () => import("@/features/provider/pages/ProviderSchedulePage"),
);
const ProviderProfilePage = lazy(
  () => import("@/features/provider/pages/ProviderProfilePage"),
);
const ProviderBankAccountsPage = lazy(
  () => import("@/features/bank-account/pages/ProviderBankAccountsPage"),
);
const ProviderFeedbackPage = lazy(
  () => import("@/features/feedback/pages/ProviderFeedbackPage"),
);
const ProviderServiceSuggestionPage = lazy(
  () =>
    import("@/features/service-suggestion/pages/ProviderServiceSuggestionPage"),
);
const RegisterProviderPage = lazy(
  () => import("@/features/provider-application/pages/RegisterProviderPage"),
);

/** Provider-area routes (guarded by RouteGuard where required). Called as a
 * function inside <Routes> so the returned Fragment's <Route> children are
 * hoisted to the top level exactly like inline JSX would be. */
export function ProviderRoutes() {
  return (
    <>
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
    </>
  );
}
