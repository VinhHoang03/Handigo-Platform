import { Router } from "express";
import * as serviceController from "../controllers/service.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createServiceSchema,
  updateServiceSchema,
} from "../validations/service.validator";
import {
  createServiceOptionSchema,
  updateServiceOptionSchema,
} from "../validations/serviceOption.validator";

const router = Router();

// Public GET routes
router.get("/", serviceController.listServices);
router.get("/:id", serviceController.getServiceById);
router.get("/:id/options", serviceController.getServiceOptions);

// Admin-only write routes
router.use(authMiddleware, roleMiddleware("ADMIN"));

// Service CRUD
router.post("/", validate(createServiceSchema), serviceController.createService);
router.patch("/:id", validate(updateServiceSchema), serviceController.updateService);
router.put("/:id", validate(updateServiceSchema), serviceController.updateService);
router.delete("/:id", serviceController.deleteService);

// ServiceOption CRUD (nested under service)
router.post(
  "/:id/options",
  validate(createServiceOptionSchema),
  serviceController.createOption,
);
router.patch(
  "/options/:optionId",
  validate(updateServiceOptionSchema),
  serviceController.updateOption,
);
router.put(
  "/options/:optionId",
  validate(updateServiceOptionSchema),
  serviceController.updateOption,
);
router.delete("/options/:optionId", serviceController.deleteOption);

export default router;
