export type OcrDocumentKind =
  | "cccd_front"
  | "cccd_back"
  | "passport"
  | "certificate";

export interface OcrSuggestion {
  documentNumber?: string;
  fullName?: string;
  issuedPlace?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other";
  nationality?: string;
  placeOfOrigin?: string;
  placeOfResidence?: string;
  title?: string;
  certificateNumber?: string;
  issuer?: string;
  issuedAt?: string;
  expiresAt?: string;
  confidence?: number;
  warnings: string[];
}

export interface OcrResult {
  text: string;
  confidence?: number;
}
