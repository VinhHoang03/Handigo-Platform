import { useLocation } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store/auth.store";
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
  const normalizedRole = user?.role.toUpperCase();

  if (isInitializing || isAuthenticationPath(location.pathname)) return null;

  const audience: ChatbotAudience = !isAuthenticated
    ? "GUEST"
    : normalizedRole === "CUSTOMER" ||
        normalizedRole === "PROVIDER" ||
        normalizedRole === "ADMIN"
      ? normalizedRole
      : "GUEST";

  return <ChatbotWidget audience={audience} />;
}
