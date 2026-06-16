import { Router } from "express";
import {
  getAdminOrders,
  getAdminProviders,
  getAdminRevenue,
  getDashboardOverview,
  getProviderEarnings,
} from "../controllers/dashboard.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";

const dashboardRoutes = Router();

dashboardRoutes.use(authMiddleware);
dashboardRoutes.get("/overview", getDashboardOverview);
dashboardRoutes.get("/revenue", roleMiddleware("ADMIN"), getAdminRevenue);
dashboardRoutes.get("/orders", roleMiddleware("ADMIN"), getAdminOrders);
dashboardRoutes.get("/providers", roleMiddleware("ADMIN"), getAdminProviders);
dashboardRoutes.get("/earnings", roleMiddleware("PROVIDER"), getProviderEarnings);

export default dashboardRoutes;
