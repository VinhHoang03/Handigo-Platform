import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import User, { IUser } from "../models/user.model";
import { generateOtp, getOtpExpireDate, hashOtp } from "../utils/otp";
import { sendOtpEmail } from "../utils/mail";
import {
  getRefreshSecret,
  signAccessToken,
  signRefreshToken,
} from "../utils/token";
import { AppError } from "../utils/appError";

const SALT_ROUNDS = 10;

const getGoogleClient = (): OAuth2Client => {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    throw new AppError("GOOGLE_CLIENT_ID is not configured", 500);
  }

  return new OAuth2Client(clientId);
};

type AuthUserResponse = {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  avatar?: string | null;
  role: string;
  status: string;
  isEmailVerified: boolean;
};

type RefreshTokenPayload = jwt.JwtPayload & {
  id: string;
  sessionId: string;
};

type AuthTokens = {
  token: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

const ensureOtpValid = (
  otp: string,
  storedOtp?: string,
  expireDate?: Date,
): void => {
  if (!storedOtp || !expireDate) {
    throw new AppError("OTP is not available or has expired", 400);
  }

  if (expireDate.getTime() < Date.now()) {
    throw new AppError("OTP has expired", 400);
  }

  if (storedOtp !== hashOtp(otp)) {
    throw new AppError("Invalid OTP", 400);
  }
};

const hashRefreshToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

const getJwtExpiresAt = (token: string): Date => {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;

  if (!decoded?.exp) {
    throw new AppError("Invalid refresh token expiry", 500);
  }

  return new Date(decoded.exp * 1000);
};

const issueSessionTokens = async (
  user: IUser,
  sessionId?: string,
): Promise<AuthTokens> => {
  user.sessions = user.sessions || [];

  const sessionObjectId = sessionId
    ? new Types.ObjectId(sessionId)
    : new Types.ObjectId();
  let session = user.sessions.find(
    (item) => item._id.toString() === sessionObjectId.toString(),
  );

  if (!session) {
    session = {
      _id: sessionObjectId,
      refreshTokenHash: "pending",
      expiresAt: new Date(),
      createdAt: new Date(),
    };
    user.sessions.push(session);
  }

  const refreshToken = signRefreshToken(user, sessionObjectId.toString());
  const refreshTokenExpiresAt = getJwtExpiresAt(refreshToken);

  session.refreshTokenHash = hashRefreshToken(refreshToken);
  session.expiresAt = refreshTokenExpiresAt;
  session.revokedAt = undefined;
  await user.save();

  return {
    token: signAccessToken(user),
    refreshToken,
    refreshTokenExpiresAt,
  };
};

const createAndSendRegisterOtp = async (user: IUser): Promise<void> => {
  const otp = generateOtp();
  user.registerOtp = hashOtp(otp);
  user.registerOtpExpire = getOtpExpireDate();
  await user.save();

  await sendOtpEmail(user.email, "Verify your Handigo account", otp);
};

export const register = async (payload: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<void> => {
  const existingUser = await User.findOne({ email: payload.email });

  if (existingUser?.isEmailVerified) {
    throw new AppError("Email is already registered", 409);
  }

  const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

  if (existingUser) {
    existingUser.passwordHash = passwordHash;
    existingUser.fullName = payload.fullName;
    existingUser.phone = payload.phone;
    existingUser.status = "UNLOCK";
    await createAndSendRegisterOtp(existingUser);
    return;
  }

  const user = await User.create({
    email: payload.email,
    passwordHash,
    fullName: payload.fullName,
    phone: payload.phone,
    role: "CUSTOMER",
    status: "UNLOCK",
    isEmailVerified: false,
  });

  await createAndSendRegisterOtp(user);
};

export const verifyRegisterOtp = async (
  email: string,
  otp: string,
): Promise<void> => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.isEmailVerified) {
    throw new AppError("Email is already verified", 409);
  }

  ensureOtpValid(otp, user.registerOtp, user.registerOtpExpire);

  user.isEmailVerified = true;
  user.registerOtp = undefined;
  user.registerOtpExpire = undefined;
  await user.save();
};

export const resendRegisterOtp = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.isEmailVerified) {
    throw new AppError("Email is already verified", 409);
  }

  await createAndSendRegisterOtp(user);
};

export const login = async (
  email: string,
  password: string,
): Promise<AuthTokens & { user: AuthUserResponse }> => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (user.status === "LOCK") {
    throw new AppError("Account is not allowed to login", 403);
  }

  if (!user.isEmailVerified) {
    throw new AppError("Email is not verified", 403);
  }

  if (!user.passwordHash) {
    throw new AppError("Password login is not available for this account", 400);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("Invalid email or password", 401);
  }

  const tokens = await issueSessionTokens(user);

  return {
    ...tokens,
    user: {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      isEmailVerified: user.isEmailVerified,
    },
  };
};

export const googleLogin = async (googleToken: string) => {
  const client = getGoogleClient();
  const ticket = await client.verifyIdToken({
    idToken: googleToken,
    audience: process.env.GOOGLE_CLIENT_ID as string,
  });

  const payload = ticket.getPayload();
  if (!payload?.email || payload.email_verified !== true) {
    throw new AppError(
      "Google login failed: invalid or unverified Google account",
      400,
    );
  }

  const { email, name, picture } = payload;
  const user = await User.findOne({ email });

  if (user && user.status === "LOCK") {
    throw new AppError("Account is not allowed to login", 403);
  }

  let authenticatedUser = user;

  if (!authenticatedUser) {
    const randomPassword = randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

    authenticatedUser = await User.create({
      email,
      fullName: name || email.split("@")[0],
      passwordHash,
      avatar: picture,
      role: "CUSTOMER",
      status: "UNLOCK",
      isEmailVerified: true,
    });
  } else if (!authenticatedUser.isEmailVerified) {
    authenticatedUser.isEmailVerified = true;
    await authenticatedUser.save();
  }

  const tokens = await issueSessionTokens(authenticatedUser);

  return {
    ...tokens,
    user: {
      id: authenticatedUser._id.toString(),
      email: authenticatedUser.email,
      fullName: authenticatedUser.fullName,
      phone: authenticatedUser.phone,
      avatar: authenticatedUser.avatar,
      role: authenticatedUser.role,
      status: authenticatedUser.status,
      isEmailVerified: authenticatedUser.isEmailVerified,
    },
  };
};

export const facebookLogin = async (accessToken: string) => {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new AppError("Facebook app credentials are not configured", 500);
  }

  // Verify token with Facebook Graph API
  const appToken = `${appId}|${appSecret}`;
  const debugRes = await axios.get("https://graph.facebook.com/debug_token", {
    params: { input_token: accessToken, access_token: appToken },
  });

  const { is_valid, user_id, error } = debugRes.data?.data ?? {};
  if (!is_valid || !user_id) {
    throw new AppError(
      `Invalid Facebook access token: ${error?.message || "unknown error"}`,
      400,
    );
  }

  // Get user profile
  const profileRes = await axios.get(`https://graph.facebook.com/${user_id}`, {
    params: {
      fields: "id,name,email,picture.type(large)",
      access_token: accessToken,
    },
  });

  const { email, name, picture } = profileRes.data;

  if (!email) {
    throw new AppError(
      "Tài khoản Facebook không có email. Vui lòng dùng phương thức đăng nhập khác hoặc thêm email vào tài khoản Facebook.",
      400,
    );
  }

  const existingUser = await User.findOne({ email });

  if (existingUser && existingUser.status === "LOCK") {
    throw new AppError("Account is not allowed to login", 403);
  }

  let authenticatedUser = existingUser;

  if (!authenticatedUser) {
    const randomPassword = randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

    authenticatedUser = await User.create({
      email,
      fullName: name || email.split("@")[0],
      passwordHash,
      avatar: picture?.data?.url ?? null,
      role: "CUSTOMER",
      status: "UNLOCK",
      isEmailVerified: true,
    });
  } else if (!authenticatedUser.isEmailVerified) {
    authenticatedUser.isEmailVerified = true;
    await authenticatedUser.save();
  }

  const tokens = await issueSessionTokens(authenticatedUser);

  return {
    ...tokens,
    user: {
      id: authenticatedUser._id.toString(),
      email: authenticatedUser.email,
      fullName: authenticatedUser.fullName,
      phone: authenticatedUser.phone,
      avatar: authenticatedUser.avatar,
      role: authenticatedUser.role,
      status: authenticatedUser.status,
      isEmailVerified: authenticatedUser.isEmailVerified,
    },
  };
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });

  if (!user) {
    return;
  }

  const otp = generateOtp();
  user.resetPasswordOtp = hashOtp(otp);
  user.resetPasswordOtpExpire = getOtpExpireDate();
  await user.save();

  await sendOtpEmail(user.email, "Reset your Handigo password", otp);
};

export const resetPassword = async (
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  ensureOtpValid(otp, user.resetPasswordOtp, user.resetPasswordOtpExpire);

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.resetPasswordOtp = undefined;
  user.resetPasswordOtpExpire = undefined;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  user.sessions.forEach((session) => {
    if (!session.revokedAt) {
      session.revokedAt = new Date();
    }
  });
  await user.save();
};

export const refreshToken = async (
  refreshToken: string,
): Promise<AuthTokens> => {
  let decoded: RefreshTokenPayload;

  try {
    decoded = jwt.verify(
      refreshToken,
      getRefreshSecret(),
    ) as RefreshTokenPayload;
  } catch (error) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  if (!decoded.id || !decoded.sessionId) {
    throw new AppError("Invalid refresh token", 401);
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const session = user.sessions.find(
    (item) =>
      item._id.toString() === decoded.sessionId &&
      item.refreshTokenHash === hashRefreshToken(refreshToken) &&
      !item.revokedAt &&
      item.expiresAt.getTime() > Date.now(),
  );

  if (!session) {
    throw new AppError("Refresh session is invalid or expired", 401);
  }

  if (user.status === "LOCK") {
    session.revokedAt = new Date();
    await user.save();
    throw new AppError("Account is not allowed to login", 403);
  }

  return issueSessionTokens(user, decoded.sessionId);
};

export const logout = async (refreshToken?: string): Promise<void> => {
  if (!refreshToken) {
    return;
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      getRefreshSecret(),
    ) as RefreshTokenPayload;

    if (!decoded.sessionId) {
      return;
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return;
    }

    const session = user.sessions.find(
      (item) =>
        item._id.toString() === decoded.sessionId &&
        item.refreshTokenHash === hashRefreshToken(refreshToken) &&
        !item.revokedAt,
    );

    if (!session) {
      return;
    }

    session.revokedAt = new Date();
    await user.save();
  } catch (error) {
    return;
  }
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.passwordHash) {
    throw new AppError("Password login is not available for this account", 400);
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  user.sessions.forEach((session) => {
    if (!session.revokedAt) {
      session.revokedAt = new Date();
    }
  });
  await user.save();
};

export const getCurrentUser = async (
  userId: string,
): Promise<Partial<IUser>> => {
  const user = await User.findById(userId).select(
    "-passwordHash -registerOtp -resetPasswordOtp -sessions",
  );

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};
