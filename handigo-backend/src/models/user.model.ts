import mongoose, { Document, Schema } from "mongoose";

export type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  avatar?: string | null;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE" | "BANNED";
  isEmailVerified: boolean;

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
      unique: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    fullName: {
      type: String,
      required: true
    },

    phone: String,
    avatar: { type: String, default: null },

    role: {
      type: String,
      enum: ["CUSTOMER", "PROVIDER", "ADMIN"],
      default: "CUSTOMER"

      
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "BANNED"],
      default: "ACTIVE"
    },

    isEmailVerified: {
      type: Boolean,
      default: false
    },

    registerOtp: String,
    registerOtpExpire: Date,

    resetPasswordTokenHash: String,
    resetPasswordExpire: Date,

    resetPasswordOtp: String,
    resetPasswordOtpExpire: Date
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);