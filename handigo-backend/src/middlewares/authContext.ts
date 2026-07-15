import { Request } from "express";
import type { JwtPayload } from "jsonwebtoken";
import type { UserRole } from "../models/user.model";
import { AppError } from "../utils/appError";

export interface AuthenticatedUser extends JwtPayload {
  id: string;
  email: string;
  role: UserRole;
}

export type RequestUser = Pick<AuthenticatedUser, "id" | "role">;

export const requireAuthenticatedUser = (req: Request): AuthenticatedUser => {
  if (!req.user) {
    throw new AppError("Vui lòng đăng nhập để tiếp tục", 401);
  }

  return req.user;
};

export const requireRequestUser = (req: Request): RequestUser => {
  const { id, role } = requireAuthenticatedUser(req);

  return { id, role };
};
