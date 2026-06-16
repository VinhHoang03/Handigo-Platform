import { Router } from "express";
import * as serviceController from "../controllers/service.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createServiceSchema,
  updateServiceSchema,
} from "../validations/service.validation";

const router = Router();

router.use(authMiddleware, roleMiddleware("ADMIN"));
router.get("/", serviceController.listServices);
router.get("/:id", serviceController.getServiceById);
router.post("/", validate(createServiceSchema), serviceController.createService);
router.patch(
  "/:id",
  validate(updateServiceSchema),
  serviceController.updateService,
);
router.put(
  "/:id",
  validate(updateServiceSchema),
  serviceController.updateService,
);
router.delete("/:id", serviceController.deleteService);

export default router;
