import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IGeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface ILocation extends Document, IBaseDocument {
  userId: Types.ObjectId;
  ownerType: "customer" | "provider";
  coordinates: IGeoPoint;
  isActive: boolean;
  lastUpdatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ownerType: { type: String, enum: ["customer", "provider"], required: true },
    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    isActive: { type: Boolean, default: true },
    lastUpdatedAt: { type: Date, default: Date.now },
    ...baseFields,
  },
  { timestamps: true },
);

LocationSchema.index({ coordinates: "2dsphere" });
LocationSchema.index({ userId: 1, ownerType: 1 });
LocationSchema.index(
  { lastUpdatedAt: 1 },
  { expireAfterSeconds: 24 * 60 * 60 },
);

export const Location = model<ILocation>("Location", LocationSchema, "locations");
