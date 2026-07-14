import { Router } from "express";
import * as locationController from "../controllers/location.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  currentLocationSchema,
  reverseGeocodeQuerySchema,
} from "../validations/location.validator";

const router = Router();

router.use(authMiddleware);
router.get(
  "/reverse-geocode",
  validate(reverseGeocodeQuerySchema, "query"),
  locationController.reverseGeocodeCurrentLocation,
);
router.get("/me", locationController.getCurrentLocation);
router.put(
  "/me",
  validate(currentLocationSchema),
  locationController.updateCurrentLocation,
);

export default router;
