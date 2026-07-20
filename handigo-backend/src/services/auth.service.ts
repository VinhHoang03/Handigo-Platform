import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import User, { IUser } from "../models/user.model";
import { Session } from "../models/session.model";
import { Wallet } from "../models/wallet.model";
import { generateOtp, getOtpExpireDate, hashOtp } from "../utils/otp";
import { sendOtpEmail } from "../utils/mail";
import {
  getRefreshSecret,
  signAccessToken,
  signRefreshToken,
} from "../utils/token";
import { AppError } from "../utils/appError";
import {
  getVietnamesePhoneLookupValues,
  isValidPersonName,
  normalizeExternalPersonName,
} from "../utils/profileValidation";

const SALT_ROUNDS = 10;

const getGoogleClientIds = (): string[] => {
  const configuredClientIds = [
    process.env.GOOGLE_CLIENT_ID,
    ...(process.env.NODE_ENV === "production"
      ? []
      : [process.env.GOOGLE_CLIENT_ID_DEVELOPMENT]),
    ...(process.env.GOOGLE_CLIENT_IDS || "").split(","),
  ]
    .map((clientId) => clientId?.trim())
    .filter((clientId): clientId is string => Boolean(clientId));

  const clientIds = Array.from(new Set(configuredClientIds));

  if (clientIds.length === 0) {
    throw new AppError("Chưa cấu hình Google OAuth Client ID", 500);
  }

  return clientIds;
};

const getFacebookAppCredentials = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const appId = isProduction
    ? process.env.FACEBOOK_APP_ID
    : process.env.FACEBOOK_APP_ID_DEVELOPMENT || process.env.FACEBOOK_APP_ID;
  const appSecret = isProduction
    ? process.env.FACEBOOK_APP_SECRET
    : process.env.FACEBOOK_APP_SECRET_DEVELOPMENT ||
      process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new AppError("Chưa cấu hình thông tin ứng dụng Facebook", 500);
  }

  return { appId, appSecret };
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
  providerOnboardingStatus?: string | null;
  providerOnboardingStep?: number | null;
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

type GoogleLoginPayload = {
  credential?: string;
  accessToken?: string;
};

type GoogleProfile = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string | null;
};

type GoogleTokenInfoResponse = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
};

type GoogleUserInfoResponse = {
  name?: string;
  picture?: string;
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
  const sessionObjectId = sessionId
    ? new Types.ObjectId(sessionId)
    : new Types.ObjectId();
  const refreshToken = signRefreshToken(user, sessionObjectId.toString());
  const refreshTokenExpiresAt = getJwtExpiresAt(refreshToken);
  await Session.updateOne(
    { _id: sessionObjectId, userId: user._id },
    {
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiresAt,
      revokedAt: null,
      isDeleted: false,
      deletedAt: null,
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  return {
    token: signAccessToken(user),
    refreshToken,
    refreshTokenExpiresAt,
  };
};

const toAuthUserResponse = (user: IUser): AuthUserResponse => ({
  id: user._id.toString(),
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  status: user.status,
  isEmailVerified: user.isEmailVerified,
  providerOnboardingStatus: user.providerOnboardingStatus,
  providerOnboardingStep: user.providerOnboardingStep,
});


const ensureWalletForUser = async (userId: Types.ObjectId | string): Promise<void> => {
  await Wallet.updateOne(
    { userId },
    {
      $setOnInsert: {
        userId,
        balance: 0,
        pendingBalance: 0,
        currency: "VND",
      },
      $set: {
        isDeleted: false,
        deletedAt: null,
      },
    },
    { upsert: true },
  );
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
  registrationType?: "CUSTOMER" | "PROVIDER";
}): Promise<void> => {
  const existingUser = await User.findOne({ email: payload.email });

  if (existingUser?.isEmailVerified) {
    throw new AppError("Email is already registered", 409);
  }

  if (payload.phone) {
    const phoneOwner = await User.exists({
      ...(existingUser ? { _id: { $ne: existingUser._id } } : {}),
      phone: { $in: getVietnamesePhoneLookupValues(payload.phone) },
    });
    if (phoneOwner) {
      throw new AppError("Số điện thoại đã được sử dụng", 409);
    }
  }

  const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

  if (existingUser) {
    existingUser.passwordHash = passwordHash;
    existingUser.fullName = payload.fullName;
    existingUser.phone = payload.phone;
    existingUser.status = "active";
    existingUser.registrationIntent = payload.registrationType || "CUSTOMER";
    try {
      await ensureWalletForUser(existingUser._id as Types.ObjectId);
      await createAndSendRegisterOtp(existingUser);
    } catch (error: any) {
      if (error?.code === 11000 && error?.keyPattern?.phone) {
        throw new AppError("Số điện thoại đã được sử dụng", 409);
      }
      throw error;
    }
    return;
  }

  let user;
  try {
    user = await User.create({
      email: payload.email,
      passwordHash,
      fullName: payload.fullName,
      phone: payload.phone,
      role: "CUSTOMER",
      registrationIntent: payload.registrationType || "CUSTOMER",
      status: "active",
      isEmailVerified: false,
    });
  } catch (error: any) {
    if (error?.code === 11000 && error?.keyPattern?.phone) {
      throw new AppError("Số điện thoại đã được sử dụng", 409);
    }
    throw error;
  }

  await ensureWalletForUser(user._id as Types.ObjectId);
  await createAndSendRegisterOtp(user);
};

export const verifyRegisterOtp = async (
  email: string,
  otp: string,
): Promise<(AuthTokens & { user: AuthUserResponse }) | null> => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  if (user.isEmailVerified) {
    throw new AppError("Email is already verified", 409);
  }

  ensureOtpValid(otp, user.registerOtp, user.registerOtpExpire);

  const isProviderRegistration = user.registrationIntent === "PROVIDER";
  user.isEmailVerified = true;
  user.role = isProviderRegistration ? "PROVIDER" : "CUSTOMER";
  user.providerOnboardingStatus = isProviderRegistration
    ? "PROFILE_INCOMPLETE"
    : null;
  user.providerOnboardingStep = isProviderRegistration ? 1 : null;
  user.registrationIntent = undefined;
  user.registerOtp = undefined;
  user.registerOtpExpire = undefined;
  await user.save();

  if (!isProviderRegistration) return null;

  const tokens = await issueSessionTokens(user);
  return { ...tokens, user: toAuthUserResponse(user) };
};

export const resendRegisterOtp = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
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

  if (user.status === "locked") {
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
    user: toAuthUserResponse(user),
  };
};

const isGoogleEmailVerified = (value: unknown): boolean =>
  value === true || value === "true";

const getGoogleProfileFromCredential = async (
  credential: string,
): Promise<GoogleProfile> => {
  const clientIds = getGoogleClientIds();
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientIds,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new AppError(
      "Google login failed: invalid or unverified Google account",
      400,
    );
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
  };
};

const getGoogleProfileFromAccessToken = async (
  accessToken: string,
): Promise<GoogleProfile> => {
  const clientIds = getGoogleClientIds();

  try {
    const tokenInfoResponse = await axios.get<GoogleTokenInfoResponse>(
      "https://oauth2.googleapis.com/tokeninfo",
      { params: { access_token: accessToken } },
    );
    const tokenInfo = tokenInfoResponse.data;

    if (
      !tokenInfo.aud ||
      !clientIds.includes(tokenInfo.aud) ||
      !tokenInfo.sub ||
      !tokenInfo.email ||
      !isGoogleEmailVerified(tokenInfo.email_verified)
    ) {
      throw new AppError(
        "Google login failed: invalid or unverified Google account",
        400,
      );
    }

    const userInfoResponse = await axios.get<GoogleUserInfoResponse>(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return {
      googleId: tokenInfo.sub,
      email: tokenInfo.email,
      emailVerified: true,
      name: userInfoResponse.data.name,
      picture: userInfoResponse.data.picture,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError("Google login failed: unable to verify access token", 400);
  }
};

export const googleLogin = async (payload: GoogleLoginPayload) => {
  const googleProfile = payload.credential
    ? await getGoogleProfileFromCredential(payload.credential)
    : payload.accessToken
      ? await getGoogleProfileFromAccessToken(payload.accessToken)
      : null;

  if (!googleProfile?.email || !googleProfile.emailVerified) {
    throw new AppError(
      "Google login failed: invalid or unverified Google account",
      400,
    );
  }

  const { googleId, email, name, picture } = googleProfile;
  const normalizedEmail = email.toLowerCase();
  const user = await User.findOne({
    isDeleted: false,
    $or: [{ googleId }, { email: normalizedEmail }],
  });

  if (user && user.status === "locked") {
    throw new AppError("Account is not allowed to login", 403);
  }

  let authenticatedUser = user;

  if (!authenticatedUser) {
    const randomPassword = randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

    authenticatedUser = await User.create({
      email: normalizedEmail,
      googleId,
      fullName: normalizeExternalPersonName(name),
      passwordHash,
      avatar: picture,
      role: "CUSTOMER",
      status: "active",
      isEmailVerified: true,
    });
  } else {
    authenticatedUser.googleId = googleId;
    authenticatedUser.isEmailVerified = true;
    if (!isValidPersonName(authenticatedUser.fullName)) {
      authenticatedUser.fullName = normalizeExternalPersonName(
        authenticatedUser.fullName || name,
      );
    }
    if (picture) {
      authenticatedUser.avatar = picture;
    }
    await authenticatedUser.save();
  }

  await ensureWalletForUser(authenticatedUser._id as Types.ObjectId);

  const tokens = await issueSessionTokens(authenticatedUser);

  return {
    ...tokens,
    user: toAuthUserResponse(authenticatedUser),
  };
};

export const facebookLogin = async (accessToken: string) => {
  const { appId, appSecret } = getFacebookAppCredentials();

  // Verify token with Facebook Graph API
  const appToken = `${appId}|${appSecret}`;
  const debugRes = await axios.get("https://graph.facebook.com/debug_token", {
    params: { input_token: accessToken, access_token: appToken },
  });

  const { app_id, is_valid, user_id, error } = debugRes.data?.data ?? {};
  if (!is_valid || !user_id || app_id !== appId) {
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

  const normalizedEmail = email.toLowerCase();
  const existingUser = await User.findOne({
    isDeleted: false,
    $or: [{ facebookId: user_id }, { email: normalizedEmail }],
  });

  if (existingUser && existingUser.status === "locked") {
    throw new AppError("Account is not allowed to login", 403);
  }

  let authenticatedUser = existingUser;

  if (!authenticatedUser) {
    const randomPassword = randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

    authenticatedUser = await User.create({
      email: normalizedEmail,
      facebookId: user_id,
      fullName: normalizeExternalPersonName(name),
      passwordHash,
      avatar: picture?.data?.url ?? null,
      role: "CUSTOMER",
      status: "active",
      isEmailVerified: true,
    });
  } else {
    let shouldSave = false;
    if (authenticatedUser.facebookId !== user_id) {
      authenticatedUser.facebookId = user_id;
      shouldSave = true;
    }
    if (!authenticatedUser.isEmailVerified) {
      authenticatedUser.isEmailVerified = true;
      shouldSave = true;
    }
    if (!isValidPersonName(authenticatedUser.fullName)) {
      authenticatedUser.fullName = normalizeExternalPersonName(
        authenticatedUser.fullName || name,
      );
      shouldSave = true;
    }
    if (shouldSave) {
      await authenticatedUser.save();
    }
  }

  await ensureWalletForUser(authenticatedUser._id as Types.ObjectId);

  const tokens = await issueSessionTokens(authenticatedUser);

  return {
    ...tokens,
    user: toAuthUserResponse(authenticatedUser),
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
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  ensureOtpValid(otp, user.resetPasswordOtp, user.resetPasswordOtpExpire);

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  user.resetPasswordOtp = undefined;
  user.resetPasswordOtpExpire = undefined;
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date() },
  );
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
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  const session = await Session.findOne({
    _id: decoded.sessionId,
    userId: user._id,
    refreshTokenHash: hashRefreshToken(refreshToken),
    revokedAt: null,
    expiresAt: { $gt: new Date() },
    isDeleted: false,
  });

  if (!session) {
    throw new AppError("Refresh session is invalid or expired", 401);
  }

  if (user.status === "locked") {
    await Session.findByIdAndUpdate(session._id, { revokedAt: new Date() });
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

    await Session.findOneAndUpdate(
      {
        _id: decoded.sessionId,
        userId: decoded.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      { revokedAt: new Date() },
    );
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
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  if (!user.passwordHash) {
    throw new AppError("Password login is not available for this account", 400);
  }

  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash,
  );

  if (!isPasswordValid) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();

  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { revokedAt: new Date() },
  );
};

export const getCurrentUser = async (
  userId: string,
): Promise<Partial<IUser>> => {
  const user = await User.findById(userId).select(
    "-passwordHash -registerOtp -resetPasswordOtp",
  );

  if (!user) {
    throw new AppError("Không tìm thấy người dùng", 404);
  }

  return user;
};
