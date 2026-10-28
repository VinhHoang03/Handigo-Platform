import { Router } from "express";
import {
  getAdminOrders,
  getAdminInsights,
  getAdminUserPresence,
  getAdminProviders,
  getAdminRevenue,
  getDashboardOverview,
  getProviderEarnings,
  updateProviderAvailability,
} from "../controllers/dashboard.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { resourceIntensiveRateLimit } from "../middlewares/rateLimit.middleware";
import { approvedProviderMiddleware } from "../middlewares/approvedProvider.middleware";

const dashboardRoutes = Router();

dashboardRoutes.use(authMiddleware);
dashboardRoutes.use(resourceIntensiveRateLimit);
dashboardRoutes.get("/overview", getDashboardOverview);

dashboardRoutes.get("/insights", roleMiddleware("ADMIN"), getAdminInsights);
dashboardRoutes.get("/presence", roleMiddleware("ADMIN"), getAdminUserPresence);
dashboardRoutes.get("/revenue", roleMiddleware("ADMIN"), getAdminRevenue);
dashboardRoutes.get("/orders", roleMiddleware("ADMIN"), getAdminOrders);
dashboardRoutes.get("/providers", roleMiddleware("ADMIN"), getAdminProviders);
dashboardRoutes.get(
  "/earnings",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  getProviderEarnings,
);
dashboardRoutes.patch(
  "/provider/availability",
  roleMiddleware("PROVIDER"),
  approvedProviderMiddleware,
  updateProviderAvailability,
);

export default dashboardRoutes;
