import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthBootstrap } from "./components/auth/AuthBootstrap";
import { ToastProvider, ToastContainer } from "./components/common/Toast";
import { SystemAlertProvider } from "./components/common/SystemAlert";
import { useAuthStore } from "./features/auth/store/auth.store";
import { PublicRoutes } from "./routes/public-routes";
import { CustomerRoutes } from "./routes/customer-routes";
import { ProviderRoutes } from "./routes/provider-routes";
import { AdminRoutes } from "./routes/admin-routes";
import "./App.css";

const ProviderAssignmentModal = lazy(() =>
  import("./features/provider/components/ProviderAssignmentModal").then(
    ({ ProviderAssignmentModal }) => ({
      default: ProviderAssignmentModal,
    }),
  ),
);
const ChatbotGate = lazy(() =>
  import("./features/chatbot/components/ChatbotGate").then(
    ({ ChatbotGate }) => ({ default: ChatbotGate }),
  ),
);
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

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
      <SystemAlertProvider>
        <Router>
          <AuthBootstrap>
          {/* Cho người dùng bàn phím nhảy thẳng tới nội dung, bỏ qua thanh điều
              hướng. Ẩn cho tới khi được focus. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-on-primary"
          >
            Bỏ qua, tới nội dung chính
          </a>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              {PublicRoutes()}
              {CustomerRoutes()}
              {ProviderRoutes()}
              {AdminRoutes()}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <ProviderAssignmentModalGate />
          <Suspense fallback={null}>
            <ChatbotGate />
          </Suspense>
          </AuthBootstrap>
        </Router>
      </SystemAlertProvider>
      <ToastContainer />
    </ToastProvider>
  );
}

export default App;
