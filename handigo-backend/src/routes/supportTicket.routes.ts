import { Router } from "express";
import * as supportTicketController from "../controllers/supportTicket.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  addSupportTicketResponseSchema,
  createSupportTicketSchema,
  supportTicketIdSchema,
  supportTicketListQuerySchema,
} from "../validations/supportTicket.validator";

const router = Router();

router.use(authMiddleware);

router.post(
  "/",
  roleMiddleware("CUSTOMER", "PROVIDER"),
  validate(createSupportTicketSchema),
  supportTicketController.createSupportTicket,
);
router.get(
  "/me",
  validate(supportTicketListQuerySchema, "query"),
  supportTicketController.getMySupportTickets,
);
router.get(
  "/:id",
  validate(supportTicketIdSchema, "params"),
  supportTicketController.getSupportTicketForUser,
);
router.post(
  "/:id/responses",
  validate(supportTicketIdSchema, "params"),
  validate(addSupportTicketResponseSchema),
  supportTicketController.addSupportTicketResponse,
);
router.patch(
  "/:id/cancel",
  validate(supportTicketIdSchema, "params"),
  supportTicketController.cancelSupportTicket,
);

export default router;
