import jwt, { SignOptions } from "jsonwebtoken";
import { IUser } from "../models/user.model";

const getAccessSecret = (): string => {
  return (
    process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || "supersecret"
  );
};

export const getRefreshSecret = (): string => {
  return process.env.REFRESH_TOKEN_SECRET || `${getAccessSecret()}:refresh`;
};

const getTokenExpiresIn = (
  configuredValue: string | undefined,
  fallback: NonNullable<SignOptions["expiresIn"]>,
): NonNullable<SignOptions["expiresIn"]> => {
  const normalizedValue = configuredValue?.trim();
  return normalizedValue
    ? (normalizedValue as NonNullable<SignOptions["expiresIn"]>)
    : fallback;
};

export const signAccessToken = (user: IUser): string => {
  const expiresIn = getTokenExpiresIn(process.env.JWT_EXPIRES_IN, "1d");

  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    },
    getAccessSecret(),
    { expiresIn },
  );
};

export const signRefreshToken = (user: IUser, sessionId: string): string => {
  const expiresIn = getTokenExpiresIn(
    process.env.REFRESH_TOKEN_EXPIRES_IN,
    "7d",
  );

  return jwt.sign(
    {
      id: user._id.toString(),
      sessionId,
    },
    getRefreshSecret(),
    { expiresIn },
  );
};
