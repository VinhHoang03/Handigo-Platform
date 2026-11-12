import { Schema, model, Types } from "mongoose";
import type { summarizeProviderRewards } from "../services/providerRewardsPolicy";

interface ProviderRewardWeekRecord {
  _id: string;
  providerId: Types.ObjectId;
  weekStart: Date;
  settledAt: Date;
  milestones: { diamonds: number; amount: number }[];
  summary: ReturnType<typeof summarizeProviderRewards>;
}

const schema = new Schema<ProviderRewardWeekRecord>({
  _id: { type: String, required: true },
  providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
  weekStart: { type: Date, required: true },
  settledAt: { type: Date, required: true },
  milestones: {
    type: [new Schema({ diamonds: Number, amount: Number }, { _id: false })],
    required: true,
  },
  summary: { type: Schema.Types.Mixed, required: true },
});

schema.index({ providerId: 1, weekStart: -1 });

export const ProviderRewardWeek = model("ProviderRewardWeek", schema, "providerrewardweeks");
