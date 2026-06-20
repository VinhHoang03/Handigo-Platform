import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
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

// Standard CRUD endpoints
// Notice: In a real app, these should ideally be protected by admin roles using `roleMiddleware` or similar.
router.get("/", authMiddleware, getAllUsers);
router.get("/:id", authMiddleware, getUserById);
router.put("/:id", authMiddleware, updateUser);
router.delete("/:id", authMiddleware, deleteUser);

export default router;
