import { Router } from "express";
import {
  createSuggestion,
  getSuggestionById,
  getSuggestions,
  updateSuggestionStatus,
} from "../controllers/serviceSuggestion.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";

const router = Router();

router.post(
  "/",
  authMiddleware,
  roleMiddleware("PROVIDER"),
  createSuggestion,
);

router.use(authMiddleware, roleMiddleware("ADMIN"));

router.get("/", getSuggestions);
router.get("/:id", getSuggestionById);
router.patch("/:id", updateSuggestionStatus);

export default router;
