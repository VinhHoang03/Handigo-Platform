import mongoose, { Document, Schema, Types } from "mongoose";

export type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";
export type HandigoRole = "customer" | "provider" | "admin";
export type UserStatus = "LOCK" | "UNLOCK" | "active" | "locked";

export interface IUserSession {
  _id: Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt?: Date;
}

export interface IUser extends Document {
  email: string;
  passwordHash: string | null;
  googleId?: string | null;
  facebookId?: string | null;
  fullName: string;
  phone?: string;
  avatar?: string | null;
  role: UserRole;
  roles: HandigoRole[];
  activeRole: HandigoRole;
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
      default: null
    },

    googleId: {
      type: String,
      default: null
    },

    facebookId: {
      type: String,
      default: null
    },

    fullName: {
      type: String,
      required: true
    },

    phone: { type: String, sparse: true },
    avatar: { type: String, default: null },

    role: {
      type: String,
      enum: ["CUSTOMER", "PROVIDER", "ADMIN"],
      default: "CUSTOMER"
    },

    roles: {
      type: [String],
      enum: ["customer", "provider", "admin"],
      default: ["customer"]
    },

    activeRole: {
      type: String,
      enum: ["customer", "provider", "admin"],
      default: "customer"
    },

    status: {
      type: String,
      enum: ["LOCK", "UNLOCK", "active", "locked"],
      default: "UNLOCK"
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
    },

    isDeleted: {
      type: Boolean,
      default: false
    },

    deletedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

UserSchema.index({ phone: 1 });
UserSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: "string" } } },
);
UserSchema.index(
  { facebookId: 1 },
  { unique: true, partialFilterExpression: { facebookId: { $type: "string" } } },
);

export default mongoose.model<IUser>("User", UserSchema);
