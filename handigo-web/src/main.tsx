import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
// Font self-host: không nạp qua <link> Google Fonts nữa (chặn render, rò rỉ IP
// người dùng sang bên thứ ba). Chỉ nạp đúng các trọng lượng đang dùng.
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource-variable/hanken-grotesk";
import "./index.css";
import App from "./App.tsx";
import { authService } from "@/features/auth/services/auth.service";
import { useAuthStore } from "@/features/auth/store/auth.store";

const googleClientId = import.meta.env.DEV
  ? import.meta.env.VITE_GOOGLE_CLIENT_ID_DEVELOPMENT ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID
  : import.meta.env.VITE_GOOGLE_CLIENT_ID;

const renderApp = () => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={googleClientId}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>,
  );
};

// Khôi phục phiên một lần trước khi render để các route đọc trạng thái đã xác định.
void authService.restoreSession()
  .catch(() => {
    useAuthStore.getState().finishInitialization();
  })
  .finally(renderApp);
