import { Types } from "mongoose";
import { Wallet } from "../models/wallet.model";
import { AppError } from "../utils/appError";
import { getNumberConfigValue } from "./systemConfig.service";

export const PROVIDER_MINIMUM_WALLET_BALANCE_CONFIG_KEY =
  "PROVIDER_MINIMUM_WALLET_BALANCE";
export const DEFAULT_PROVIDER_MINIMUM_WALLET_BALANCE = 100_000;

export const getProviderMinimumWalletBalance = async () => {
  const configuredBalance = await getNumberConfigValue(
    PROVIDER_MINIMUM_WALLET_BALANCE_CONFIG_KEY,
    DEFAULT_PROVIDER_MINIMUM_WALLET_BALANCE,
  );

  return Math.max(Math.round(configuredBalance), 0);
};

export const getEligibleProviderUserIds = async () => {
  const minimumBalance = await getProviderMinimumWalletBalance();
  const wallets = await Wallet.find({
    balance: { $gte: minimumBalance },
    isDeleted: false,
  })
    .select("userId")
    .lean();

  return wallets.map((wallet) => wallet.userId as Types.ObjectId);
};

export const assertProviderWalletEligible = async (
  providerUserId: string | Types.ObjectId,
) => {
  const minimumBalance = await getProviderMinimumWalletBalance();
  const wallet = await Wallet.findOne({
    userId: providerUserId,
    balance: { $gte: minimumBalance },
    isDeleted: false,
  }).select("balance");

  if (!wallet) {
    throw new AppError(
      `Số dư ví cần tối thiểu ${minimumBalance.toLocaleString("vi-VN")}đ để nhận đơn mới.`,
      409,
    );
  }

  return wallet;
};
