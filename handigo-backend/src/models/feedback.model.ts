import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IFeedback extends Document, IBaseDocument {
  orderId: Types.ObjectId;
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  rating: number;
  comment?: string | null;
  images: string[];
  isVisible: boolean;
  providerReply?: {
    content: string;
    repliedBy: Types.ObjectId;
    repliedAt: Date;
    updatedAt: Date;
  } | null;
}

const ProviderReplySchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    repliedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    repliedAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false },
);

const FeedbackSchema = new Schema<IFeedback>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: null },
    images: { type: [String], default: [] },
    isVisible: { type: Boolean, default: true },
    providerReply: { type: ProviderReplySchema, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

FeedbackSchema.index({ providerId: 1, createdAt: -1 });
FeedbackSchema.index({ isVisible: 1, rating: 1, createdAt: -1 });

export const Feedback = model<IFeedback>("Feedback", FeedbackSchema, "feedbacks");
