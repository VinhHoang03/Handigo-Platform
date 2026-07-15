import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import type { AuthenticatedUser } from "./authContext";

const getAccessSecret = (): string => {
  const secret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET or JWT_SECRET is not defined.");
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
    return res.status(401).json({ message: "Unauthorized, missing token" });
  }

  try {
    const decoded = jwt.verify(token, getAccessSecret()) as AuthenticatedUser;
    User.findOne({ _id: decoded.id, isDeleted: false })
      .then((user) => {
        if (!user) {
          return res.status(401).json({ message: "Không tìm thấy người dùng hoặc người dùng đã bị xóa" });
        }

        if (user.status === "locked") {
          return res.status(403).json({ message: "Account is locked" });
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
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
