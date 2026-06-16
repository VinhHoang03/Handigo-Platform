import { Router } from "express";
import {
  createConfig,
  getAllConfigs,
  getConfigByKey,
  getPublicConfigs,
  updateConfig,
} from "../controllers/systemConfig.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";

const systemConfigRoutes = Router();

systemConfigRoutes.get("/public", getPublicConfigs);
systemConfigRoutes.use(authMiddleware, roleMiddleware("ADMIN"));
systemConfigRoutes.get("/", getAllConfigs);
systemConfigRoutes.get("/:key", getConfigByKey);
systemConfigRoutes.post("/", createConfig);
systemConfigRoutes.patch("/:key", updateConfig);

export default systemConfigRoutes;
