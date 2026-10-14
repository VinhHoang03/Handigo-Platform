import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { redeemRewardSchema, rewardOfferSchema } from "../validations/reward.validator";
import { getOverview, getHistory, getMyVouchers, redeem, getAdminOffers, saveAdminOffer } from "../controllers/reward.controller";

const router = Router();
router.use(authMiddleware);
router.get("/admin/offers", roleMiddleware("ADMIN"), getAdminOffers);
router.put("/admin/offers", roleMiddleware("ADMIN"), validate(rewardOfferSchema), saveAdminOffer);
router.use(roleMiddleware("CUSTOMER"));
router.get("/me", getOverview);
router.get("/history", getHistory);
router.get("/vouchers", getMyVouchers);
router.post("/redeem", validate(redeemRewardSchema), redeem);
export default router;
