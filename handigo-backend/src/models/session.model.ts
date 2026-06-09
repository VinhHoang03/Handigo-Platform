import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface ISession extends Document, IBaseDocument {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    refreshTokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

SessionSchema.index({ userId: 1 });
SessionSchema.index({ expiresAt: 1 });

export const Session = model<ISession>("Session", SessionSchema, "sessions");
