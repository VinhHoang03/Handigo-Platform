import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IAuditLog extends Document, IBaseDocument {
  actorId?: Types.ObjectId | null;
  actorRole: "customer" | "provider" | "admin" | "system";
  action: string;
  targetType: string;
  targetId?: Types.ObjectId | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  description?: string | null;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: {
      type: String,
      enum: ["customer", "provider", "admin", "system"],
      required: true,
    },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, default: null },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    description: { type: String, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

AuditLogSchema.index({ targetType: 1, targetId: 1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", AuditLogSchema, "auditlogs");
