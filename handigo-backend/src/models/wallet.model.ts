import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export interface IWallet extends Document, IBaseDocument {
  userId: Types.ObjectId;
  balance: Money;
  pendingBalance: Money;
  currency: "VND";
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0, min: 0 },
    pendingBalance: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["VND"], default: "VND" },
    ...baseFields,
  },
  { timestamps: true },
);

export const Wallet = model<IWallet>("Wallet", WalletSchema);
