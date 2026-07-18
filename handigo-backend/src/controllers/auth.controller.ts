import { CookieOptions, Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import { AppError } from "../utils/appError";

const REFRESH_TOKEN_COOKIE = "refreshToken";
const REMEMBER_LOGIN_COOKIE = "rememberLogin";

// Cookies storing refresh tokens MUST be HttpOnly and set with `sameSite: 'none'` + `secure: true` in
// production so browsers will send them on cross-site XHR/POST requests (frontend and backend
// often run on different origins). For local development we keep `sameSite: 'lax'` and `secure: false`
// to avoid requiring HTTPS, but in production you MUST enable HTTPS and set the frontend origin in
// `FRONTEND_URL` so CORS with credentials works correctly.
const getRefreshTokenCookieOptions = (
  expires: Date,
  remember = true,
): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // `none` in production to allow cross-site cookie; `lax` in dev to be more permissive on localhost
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  ...(remember ? { expires } : {}),
});

const clearRefreshTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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
    const result = await authService.verifyRegisterOtp(req.body.email, req.body.otp);

    if (!result) {
      return res.json({ message: "Xác thực email thành công" });
    }

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt, true),
    );
    res.cookie(
      REMEMBER_LOGIN_COOKIE,
      "true",
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt, true),
    );
    return res.json({
      message: "Xác thực email thành công",
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    return next(error);
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
    const remember = req.body.remember !== false;
    const result = await authService.login(req.body.email, req.body.password);
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt, remember),
    );
    res.cookie(
      REMEMBER_LOGIN_COOKIE,
      String(remember),
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt, remember),
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
    const remember = req.cookies?.[REMEMBER_LOGIN_COOKIE] === "true";
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(result.refreshTokenExpiresAt, remember),
    );
    res.json({
      message: "Token refreshed successfully",
      token: result.token,
    });
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { credential, accessToken, remember } = req.body;
    if (!credential && !accessToken) {
      throw new AppError("Google credential or access token is required", 400);
    }

    const result = await authService.googleLogin({ credential, accessToken });

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(
        result.refreshTokenExpiresAt,
        remember !== false,
      ),
    );
    res.cookie(
      REMEMBER_LOGIN_COOKIE,
      String(remember !== false),
      getRefreshTokenCookieOptions(
        result.refreshTokenExpiresAt,
        remember !== false,
      ),
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

export const facebookLogin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { accessToken, remember } = req.body;
    if (!accessToken)
      throw new AppError("Facebook access token is required", 400);

    const result = await authService.facebookLogin(accessToken);

    res.cookie(
      REFRESH_TOKEN_COOKIE,
      result.refreshToken,
      getRefreshTokenCookieOptions(
        result.refreshTokenExpiresAt,
        remember !== false,
      ),
    );
    res.cookie(
      REMEMBER_LOGIN_COOKIE,
      String(remember !== false),
      getRefreshTokenCookieOptions(
        result.refreshTokenExpiresAt,
        remember !== false,
      ),
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

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    await authService.logout(req.cookies?.[REFRESH_TOKEN_COOKIE]);
    res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshTokenCookieOptions);
    res.clearCookie(REMEMBER_LOGIN_COOKIE, clearRefreshTokenCookieOptions);
    res.clearCookie("token");
    res.json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await authService.getCurrentUser(req.user!.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
};
