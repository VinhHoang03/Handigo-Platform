import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createRateLimit } from "../../middlewares/rateLimit.middleware";
import { featureSchema, saveConfigSchema, activateSchema, runSchema, correctionSchema } from "./admin-ai.validation";
import * as controller from "./admin-ai.controller";
import { complaintDecisionSchema } from "./admin-ai.complaint-schema";

const router = Router();
const featureParams = z.object({ feature: featureSchema });
const idParams = z.object({ id: z.string().regex(/^[a-f\d]{24}$/, "Mã kết quả AI không hợp lệ.") });
const limit = createRateLimit({ windowMs: 60000, maxRequests: 20, keyGenerator: req => req.user!.id, message: "Bạn thao tác AI quá nhanh. Vui lòng thử lại sau." });
router.use(authMiddleware, roleMiddleware("ADMIN"));
router.get("/configs", controller.configs);
router.get("/sources", validate(z.object({
  type: z.enum(["provider_application", "service_suggestion", "complaint", "report", "support_ticket"]),
  email: z.string().trim().max(254, "Email không được vượt quá 254 ký tự.").email("Vui lòng nhập email hợp lệ.").optional(),
}).refine(input => !input.email || input.type === "provider_application", { message: "Tìm theo email chỉ áp dụng cho hồ sơ đăng ký thợ." }), "query"), controller.sources);
router.put("/configs/:feature", limit, validate(featureParams, "params"), validate(saveConfigSchema), controller.saveConfig);
router.post("/configs/:feature/activation", limit, validate(featureParams, "params"), validate(activateSchema), controller.activate);
router.get("/configs/:feature/history", validate(featureParams, "params"), controller.history);
router.post("/assessments", limit, validate(runSchema), controller.run);
router.get("/assessments", validate(z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), feature: featureSchema.optional(), status: z.enum(["queued", "running", "retry", "completed", "manual", "stale", "error"]).optional(), sourceId: z.string().max(100).optional() }), "query"), controller.assessments);
router.get("/assessments/:id", validate(z.object({ id: z.string().regex(/^[a-f\d]{24}$/, "Mã kết quả AI không hợp lệ.") }), "params"), controller.assessment);
router.get("/assessments/:id/classification", validate(idParams, "params"), controller.classification);
router.post("/assessments/:id/complaint-decision", limit, validate(idParams, "params"), validate(complaintDecisionSchema), controller.complaintDecision);
router.patch("/assessments/:id/classification", limit, validate(idParams, "params"), validate(correctionSchema), controller.correct);
export default router;
