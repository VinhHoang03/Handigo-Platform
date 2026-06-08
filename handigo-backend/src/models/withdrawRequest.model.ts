import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export interface IWithdrawRequest extends Document, IBaseDocument {
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  bankAccountId: Types.ObjectId;
  amount: Money;
  status: "pending" | "approved" | "rejected";
  adminNote?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
}

const WithdrawRequestSchema = new Schema<IWithdrawRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminNote: { type: String, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

WithdrawRequestSchema.index({ status: 1, createdAt: -1 });

export const WithdrawRequest = model<IWithdrawRequest>("WithdrawRequest", WithdrawRequestSchema);
