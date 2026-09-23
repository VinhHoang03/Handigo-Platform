import { lazy } from "react";

// Lazy-loaded page components referenced from more than one route group
// (public + customer, or customer + provider). Keeping a single lazy()
// definition per component preserves the original code-splitting chunks.

export const HomeRoute = lazy(() =>
  import("@/components/auth/HomeRoute").then(({ HomeRoute }) => ({
    default: HomeRoute,
  })),
);

export const WalletPage = lazy(() =>
  import("@/features/wallet/pages/WalletPage").then(({ WalletPage }) => ({
    default: WalletPage,
  })),
);

export const CaseManagementPage = lazy(
  () => import("@/features/case-management/pages/CaseManagementPage"),
);
