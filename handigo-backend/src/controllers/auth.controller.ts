import { CookieOptions, Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { AppError } from "../utils/appError";

const REFRESH_TOKEN_COOKIE = "refreshToken";

const getRefreshTokenCookieOptions = (expires: Date): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  expires,
});

const clearRefreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.register(req.body);
    res.status(201).json({
      message: "Registration OTP has been sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyRegisterOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.verifyRegisterOtp(req.body.email, req.body.otp);
    res.json({ message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
};

export const resendRegisterOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.resendRegisterOtp(req.body.email);
    res.json({ message: "Registration OTP has been resent" });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt),
    );
    res.json({
      message: "Login successful",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      return res.status(401).json({ message: "Missing refresh token" });
    }

    const result = await authService.refreshToken(refreshToken);
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt),
    );
    res.json({
      message: "Token refreshed successfully",
      token: result.token,
    });
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { credential, accessToken } = req.body;
    if (!credential && !accessToken) {
      throw new AppError("Google credential or access token is required", 400);
    }

    const result = await authService.googleLogin({ credential, accessToken });

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt),
    );
    res.status(200).json({
      message: "Google login success",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

export const facebookLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) throw new AppError("Facebook access token is required", 400);

    const result = await authService.facebookLogin(accessToken);

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt),
    );
    res.status(200).json({
      message: "Facebook login success",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.forgotPassword(req.body.email);
    res.json({
      message: "If the email exists, a reset OTP has been sent",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.resetPassword(
      req.body.email,
      req.body.otp,
      req.body.newPassword,
    );
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.cookies?.[REFRESH_TOKEN_COOKIE]);
    res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshTokenCookieOptions);
    res.clearCookie("token");
    res.json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};
