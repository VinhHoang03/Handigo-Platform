import { Router } from "express";
import { search } from "../controllers/search.controller";
import { validate } from "../middlewares/validate.middleware";
import { searchQuerySchema } from "../validations/search.validator";

const router = Router();

router.get("/", validate(searchQuerySchema, "query"), search);

export default router;
