import { Router } from "express";
import {
  createCertificate,
  deleteCertificate,
  getMyProfile,
  getFeaturedProviders,
  submitIdentity,
  updateCertificate,
  updateMyProfile,
} from "../controllers/providerProfile.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";

const router = Router();

router.get("/featured", getFeaturedProviders);
router.use(authMiddleware, roleMiddleware("PROVIDER"));

router.get("/me", getMyProfile);
router.patch("/me", updateMyProfile);
router.post("/me/identity", submitIdentity);
router.post("/me/certificates", createCertificate);
router.patch("/me/certificates/:certificateId", updateCertificate);
router.delete("/me/certificates/:certificateId", deleteCertificate);

export default router;
