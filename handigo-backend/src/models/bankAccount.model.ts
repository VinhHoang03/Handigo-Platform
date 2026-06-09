import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IBankAccount extends Document, IBaseDocument {
  userId: Types.ObjectId;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault: boolean;
  status: "active" | "inactive";
}

const BankAccountSchema = new Schema<IBankAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bankName: { type: String, required: true },
    bankCode: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountHolderName: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    ...baseFields,
  },
  { timestamps: true },
);

BankAccountSchema.index({ userId: 1, bankCode: 1, accountNumber: 1 }, { unique: true });
BankAccountSchema.index(
  { userId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
);

export const BankAccount = model<IBankAccount>("BankAccount", BankAccountSchema);
