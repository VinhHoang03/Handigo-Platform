import { Router } from "express";
import * as categoryController from "../controllers/category.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createCategorySchema,
  updateCategorySchema,
} from "../validations/category.validation";

const router = Router();

router.get(
  "/active-with-services",
  categoryController.getActiveCategoriesWithServices,
);
router.get("/active", categoryController.getActiveCategories);

// Public / Authenticated GET routes
router.get("/", authMiddleware, categoryController.listCategories);
router.get("/:id", authMiddleware, categoryController.getCategoryById);

// Admin-only write routes
router.use(authMiddleware, roleMiddleware("ADMIN"));
router.post(
  "/",
  validate(createCategorySchema),
  categoryController.createCategory,
);
router.patch(
  "/:id",
  validate(updateCategorySchema),
  categoryController.updateCategory,
);
router.put(
  "/:id",
  validate(updateCategorySchema),
  categoryController.updateCategory,
);
router.delete("/:id", categoryController.deleteCategory);

export default router;
