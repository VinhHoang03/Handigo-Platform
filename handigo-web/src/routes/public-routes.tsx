import { lazy } from "react";
import { Route } from "react-router-dom";
import { HomeRoute } from "./shared-lazy-pages";

const ProfileRoute = lazy(() =>
  import("@/components/auth/ProfileRoute").then(({ ProfileRoute }) => ({
    default: ProfileRoute,
  })),
);
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/pages/RegisterPage"));
const ForgotPasswordPage = lazy(
  () => import("@/features/auth/pages/ForgotPasswordPage"),
);
const AboutPage = lazy(() => import("@/features/content/pages/AboutPage"));
const NewsPage = lazy(() => import("@/features/content/pages/NewsPage"));
const NewsDetailPage = lazy(
  () => import("@/features/content/pages/NewsDetailPage"),
);
const SupportPage = lazy(() => import("@/features/content/pages/SupportPage"));

/** Unauthenticated / public content routes. Called as a function inside
 * <Routes> (not as `<PublicRoutes />`) so react-router recognises the
 * returned Fragment's children as top-level <Route> elements. */
export function PublicRoutes() {
  return (
    <>
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
    </>
  );
}
