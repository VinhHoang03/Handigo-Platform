import { Schema, Types } from "mongoose";

export type Money = number;
export type ObjectId = Types.ObjectId;

export interface IBaseDocument {
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt?: Date | null;
}

export const baseFields = {
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
};

export const objectIdRef = (ref: string, required = true) => ({
  type: Schema.Types.ObjectId,
  ref,
  required,
});
