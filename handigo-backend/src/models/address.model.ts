import { Schema, model, Document, Types } from "mongoose";
import {
  isValidPersonName,
  isValidVietnamesePhone,
  normalizePersonName,
  normalizeVietnamesePhone,
} from "../utils/profileValidation";

export interface IAddress extends Document {
  isDeleted: boolean;
  deletedAt?: Date | null;
  identityKey?: string;
  userId: Types.ObjectId;
  recipientName?: string;
  recipientPhone?: string;
  fullAddress: string;
  province: string;
  provinceCode?: number;
  ward: string;
  wardCode?: number;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isDefault: boolean;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    identityKey: { type: String, select: false },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientName: {
      type: String,
      trim: true,
      set: normalizePersonName,
      validate: {
        validator: isValidPersonName,
        message: "Tên người nhận chỉ được chứa chữ cái và khoảng trắng",
      },
    },
    recipientPhone: {
      type: String,
      trim: true,
      set: normalizeVietnamesePhone,
      validate: {
        validator: isValidVietnamesePhone,
        message: "Số điện thoại người nhận không hợp lệ",
      },
    },
    fullAddress: {
      type: String,
      required: true,
    },
    province: {
      type: String,
      required: true,
    },
    provinceCode: {
      type: Number,
    },
    ward: {
      type: String,
      required: true,
    },
    wardCode: {
      type: Number,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    placeId: {
      type: String,
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
addressSchema.index({ userId: 1, identityKey: 1 }, {
  unique: true, partialFilterExpression: { identityKey: { $type: "string" } },
});

export const Address = model<IAddress>("Address", addressSchema, "addresses");
