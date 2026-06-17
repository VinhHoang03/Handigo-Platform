import { Router } from "express";
import * as vietnamAddressController from "../controllers/vietnamAddress.controller";

const router = Router();

router.get("/provinces", vietnamAddressController.getProvinces);
router.get(
  "/provinces/:provinceCode/wards",
  vietnamAddressController.getWardsByProvince,
);

export default router;
