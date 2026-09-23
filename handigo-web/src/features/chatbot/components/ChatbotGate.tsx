import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useChatUiStore } from "@/features/chat/store/chatUi.store";
import type { ChatbotAudience } from "../types/chatbot.types";
import { ChatbotWidget } from "./ChatbotWidget";

const AUTH_PATHS = new Set([
  "/login",
  "/signin",
  "/register",
  "/forgot-password",
]);

const isAuthenticationPath = (path: string) =>
  AUTH_PATHS.has(path) || path.startsWith("/auth/");

export function ChatbotGate() {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const activeChatPopupCount = useChatUiStore(
    (state) => state.activePopupCount,
  );
  const normalizedRole = user?.role.toUpperCase();

  if (
    isInitializing ||
    !isAuthenticated ||
    activeChatPopupCount > 0 ||
    isAuthenticationPath(location.pathname) ||
    (normalizedRole !== "CUSTOMER" && normalizedRole !== "PROVIDER")
  ) {
    return null;
  }

  const audience: ChatbotAudience = normalizedRole;

  return <ChatbotWidget audience={audience} />;
}
