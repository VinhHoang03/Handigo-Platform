import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import type { AuthenticatedUser } from "./authContext";

const getAccessSecret = (): string => {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Chưa cấu hình ACCESS_TOKEN_SECRET hoặc JWT_SECRET.");
  }

  return secret;
};

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Chưa xác thực, thiếu mã truy cập" });
  }

  try {
    const decoded = jwt.verify(token, getAccessSecret()) as AuthenticatedUser;
    User.findOne({ _id: decoded.id, isDeleted: false })
      .then((user) => {
        if (!user) {
          return res.status(401).json({ message: "Không tìm thấy người dùng hoặc người dùng đã bị xóa" });
        }

        if (user.status === "locked") {
          return res.status(403).json({ message: "Tài khoản đã bị khóa" });
        }

        req.user = {
          ...decoded,
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        };
        next();
      })
      .catch((error) => next(error));
  } catch (error) {
    return res.status(401).json({ message: "Mã truy cập không hợp lệ hoặc đã hết hạn" });
  }
};
