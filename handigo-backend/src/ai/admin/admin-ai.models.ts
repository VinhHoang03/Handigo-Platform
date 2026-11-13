import { Schema, model } from "mongoose";
import { FEATURES } from "./admin-ai.validation";

const configSchema = new Schema({
  feature: { type: String, enum: FEATURES, required: true, unique: true },
  revision: { type: Number, default: 0 }, enabled: { type: Boolean, default: false },
  draft: { type: Schema.Types.Mixed, required: true }, policy: { type: Schema.Types.Mixed, default: null },
  enabledSince: { type: Date, default: null }, configuredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  fence: { type: Number, default: 0 }, cursorAt: { type: Date, default: null }, cursorId: { type: Schema.Types.ObjectId, default: null },
}, { timestamps: true });
export const AdminAIConfig = model("AdminAIConfig", configSchema);
export const AdminAIConfigHistory = model("AdminAIConfigHistory", new Schema({
  feature: { type: String, enum: FEATURES, required: true }, revision: { type: Number, required: true },
  action: { type: String, enum: ["draft", "activate", "disable"], required: true },
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: true }, snapshot: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true }).index({ feature: 1, revision: 1 }, { unique: true }));

const assessmentSchema = new Schema({
  key: { type: String, required: true, unique: true }, feature: { type: String, enum: FEATURES, required: true },
  sourceType: { type: String, required: true }, sourceId: { type: String, required: true },
  revision: { type: Number, required: true }, policy: { type: Schema.Types.Mixed, required: true },
  sourceHash: { type: String, required: true }, preview: { type: Boolean, required: true },
  configuredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["queued", "running", "retry", "completed", "manual", "stale", "error"], default: "queued" },
  attempts: { type: Number, default: 0 }, nextAt: { type: Date, default: Date.now },
  leaseUntil: { type: Date, default: null }, leaseToken: { type: String, default: null },
  output: { type: Schema.Types.Mixed, default: null }, checks: { type: [Schema.Types.Mixed], default: [] },
  appliedSourceHash: { type: String, default: null },
  adminDecision: { type: new Schema({
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["under_review", "evidence_requested", "confirmed", "rejected", "resolved"], required: true },
    note: { type: String, required: true }, decidedAt: { type: Date, required: true },
    completedTasks: [{ index: { type: Number, required: true }, evidence: { type: String, required: true } }],
  }, { _id: false }), default: null },
  outcome: { type: String, default: null }, error: { type: String, default: null },
  model: { type: String, default: null }, usage: { type: Schema.Types.Mixed, default: null },
  from: { type: Date, default: null }, to: { type: Date, default: null }, metrics: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });
assessmentSchema.index({ status: 1, nextAt: 1, leaseUntil: 1 });
assessmentSchema.index({ feature: 1, createdAt: -1 });
assessmentSchema.index({ sourceType: 1, sourceId: 1, createdAt: -1 });
export const AdminAIAssessment = model("AdminAIAssessment", assessmentSchema);
export const AdminAIQuota = model("AdminAIQuota", new Schema({
  key: { type: String, required: true, unique: true }, count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}).index({ expiresAt: 1 }, { expireAfterSeconds: 0 }));
