import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";
import type { IIdentityDocument, IProviderCertificate } from "./provider.model";

export interface IProviderApplication extends Document, IBaseDocument {
  userId: Types.ObjectId;
  description: string;
  experienceYears: number;
  serviceIds: Types.ObjectId[];
  workingAreas: string[];
  identityDocument?: IIdentityDocument;
  certificates: IProviderCertificate[];
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
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
    title: { type: String, required: true, trim: true, maxlength: 200 },
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

const ProviderApplicationSchema = new Schema<IProviderApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true },
    experienceYears: { type: Number, required: true, min: 0, default: 0 },
    serviceIds: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    workingAreas: { type: [String], default: [] },
    identityDocument: { type: IdentityDocumentSchema, default: undefined },
    certificates: { type: [ProviderCertificateSchema], default: [] },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    rejectionReason: { type: String, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ProviderApplicationSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export const ProviderApplication = model<IProviderApplication>(
  "ProviderApplication",
  ProviderApplicationSchema,
  "providerapplications",
);
