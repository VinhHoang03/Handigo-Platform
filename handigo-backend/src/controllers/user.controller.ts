import { Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import {
  getProfileService,
  updateProfileService,
} from "../services/user.service";

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUser(req).id;
    const user = await getProfileService(userId);
    return res.json({
      message: "User profile",
      user,
    });
  } catch (error: any) {
    return res.status(404).json({ message: error.message || "Không tìm thấy người dùng" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUser(req).id;
    const user = await updateProfileService(userId, req.body);

    res.json({
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error: any) {
    res.status(error?.statusCode || 500).json({
      message: error?.message || "Cập nhật hồ sơ thất bại",
    });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await require("../services/user.service").getAllUsersService(req.query);
    return res.json({ message: "List of users", data: users });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Failed to fetch users" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const user = await require("../services/user.service").getUserByIdService(id);
    return res.json({ message: "User detailed", data: user });
  } catch (error: any) {
    return res.status(404).json({ message: error.message || "Không tìm thấy người dùng" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const user = await require("../services/user.service").updateUserService(id, req.body);
    return res.json({ message: "User updated", data: user });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Failed to update user" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await require("../services/user.service").deleteUserService(id);
    return res.json({ message: "User deleted" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Failed to delete user" });
  }
};
