import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { roleMiddleware } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateUserProfileSchema } from "../validations/user.validator";
import {
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} from "../controllers/user.controller";

const router = express.Router();

// Profile endpoints
router.get("/me", authMiddleware, getProfile);
router.put(
  "/profile",
  authMiddleware,
  validate(updateUserProfileSchema),
  updateProfile,
);

// Các endpoint legacy chỉ dành cho quản trị viên.
router.use(authMiddleware, roleMiddleware("ADMIN"));
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.put("/:id", validate(updateUserProfileSchema), updateUser);
router.delete("/:id", deleteUser);

export default router;
