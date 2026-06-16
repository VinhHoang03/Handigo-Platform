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

router.use(authMiddleware, roleMiddleware("ADMIN"));
router.get("/", categoryController.listCategories);
router.get("/:id", categoryController.getCategoryById);
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

router.get("/", categoryController.getActiveCategories);

export default router;
