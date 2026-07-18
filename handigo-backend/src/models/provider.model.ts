import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export type Gender = "male" | "female" | "other";
export type IdentityDocumentType = "cccd" | "passport";
export type IdentityVerificationStatus =
  | "unsubmitted"
  | "pending"
  | "verified"
  | "rejected";
export type IdentityVerificationProvider =
  | "manual"
  | "fpt"
  | "vnpt"
  | "viettel"
  | "didit";
export type CertificateStatus = "pending" | "approved" | "rejected";

export interface IProviderServiceArea {
  province?: string;
  ward?: string;
}

export interface IIdentityDocument {
  type?: IdentityDocumentType;
  documentNumber?: string;
  numberLast4?: string;
  fullName?: string;
  issuedPlace?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  dateOfBirth?: Date;
  gender?: Gender;
  nationality?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  passportImageUrl?: string;
  selfieImageUrl?: string;
  verificationStatus: IdentityVerificationStatus;
  provider: IdentityVerificationProvider;
  providerReferenceId?: string;
  ocrResult?: Record<string, unknown>;
  consentAcceptedAt?: Date;
  submittedAt?: Date;
  verifiedAt?: Date;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
}

export interface IProviderCertificate {
  _id?: Types.ObjectId;
  title: string;
  certificateNumber?: string;
  issuer?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  imageUrls: string[];
  description?: string;
  status: CertificateStatus;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
}

export interface IProvider extends Document, IBaseDocument {
  userId: Types.ObjectId;
  description: string;
  bio?: string;
  mainServiceText?: string;
  serviceArea?: IProviderServiceArea;
  experienceYears: number;
  availabilityStatus: "online" | "offline" | "busy";
  verified: boolean;
  serviceIds: Types.ObjectId[];
  workingAreas: string[];
  averageRating: number;
  totalFeedbacks: number;
  totalCompletedOrders: number;
  identityDocument?: IIdentityDocument;
  certificates: IProviderCertificate[];
}

const ProviderServiceAreaSchema = new Schema<IProviderServiceArea>(
  {
    province: { type: String, trim: true },
    ward: { type: String, trim: true },
  },
  { _id: false },
);

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
      default: "unsubmitted",
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

const ProviderSchema = new Schema<IProvider>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    description: { type: String, required: true },
    bio: { type: String, trim: true, maxlength: 2000 },
    mainServiceText: { type: String, trim: true, maxlength: 200 },
    serviceArea: { type: ProviderServiceAreaSchema, default: undefined },
    experienceYears: { type: Number, required: true, min: 0, default: 0 },
    availabilityStatus: {
      type: String,
      enum: ["online", "offline", "busy"],
      default: "offline",
    },
    verified: { type: Boolean, default: false },
    serviceIds: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    workingAreas: { type: [String], default: [] },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalFeedbacks: { type: Number, default: 0, min: 0 },
    totalCompletedOrders: { type: Number, default: 0, min: 0 },
    identityDocument: { type: IdentityDocumentSchema, default: undefined },
    certificates: { type: [ProviderCertificateSchema], default: [] },
    ...baseFields,
  },
  { timestamps: true },
);

ProviderSchema.index({ serviceIds: 1 });
ProviderSchema.index({ availabilityStatus: 1, verified: 1 });
ProviderSchema.index({ "serviceArea.province": 1, "serviceArea.ward": 1 });

export const Provider = model<IProvider>(
  "Provider",
  ProviderSchema,
  "providers",
);
