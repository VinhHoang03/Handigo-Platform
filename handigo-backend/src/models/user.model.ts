import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";
export type UserStatus = "active" | "locked";

export interface IUser extends Document {
  email: string;
  passwordHash: string | null;
  googleId?: string | null;
  facebookId?: string | null;
  fullName: string;
  phone?: string;
  avatar?: string | null;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isDeleted: boolean;
  deletedAt?: Date | null;

  registerOtp?: string;
  registerOtpExpire?: Date;

  resetPasswordTokenHash?: string;
  resetPasswordExpire?: Date;

  resetPasswordOtp?: string;
  resetPasswordOtpExpire?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },

    passwordHash: {
      type: String,
      default: null,
    },

    googleId: {
      type: String,
      default: null,
    },

    facebookId: {
      type: String,
      default: null,
    },

    fullName: {
      type: String,
      required: true,
    },

    phone: { type: String, sparse: true },
    avatar: { type: String, default: null },

    role: {
      type: String,
      enum: ["CUSTOMER", "PROVIDER", "ADMIN"],
      default: "CUSTOMER",
    },

    status: {
      type: String,
      enum: ["active", "locked"],
      default: "active",
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    registerOtp: String,
    registerOtpExpire: Date,

    resetPasswordTokenHash: String,
    resetPasswordExpire: Date,

    resetPasswordOtp: String,
    resetPasswordOtpExpire: Date,

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

UserSchema.index({ phone: 1 });
UserSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: "string" } } },
);
UserSchema.index(
  { facebookId: 1 },
  {
    unique: true,
    partialFilterExpression: { facebookId: { $type: "string" } },
  },
);

export default mongoose.model<IUser>("User", UserSchema, "users");
