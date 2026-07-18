import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";
import type { IIdentityDocument, IProviderCertificate } from "./provider.model";

export type ProviderApplicationStatus =
  | "draft"
  | "pending"
  | "resubmitted"
  | "approved"
  | "rejected";

export type ProviderApplicationType = "initial" | "service_addition";

export interface IProviderApplicationReviewHistory {
  action: "submitted" | "rejected" | "resubmitted" | "approved";
  status: ProviderApplicationStatus;
  actorId: Types.ObjectId;
  actorRole: "CUSTOMER" | "PROVIDER" | "ADMIN";
  occurredAt: Date;
  rejectionReason?: string | null;
  notes?: string | null;
}

export interface IProviderApplication extends Document, IBaseDocument {
  userId: Types.ObjectId;
  applicationType: ProviderApplicationType;
  description: string;
  experienceYears: number;
  serviceIds: Types.ObjectId[];
  workingAreas: string[];
  identityDocument?: IIdentityDocument;
  certificates: IProviderCertificate[];
  status: ProviderApplicationStatus;
  submittedAt?: Date | null;
  resubmittedAt?: Date | null;
  rejectionReason?: string | null;
  rejectionNotes?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewHistory: IProviderApplicationReviewHistory[];
}

const IdentityDocumentSchema = new Schema<IIdentityDocument>(
  {
    type: { type: String, enum: ["cccd", "passport"] },
    documentNumber: { type: String, trim: true, maxlength: 50 },
    numberLast4: { type: String, trim: true, maxlength: 4 },
    fullName: { type: String, trim: true },
    issuedPlace: { type: String, trim: true, maxlength: 200 },
    issuedAt: { type: Date },
    expiresAt: { type: Date },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    nationality: { type: String, trim: true, maxlength: 120 },
    placeOfOrigin: { type: String, trim: true, maxlength: 300 },
    placeOfResidence: { type: String, trim: true, maxlength: 300 },
    frontImageUrl: { type: String, trim: true },
    backImageUrl: { type: String, trim: true },
    passportImageUrl: { type: String, trim: true },
    selfieImageUrl: { type: String, trim: true },
    verificationStatus: {
      type: String,
      enum: ["unsubmitted", "pending", "verified", "rejected"],
      default: "pending",
    },
    provider: {
      type: String,
      enum: ["manual", "fpt", "vnpt", "viettel", "didit"],
      default: "manual",
    },
    providerReferenceId: { type: String, trim: true },
    ocrResult: { type: Schema.Types.Mixed },
    consentAcceptedAt: { type: Date },
    submittedAt: { type: Date },
    verifiedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { _id: false },
);

const ProviderCertificateSchema = new Schema<IProviderCertificate>(
  {
    title: { type: String, trim: true, maxlength: 200 },
    certificateNumber: { type: String, trim: true, maxlength: 100 },
    issuer: { type: String, trim: true, maxlength: 200 },
    issuedAt: { type: Date },
    expiresAt: { type: Date },
    imageUrls: { type: [String], default: [] },
    description: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true },
);

const ProviderApplicationReviewHistorySchema =
  new Schema<IProviderApplicationReviewHistory>(
    {
      action: {
        type: String,
        enum: ["submitted", "rejected", "resubmitted", "approved"],
        required: true,
      },
      status: {
        type: String,
        enum: ["draft", "pending", "resubmitted", "approved", "rejected"],
        required: true,
      },
      actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      actorRole: {
        type: String,
        enum: ["CUSTOMER", "PROVIDER", "ADMIN"],
        required: true,
      },
      occurredAt: { type: Date, required: true },
      rejectionReason: { type: String, trim: true, maxlength: 200, default: null },
      notes: { type: String, trim: true, maxlength: 2000, default: null },
    },
    { _id: false },
  );

const ProviderApplicationSchema = new Schema<IProviderApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    applicationType: {
      type: String,
      enum: ["initial", "service_addition"],
      default: "initial",
      required: true,
    },
    description: { type: String, default: "" },
    experienceYears: { type: Number, required: true, min: 0, default: 0 },
    serviceIds: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    workingAreas: { type: [String], default: [] },
    identityDocument: { type: IdentityDocumentSchema, default: undefined },
    certificates: { type: [ProviderCertificateSchema], default: [] },
    status: {
      type: String,
      enum: ["draft", "pending", "resubmitted", "approved", "rejected"],
      default: "pending",
    },
    submittedAt: { type: Date, default: null },
    resubmittedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    rejectionNotes: { type: String, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewHistory: { type: [ProviderApplicationReviewHistorySchema], default: [] },
    ...baseFields,
  },
  { timestamps: true },
);

ProviderApplicationSchema.index(
  { userId: 1 },
  {
    name: "userId_active_review_1",
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "resubmitted"] } },
  },
);
ProviderApplicationSchema.index({ userId: 1, applicationType: 1, createdAt: -1 });

export const ProviderApplication = model<IProviderApplication>(
  "ProviderApplication",
  ProviderApplicationSchema,
  "providerapplications",
);
