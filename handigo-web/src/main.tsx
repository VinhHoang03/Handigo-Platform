import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import App from "./App.tsx";
import api, { refreshAccessToken } from "@/api/client";
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

// Initialize auth by attempting to refresh access token using HttpOnly refresh cookie.
// If successful, fetch user profile and set auth state. Always render the app afterwards.
(async () => {
  try {
    const token = await refreshAccessToken();
    const res = await api.get("/auth/me");
    const remember = localStorage.getItem("handigo:remember-login") !== "false";
    useAuthStore.getState().setAuth(res.data.user, token, remember);
  } catch {
    // If refresh fails, mark initialization finished so UI can show logged-out state
    useAuthStore.getState().finishInitialization();
  } finally {
    renderApp();
  }
})();
