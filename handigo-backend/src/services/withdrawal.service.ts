import mongoose, { ClientSession, Types } from "mongoose";
import { AppError } from "../utils/appError";
import { BankAccount } from "../models/bankAccount.model";
import { Notification } from "../models/notification.model";
import { Provider } from "../models/provider.model";
import { Wallet } from "../models/wallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { WithdrawRequest } from "../models/withdrawRequest.model";
import { getNumberConfigValue } from "./systemConfig.service";
import type {
  CreateWithdrawalInput,
  WithdrawalListQuery,
  WithdrawalReviewInput,
} from "../validations/withdrawal.validation";

type RequestUser = {
  id: string;
  role: string;
};

const buildTransactionCode = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const toObjectId = (id: string | Types.ObjectId) =>
  typeof id === "string" ? new Types.ObjectId(id) : id;

const assertWithdrawalAccess = async (user: RequestUser) => {
  if (!["CUSTOMER", "PROVIDER"].includes(user.role)) {
    throw new AppError("Bạn không có quyền thao tác với ví này", 403);
  }

  if (user.role === "PROVIDER") {
    const provider = await Provider.findOne({ userId: user.id, isDeleted: false });
    if (!provider) {
      throw new AppError("Không tìm thấy hồ sơ nhà cung cấp", 404);
    }
  }
};
const getActiveBankAccount = async (
  userId: string | Types.ObjectId,
  bankAccountId?: string,
) => {
  const filter: Record<string, unknown> = {
    userId,
    status: "active",
    isDeleted: false,
  };

  if (bankAccountId) {
    filter._id = bankAccountId;
  }

  const bankAccount = bankAccountId
    ? await BankAccount.findOne(filter)
    : await BankAccount.findOne({ ...filter, isDefault: true }) ||
      await BankAccount.findOne(filter).sort({ createdAt: -1 });

  if (!bankAccount) {
    throw new AppError("Nhà cung cấp cần có tài khoản ngân hàng để rút tiền", 400);
  }

  return bankAccount;
};

const createNotification = async (
  userId: Types.ObjectId | string,
  title: string,
  content: string,
  data: Record<string, unknown>,
  session?: ClientSession,
) => {
  await Notification.create(
    [
      {
        userId,
        type: "WITHDRAWAL",
        title,
        content,
        data,
      },
    ],
    { session },
  );
};

const buildListResult = async (filter: Record<string, unknown>, query: WithdrawalListQuery) => {
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    WithdrawRequest.find(filter)
      .populate("userId", "fullName email phone")
      .populate("bankAccountId")
      .populate("reviewedBy", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    WithdrawRequest.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const createWithdrawal = async (user: RequestUser, input: CreateWithdrawalInput) => {
  await assertWithdrawalAccess(user);

  if (input.amount <= 0) {
    throw new AppError("Số tiền rút phải lớn hơn 0", 400);
  }

  const minWithdrawAmount = await getNumberConfigValue("MIN_WITHDRAW_AMOUNT", 0);
  const maxWithdrawAmount = await getNumberConfigValue("MAX_WITHDRAW_AMOUNT", 50_000_000);

  if (input.amount < minWithdrawAmount) {
    throw new AppError(
      `Số tiền rút tối thiểu là ${minWithdrawAmount.toLocaleString("vi-VN")} VND`,
      400,
    );
  }

  if (maxWithdrawAmount > 0 && input.amount > maxWithdrawAmount) {
    throw new AppError(
      `Số tiền rút tối đa là ${maxWithdrawAmount.toLocaleString("vi-VN")} VND`,
      400,
    );
  }

  const bankAccount = await getActiveBankAccount(user.id, input.bankAccountId);
  const session = await mongoose.startSession();

  try {
    let createdRequest = null;

    await session.withTransaction(async () => {
      const wallet = await Wallet.findOneAndUpdate(
        {
          userId: user.id,
          isDeleted: false,
          balance: { $gte: input.amount },
        },
        {
          $inc: {
            balance: -input.amount,
            pendingBalance: input.amount,
          },
        },
        { new: true, session },
      );

      if (!wallet) {
        throw new AppError("Số dư ví không đủ để tạo yêu cầu rút tiền", 400);
      }

      const [withdrawal] = await WithdrawRequest.create(
        [
          {
            userId: user.id,
            walletId: wallet._id,
            bankAccountId: bankAccount._id,
            amount: input.amount,
            status: "pending",
          },
        ],
        { session },
      );

      createdRequest = withdrawal;
    });

    return createdRequest;
  } finally {
    await session.endSession();
  }
};

export const getMyWithdrawals = async (user: RequestUser, query: WithdrawalListQuery) => {
  await assertWithdrawalAccess(user);
  const filter: Record<string, unknown> = {
    userId: user.id,
    isDeleted: false,
  };

  if (query.status) {
    filter.status = query.status;
  }

  return buildListResult(filter, query);
};

export const getMyWithdrawalById = async (user: RequestUser, withdrawalId: string) => {
  await assertWithdrawalAccess(user);
  const withdrawal = await WithdrawRequest.findOne({
    _id: withdrawalId,
    userId: user.id,
    isDeleted: false,
  })
    .populate("bankAccountId")
    .populate("reviewedBy", "fullName email");

  if (!withdrawal) {
    throw new AppError("Không tìm thấy yêu cầu rút tiền", 404);
  }

  return withdrawal;
};

export const getAdminWithdrawals = async (query: WithdrawalListQuery) => {
  const filter: Record<string, unknown> = {
    isDeleted: false,
  };

  if (query.status) {
    filter.status = query.status;
  }

  return buildListResult(filter, query);
};

export const getAdminWithdrawalById = async (withdrawalId: string) => {
  const withdrawal = await WithdrawRequest.findOne({
    _id: withdrawalId,
    isDeleted: false,
  })
    .populate("userId", "fullName email phone")
    .populate("bankAccountId")
    .populate("reviewedBy", "fullName email");

  if (!withdrawal) {
    throw new AppError("Không tìm thấy yêu cầu rút tiền", 404);
  }

  return withdrawal;
};

export const approveWithdrawal = async (
  admin: RequestUser,
  withdrawalId: string,
  input: WithdrawalReviewInput,
) => {
  const session = await mongoose.startSession();

  try {
    let approvedRequest = null;

    await session.withTransaction(async () => {
      const withdrawal = await WithdrawRequest.findOne({
        _id: withdrawalId,
        status: "pending",
        isDeleted: false,
      }).session(session);

      if (!withdrawal) {
        throw new AppError("Không tìm thấy yêu cầu rút tiền đang chờ xử lý", 404);
      }

      const wallet = await Wallet.findOneAndUpdate(
        {
          _id: withdrawal.walletId,
          userId: withdrawal.userId,
          isDeleted: false,
          pendingBalance: { $gte: withdrawal.amount },
        },
        { $inc: { pendingBalance: -withdrawal.amount } },
        { new: true, session },
      );

      if (!wallet) {
        throw new AppError("Số dư đang chờ không đủ để duyệt yêu cầu rút tiền", 400);
      }

      await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: withdrawal.userId,
            relatedWithdrawRequestId: withdrawal._id,
            type: "withdraw",
            direction: "out",
            amount: withdrawal.amount,
            balanceAfter: wallet.balance,
            status: "success",
            transactionCode: buildTransactionCode("WITHDRAW"),
            description: "Rút tiền từ ví về tài khoản ngân hàng",
            metadata: {
              adminId: admin.id,
              adminNote: input.adminNote || null,
              bankAccountId: withdrawal.bankAccountId,
            },
          },
        ],
        { session },
      );

      withdrawal.status = "approved";
      withdrawal.reviewedBy = toObjectId(admin.id);
      withdrawal.reviewedAt = new Date();
      withdrawal.adminNote = input.adminNote || null;
      await withdrawal.save({ session });

      await createNotification(
        withdrawal.userId,
        "Yêu cầu rút tiền đã được duyệt",
        `Yêu cầu rút ${withdrawal.amount.toLocaleString("vi-VN")} VND của bạn đã được duyệt.`,
        {
          withdrawalId: withdrawal._id,
          amount: withdrawal.amount,
          status: "approved",
        },
        session,
      );

      approvedRequest = withdrawal;
    });

    return approvedRequest;
  } finally {
    await session.endSession();
  }
};

export const rejectWithdrawal = async (
  admin: RequestUser,
  withdrawalId: string,
  input: WithdrawalReviewInput,
) => {
  const session = await mongoose.startSession();

  try {
    let rejectedRequest = null;

    await session.withTransaction(async () => {
      const withdrawal = await WithdrawRequest.findOne({
        _id: withdrawalId,
        status: "pending",
        isDeleted: false,
      }).session(session);

      if (!withdrawal) {
        throw new AppError("Không tìm thấy yêu cầu rút tiền đang chờ xử lý", 404);
      }

      const wallet = await Wallet.findOneAndUpdate(
        {
          _id: withdrawal.walletId,
          userId: withdrawal.userId,
          isDeleted: false,
          pendingBalance: { $gte: withdrawal.amount },
        },
        {
          $inc: {
            pendingBalance: -withdrawal.amount,
            balance: withdrawal.amount,
          },
        },
        { new: true, session },
      );

      if (!wallet) {
        throw new AppError("Số dư đang chờ không đủ để từ chối yêu cầu rút tiền", 400);
      }

      withdrawal.status = "rejected";
      withdrawal.reviewedBy = toObjectId(admin.id);
      withdrawal.reviewedAt = new Date();
      withdrawal.adminNote = input.adminNote || null;
      await withdrawal.save({ session });

      await createNotification(
        withdrawal.userId,
        "Yêu cầu rút tiền đã bị từ chối",
        `Yêu cầu rút ${withdrawal.amount.toLocaleString("vi-VN")} VND của bạn đã bị từ chối. Tiền đã được hoàn về ví.`,
        {
          withdrawalId: withdrawal._id,
          amount: withdrawal.amount,
          status: "rejected",
          adminNote: input.adminNote || null,
        },
        session,
      );

      rejectedRequest = withdrawal;
    });

    return rejectedRequest;
  } finally {
    await session.endSession();
  }
};
