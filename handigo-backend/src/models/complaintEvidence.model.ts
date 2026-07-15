import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";
import { EVIDENCE_FILE_TYPES, EvidenceFileType } from "./report.model";

export interface IComplaintEvidence extends Document, IBaseDocument {
  complaintId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  fileType: EvidenceFileType;
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
  note?: string | null;
}

const ComplaintEvidenceSchema = new Schema<IComplaintEvidence>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: "Complaint", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileType: { type: String, enum: EVIDENCE_FILE_TYPES, required: true },
    url: { type: String, required: true, trim: true },
    mimeType: { type: String, default: null, trim: true },
    fileName: { type: String, default: null, trim: true },
    note: { type: String, default: null },
    ...baseFields,
  },
  { timestamps: true },
);

ComplaintEvidenceSchema.index({ complaintId: 1, createdAt: -1 });

export const ComplaintEvidence = model<IComplaintEvidence>(
  "ComplaintEvidence",
  ComplaintEvidenceSchema,
  "complaintevidences",
);
