import { Request, Response, NextFunction } from "express";

export const roleMiddleware = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập chức năng này" });
    }
    next();
  };
};
