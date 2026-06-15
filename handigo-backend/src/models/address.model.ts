import { Schema, model, Document, Types } from "mongoose";

export interface IAddress extends Document {
  userId: Types.ObjectId;
  fullAddress: string;
  province: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fullAddress: {
      type: String,
      required: true,
    },
    province: {
      type: String,
      required: true,
    },
    ward: {
      type: String,
      required: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    note: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

addressSchema.index({ userId: 1 });

export const Address = model<IAddress>("Address", addressSchema, "addresses");
