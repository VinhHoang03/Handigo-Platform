import { Request, Response } from "express";
import { requireAuthenticatedUser } from "../middlewares/authContext";
import {
  deleteUserService,
  getAllUsersService,
  getUserByIdService,
  getProfileService,
  updateUserService,
  updateProfileService,
} from "../services/user.service";

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUser(req).id;
    const user = await getProfileService(userId);
    return res.json({
      message: "Thông tin hồ sơ người dùng",
      user,
    });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || "Không thể tải hồ sơ người dùng",
    });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = requireAuthenticatedUser(req).id;
    const user = await updateProfileService(userId, req.body);

    res.json({
      message: "Cập nhật hồ sơ thành công",
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
    const users = await getAllUsersService(req.query);
    return res.json({ message: "Danh sách người dùng", data: users });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || "Không thể tải danh sách người dùng",
    });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = await getUserByIdService(id);
    return res.json({ message: "Chi tiết người dùng", data: user });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || "Không thể tải thông tin người dùng",
    });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = await updateUserService(id, req.body);
    return res.json({ message: "Cập nhật người dùng thành công", data: user });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || "Không thể cập nhật người dùng",
    });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const adminId = requireAuthenticatedUser(req).id;
    await deleteUserService(id, adminId);
    return res.json({ message: "Xóa người dùng thành công" });
  } catch (error: any) {
    return res.status(error?.statusCode || 500).json({
      message: error?.message || "Không thể xóa người dùng",
    });
  }
};
