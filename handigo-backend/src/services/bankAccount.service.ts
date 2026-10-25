import mongoose, { Types, type ClientSession } from "mongoose";
import { BankAccount } from "../models/bankAccount.model";
import type { RequestUser } from "../middlewares/authContext";
import { Provider } from "../models/provider.model";
import { WithdrawRequest } from "../models/withdrawRequest.model";
import { AppError } from "../utils/appError";
import type {
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from "../validations/bankAccount.validator";

const assertBankAccountAccess = async (user: RequestUser) => {
  if (user.role !== "CUSTOMER" && user.role !== "PROVIDER") {
    throw new AppError("Bạn không có quyền quản lý tài khoản ngân hàng", 403);
  }

  if (user.role === "PROVIDER") {
    const provider = await Provider.findOne({ userId: user.id, isDeleted: false });
    if (!provider) {
      throw new AppError("Không tìm thấy hồ sơ nhà cung cấp", 404);
    }
  }
};
const pickPayload = (input: UpdateBankAccountInput) => {
  const payload: UpdateBankAccountInput = {};
  const fields: (keyof UpdateBankAccountInput)[] = [
    "bankName",
    "bankCode",
    "accountNumber",
    "accountHolderName",
    "isDefault",
    "status",
  ];

  for (const field of fields) {
    if (input[field] !== undefined) {
      payload[field] = input[field] as never;
    }
  }

  return payload;
};

const unsetOtherDefaults = async (userId: string | Types.ObjectId, exceptId?: string, session?: ClientSession) => {
  const filter: Record<string, unknown> = {
    userId,
    isDeleted: false,
  };

  if (exceptId) {
    filter._id = { $ne: exceptId };
  }

  await BankAccount.updateMany(filter, { $set: { isDefault: false } }, { session, runValidators: true });
};

const getOwnedBankAccount = async (userId: string, bankAccountId: string, session?: ClientSession) => {
  const bankAccount = await BankAccount.findOne({
    _id: bankAccountId,
    userId,
    isDeleted: false,
  }).session(session ?? null);

  if (!bankAccount) {
    throw new AppError("Không tìm thấy tài khoản ngân hàng", 404);
  }

  return bankAccount;
};

const assertWithdrawalBankAccountChanges = async (
  bankAccount: Awaited<ReturnType<typeof getOwnedBankAccount>>,
  payload: UpdateBankAccountInput,
  session: ClientSession,
) => {
  const identityFields = ["bankName", "bankCode", "accountNumber", "accountHolderName"] as const;
  const changesIdentity = identityFields.some((field) =>
    payload[field] !== undefined && payload[field] !== bankAccount[field]);
  if (changesIdentity && await WithdrawRequest.exists({ bankAccountId: bankAccount._id }).session(session)) {
    throw new AppError("Tài khoản đã dùng để rút tiền không thể đổi thông tin nhận tiền. Vui lòng thêm tài khoản ngân hàng mới", 409);
  }
  if (payload.status === "inactive" && await WithdrawRequest.exists({
    bankAccountId: bankAccount._id, status: "pending", isDeleted: false,
  }).session(session)) {
    throw new AppError("Không thể vô hiệu hóa hoặc xóa tài khoản đang có yêu cầu rút tiền chờ xử lý", 409);
  }
};

const lockOwnedBankAccount = async (userId: string, bankAccountId: string, session: ClientSession) => {
  // Cùng ghi một document với tạo/duyệt rút tiền để tránh kiểm tra trên snapshot cũ.
  const account = await BankAccount.findOneAndUpdate(
    { _id: bankAccountId, userId, isDeleted: false },
    { $inc: { __v: 1 } },
    { new: true, session, runValidators: true },
  );
  if (!account) throw new AppError("Không tìm thấy tài khoản ngân hàng", 404);
  return account;
};

export const listMyBankAccounts = async (user: RequestUser) => {
  await assertBankAccountAccess(user);

  return BankAccount.find({
    userId: user.id,
    isDeleted: false,
  }).sort({ isDefault: -1, createdAt: -1 });
};

export const createMyBankAccount = async (
  user: RequestUser,
  input: CreateBankAccountInput,
) => {
  await assertBankAccountAccess(user);

  try {
    return await mongoose.connection.transaction(async (session) => {
      const activeCount = await BankAccount.countDocuments({ userId: user.id, isDeleted: false }).session(session);
      const shouldBeDefault = input.isDefault === true || activeCount === 0;
      if (shouldBeDefault) await unsetOtherDefaults(user.id, undefined, session);
      const [account] = await BankAccount.create([{
        ...input, userId: user.id, isDefault: shouldBeDefault, status: "active",
      }], { session });
      return account;
    });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new AppError("Tài khoản ngân hàng này đã tồn tại", 409);
    }

    throw error;
  }
};

export const updateMyBankAccount = async (
  user: RequestUser,
  bankAccountId: string,
  input: UpdateBankAccountInput,
) => {
  await assertBankAccountAccess(user);
  const payload = pickPayload(input);
  try {
    return await mongoose.connection.transaction(async (session) => {
      const account = await getOwnedBankAccount(user.id, bankAccountId, session);
      await lockOwnedBankAccount(user.id, bankAccountId, session);
      await assertWithdrawalBankAccountChanges(account, payload, session);
      if (payload.isDefault === true) {
        payload.status = "active";
        await unsetOtherDefaults(user.id, bankAccountId, session);
      }
      const bankAccount = await BankAccount.findOneAndUpdate(
        { _id: bankAccountId, userId: user.id, isDeleted: false },
        payload,
        { new: true, session, runValidators: true },
      );
      if (!bankAccount) throw new AppError("Không tìm thấy tài khoản ngân hàng", 404);
      return bankAccount;
    });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new AppError("Tài khoản ngân hàng này đã tồn tại", 409);
    }

    throw error;
  }
};

export const setDefaultMyBankAccount = async (
  user: RequestUser,
  bankAccountId: string,
) => {
  return updateMyBankAccount(user, bankAccountId, { isDefault: true });
};

export const deleteMyBankAccount = async (user: RequestUser, bankAccountId: string) => {
  await assertBankAccountAccess(user);
  return mongoose.connection.transaction(async (session) => {
    const bankAccount = await lockOwnedBankAccount(user.id, bankAccountId, session);
    await assertWithdrawalBankAccountChanges(bankAccount, { status: "inactive" }, session);

    bankAccount.isDeleted = true;
    bankAccount.deletedAt = new Date();
    bankAccount.isDefault = false;
    bankAccount.status = "inactive";
    await bankAccount.save({ session });

    const remainingDefault = await BankAccount.findOne({
      userId: user.id,
      isDeleted: false,
      isDefault: true,
    }).session(session);

    if (!remainingDefault) {
      const latestActive = await BankAccount.findOne({
        userId: user.id,
        isDeleted: false,
        status: "active",
      }).sort({ createdAt: -1 }).session(session);

      if (latestActive) {
        latestActive.isDefault = true;
        await latestActive.save({ session });
      }
    }

    return bankAccount;
  });
};
