import { Router } from "express";
import { z } from "zod";
import * as controller from "../controllers/promotion.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createPromotionSchema, updatePromotionSchema } from "../validations/promotion.validator";

const router = Router();
const idSchema = z.object({ id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Mã chương trình không hợp lệ.") });
router.get("/active", controller.active);
router.use(authMiddleware, roleMiddleware("ADMIN"));
router.get("/", controller.list);
router.post("/", validate(createPromotionSchema), controller.save);
router.patch("/:id", validate(idSchema, "params"), validate(updatePromotionSchema), controller.save);
router.delete("/:id", validate(idSchema, "params"), controller.remove);
export default router;
