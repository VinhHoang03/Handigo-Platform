import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export type WalletTransactionType =
  | "deposit"
  | "payment"
  | "refund"
  | "provider_earning"
  | "platform_fee"
  | "withdraw"
  | "withdraw_rejected"
  | "adjustment";

export interface IWalletTransaction extends Document, IBaseDocument {
  walletId: Types.ObjectId;
  userId: Types.ObjectId;
  relatedOrderId?: Types.ObjectId | null;
  relatedPaymentId?: Types.ObjectId | null;
  relatedWithdrawRequestId?: Types.ObjectId | null;
  type: WalletTransactionType;
  direction: "in" | "out";
  amount: Money;
  balanceAfter: Money;
  status: "pending" | "success" | "failed";
  transactionCode?: string | null;
  gatewayOrderCode?: string | null;
  gatewayPaymentLinkId?: string | null;
  gatewayTransactionId?: string | null;
  gatewayResponse?: Record<string, unknown> | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    relatedOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    relatedPaymentId: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
    relatedWithdrawRequestId: { type: Schema.Types.ObjectId, ref: "WithdrawRequest", default: null },
    type: {
      type: String,
      enum: [
        "deposit",
        "payment",
        "refund",
        "provider_earning",
        "platform_fee",
        "withdraw",
        "withdraw_rejected",
        "adjustment",
      ],
      required: true,
    },
    direction: { type: String, enum: ["in", "out"], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    transactionCode: { type: String, default: null },
    gatewayOrderCode: { type: String, default: null },
    gatewayPaymentLinkId: { type: String, default: null },
    gatewayTransactionId: { type: String, default: null },
    gatewayResponse: { type: Schema.Types.Mixed, default: null },
    description: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

WalletTransactionSchema.index({ walletId: 1, createdAt: -1 });
WalletTransactionSchema.index({ transactionCode: 1 });
WalletTransactionSchema.index({ gatewayOrderCode: 1 });
WalletTransactionSchema.index({ gatewayPaymentLinkId: 1 });
WalletTransactionSchema.index({ relatedOrderId: 1, type: 1, status: 1 });

export const WalletTransaction = model<IWalletTransaction>(
  "WalletTransaction",
  WalletTransactionSchema,
  "wallettransactions",
);
