import { Router } from "express";
import * as newsArticleController from "../controllers/newsArticle.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createNewsArticleSchema,
  updateNewsArticleSchema,
} from "../validations/newsArticle.validator";

const router = Router();

router.get("/", newsArticleController.listPublished);
router.get(
  "/admin/list",
  authMiddleware,
  roleMiddleware("ADMIN"),
  newsArticleController.listAdmin,
);
router.post(
  "/",
  authMiddleware,
  roleMiddleware("ADMIN"),
  validate(createNewsArticleSchema),
  newsArticleController.create,
);
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN"),
  validate(updateNewsArticleSchema),
  newsArticleController.update,
);
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("ADMIN"),
  newsArticleController.remove,
);
router.get("/:slug", newsArticleController.getPublished);

export default router;
