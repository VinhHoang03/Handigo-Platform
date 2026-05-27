import mongoose, { Document, Schema, Types } from "mongoose";

export type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

export interface IUserSession {
  _id: Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt?: Date;
}

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

  sessions: IUserSession[];
}

const UserSessionSchema = new Schema<IUserSession>(
  {
    refreshTokenHash: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    revokedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

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
    resetPasswordOtpExpire: Date,

    sessions: {
      type: [UserSessionSchema],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);