import { Router } from "express";
import {
  createCertificate,
  deleteCertificate,
  getMyProfile,
  getFeaturedProviders,
  getNearbyProviders,
  getPublicProviderProfile,
  submitIdentity,
  updateCertificate,
  updateMyProfile,
} from "../controllers/providerProfile.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { approvedProviderMiddleware } from "../middlewares/approvedProvider.middleware";

const router = Router();

router.get("/featured", getFeaturedProviders);
router.get("/nearby", authMiddleware, roleMiddleware("CUSTOMER"), getNearbyProviders);
router.get("/:providerId/public", getPublicProviderProfile);
router.get("/me", authMiddleware, roleMiddleware("PROVIDER"), getMyProfile);
router.use(authMiddleware, roleMiddleware("PROVIDER"), approvedProviderMiddleware);

router.patch("/me", updateMyProfile);
router.post("/me/identity", submitIdentity);
router.post("/me/certificates", createCertificate);
router.patch("/me/certificates/:certificateId", updateCertificate);
router.delete("/me/certificates/:certificateId", deleteCertificate);

export default router;
