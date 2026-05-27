import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Kiểm tra nhiều tên biến có thể có
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;

if (!ACCESS_SECRET) {
  throw new Error("ACCESS_TOKEN_SECRET (hoặc JWT_SECRET/JWT_ACCESS_SECRET/TOKEN_SECRET) chưa được định nghĩa trong biến môi trường.");
}

interface DecodedToken extends jwt.JwtPayload {
  id: string;
  username: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // Lấy token từ header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Không được phép truy cập, thiếu token" });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as DecodedToken;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};