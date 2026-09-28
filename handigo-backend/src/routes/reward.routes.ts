import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { redeemRewardSchema } from "../validations/reward.validator";
import { getOverview, getHistory, getMyVouchers, redeem } from "../controllers/reward.controller";

const router = Router();
router.use(authMiddleware, roleMiddleware("CUSTOMER"));
router.get("/me", getOverview);
router.get("/history", getHistory);
router.get("/vouchers", getMyVouchers);
router.post("/redeem", validate(redeemRewardSchema), redeem);
export default router;
