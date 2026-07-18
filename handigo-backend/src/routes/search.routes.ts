import { Router } from "express";
import { search } from "../controllers/search.controller";
import { validate } from "../middlewares/validate.middleware";
import { searchQuerySchema } from "../validations/search.validator";
import { resourceIntensiveRateLimit } from "../middlewares/rateLimit.middleware";

const router = Router();

router.get(
  "/",
  resourceIntensiveRateLimit,
  validate(searchQuerySchema, "query"),
  search,
);

export default router;
