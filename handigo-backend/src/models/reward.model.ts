import { Schema, model } from "mongoose";

const RewardAccountSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  balance: { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0, min: 0 },
  totalRedeemed: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

const RewardTransactionSchema = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  kind: { type: String, enum: ["EARN", "REDEEM"], required: true },
  points: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description: { type: String, required: true },
  orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
  promotionId: { type: Schema.Types.ObjectId, ref: "Promotion", default: null },
  offerId: { type: String, default: null },
}, { timestamps: true });
RewardTransactionSchema.index({ userId: 1, createdAt: -1 });

export const RewardAccount = model("RewardAccount", RewardAccountSchema);
export const RewardTransaction = model("RewardTransaction", RewardTransactionSchema);
