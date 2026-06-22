import vision from "@google-cloud/vision";
import { PDFDocument } from "pdf-lib";
import { OcrDocumentKind, OcrResult, OcrSuggestion } from "./ocr.types";

// Vision client tự tìm thông tin xác thực theo chuỗi Application Default Credentials.
let visionClient: InstanceType<typeof vision.ImageAnnotatorClient> | null = null;

const getVisionClient = () => {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient();
  }
  return visionClient;
};

const removeDiacritics = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

const cleanLine = (value: string) =>
  value.replace(/^[\s:;|.-]+|[\s:;|.-]+$/g, "").replace(/\s+/g, " ");

const normalizeLine = (value: string) => removeDiacritics(value).toUpperCase();

const parseDate = (value: string): string | undefined => {
  const normalized = value.trim().replace(/[.]/g, "/").replace(/-/g, "/");
  const parts = normalized.split("/").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined;

  const [first, second, third] = parts;
  const year = first > 1900 ? first : third;
  const month = second;
  const day = first > 1900 ? third : first;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
};

const datePattern = /\b(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2})\b/g;

const findDateByLabels = (lines: string[], labels: string[]) => {
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeLine(lines[index]);
    if (!labels.some((label) => normalized.includes(label))) continue;

    for (const candidate of [lines[index], lines[index + 1] || ""]) {
      const match = candidate.match(datePattern)?.[0];
      const parsed = match ? parseDate(match) : undefined;
      if (parsed) return parsed;
    }
  }

  return undefined;
};

const findValueByLabels = (lines: string[], labels: string[]) => {
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeLine(lines[index]);
    if (!labels.some((label) => normalized.includes(label))) continue;

    const separators = lines[index].split(/[:|]/);
    if (separators.length > 1) {
      const value = cleanLine(separators.slice(1).join(" "));
      if (value) return value;
    }

    const nextLine = cleanLine(lines[index + 1] || "");
    if (nextLine) return nextLine;
  }

  return undefined;
};

const getAllDates = (text: string) =>
  [...new Set((text.match(datePattern) || []).map(parseDate).filter(Boolean))] as string[];

const averageConfidence = (responses: any[]) => {
  const values: number[] = [];
  for (const response of responses) {
    for (const page of response?.fullTextAnnotation?.pages || []) {
      for (const block of page.blocks || []) {
        if (typeof block.confidence === "number") values.push(block.confidence);
      }
    }
  }

  if (!values.length) return undefined;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

const getText = (responses: any[]) =>
  responses
    .map(
      (response) =>
        response?.fullTextAnnotation?.text ||
        response?.textAnnotations?.[0]?.description ||
        "",
    )
    .filter(Boolean)
    .join("\n");

const throwIfVisionError = (responses: any[]) => {
  const apiError = responses.find((response) => response?.error)?.error;
  if (apiError) {
    throw new Error(apiError.message || "Google Cloud Vision OCR thất bại");
  }
};

export const extractText = async (
  buffer: Buffer,
  mimeType: string,
): Promise<OcrResult> => {
  const client = getVisionClient();
  let annotationResponses: any[];

  if (mimeType === "application/pdf") {
    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(buffer, { updateMetadata: false });
    } catch {
      const error = new Error("Tệp PDF không hợp lệ hoặc không thể đọc");
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
    const pageCount = pdf.getPageCount();
    if (pageCount > 5) {
      const error = new Error("Tệp PDF dùng OCR không được vượt quá 5 trang");
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    const [result] = await client.batchAnnotateFiles({
      requests: [
        {
          inputConfig: { content: buffer, mimeType },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          pages: Array.from({ length: pageCount }, (_, index) => index + 1),
        },
      ],
    });
    annotationResponses = result.responses?.[0]?.responses || [];
  } else {
    const [result] = await client.textDetection({
      image: { content: buffer },
      imageContext: { languageHints: ["vi", "en"] },
    });
    annotationResponses = [result];
  }

  throwIfVisionError(annotationResponses);
  return {
    text: getText(annotationResponses),
    confidence: averageConfidence(annotationResponses),
  };
};

const parseIdentity = (text: string, kind: OcrDocumentKind): OcrSuggestion => {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const normalizedText = normalizeLine(text);
  const dates = getAllDates(text);
  const documentNumber =
    kind === "passport"
      ? normalizedText.match(/\b[A-Z][0-9]{7,8}\b/)?.[0]
      : normalizedText.match(/\b\d{12}\b/)?.[0];

  const genderText = normalizeLine(
    findValueByLabels(lines, ["GIOI TINH", "SEX", "GENDER"]) || "",
  );
  const gender = /\b(NU|FEMALE|F)\b/.test(genderText)
    ? "female"
    : /\b(NAM|MALE|M)\b/.test(genderText)
      ? "male"
      : undefined;

  const suggestion: OcrSuggestion = {
    documentNumber,
    fullName: findValueByLabels(lines, ["HO VA TEN", "FULL NAME", "SURNAME"]),
    issuedPlace: findValueByLabels(lines, ["NOI CAP", "PLACE OF ISSUE"]),
    dateOfBirth: findDateByLabels(lines, [
      "NGAY SINH",
      "DATE OF BIRTH",
      "BIRTH DATE",
      "DOB",
    ]),
    gender,
    nationality: findValueByLabels(lines, ["QUOC TICH", "NATIONALITY"]),
    placeOfOrigin: findValueByLabels(lines, [
      "QUE QUAN",
      "PLACE OF ORIGIN",
      "PLACE OF BIRTH",
    ]),
    placeOfResidence: findValueByLabels(lines, [
      "NOI THUONG TRU",
      "PLACE OF RESIDENCE",
      "ADDRESS",
    ]),
    issuedAt:
      findDateByLabels(lines, ["NGAY CAP", "DATE OF ISSUE", "ISSUED ON"]) ||
      (kind === "cccd_back" ? dates[0] : undefined),
    expiresAt:
      findDateByLabels(lines, [
        "CO GIA TRI DEN",
        "DATE OF EXPIRY",
        "EXPIRY DATE",
        "EXPIRES",
      ]) || (dates.length > 1 ? dates[dates.length - 1] : undefined),
    warnings: [],
  };

  if (!Object.values(suggestion).some((value) => typeof value === "string" && value)) {
    suggestion.warnings.push(
      "Không nhận diện được thông tin giấy tờ. Vui lòng nhập thủ công.",
    );
  }
  return suggestion;
};

const parseCertificate = (text: string): OcrSuggestion => {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const dates = getAllDates(text);
  const suggestion: OcrSuggestion = {
    title: lines.find((line) =>
      /CHỨNG\s*(CHỈ|NHẬN)|CERTIFICATE|DIPLOMA|BẰNG/i.test(line),
    ),
    certificateNumber: findValueByLabels(lines, [
      "SO HIEU",
      "SO CHUNG CHI",
      "CERTIFICATE NO",
      "CERTIFICATE NUMBER",
      "CREDENTIAL ID",
      "SERIAL NO",
    ]),
    issuer: findValueByLabels(lines, [
      "DON VI CAP",
      "CO QUAN CAP",
      "ISSUED BY",
      "ISSUING AUTHORITY",
    ]),
    issuedAt:
      findDateByLabels(lines, [
        "NGAY CAP",
        "NGAY HIEU LUC",
        "DATE OF ISSUE",
        "VALID FROM",
      ]) || dates[0],
    expiresAt:
      findDateByLabels(lines, [
        "NGAY HET HAN",
        "CO GIA TRI DEN",
        "EXPIRY DATE",
        "VALID UNTIL",
      ]) || (dates.length > 1 ? dates[dates.length - 1] : undefined),
    warnings: [],
  };

  if (
    !suggestion.title &&
    !suggestion.certificateNumber &&
    !suggestion.issuer &&
    !suggestion.issuedAt &&
    !suggestion.expiresAt
  ) {
    suggestion.warnings.push(
      "Không nhận diện được thông tin chứng chỉ. Vui lòng nhập thủ công.",
    );
  }
  return suggestion;
};

export const extractDocumentSuggestion = async (
  buffer: Buffer,
  mimeType: string,
  kind: OcrDocumentKind,
): Promise<OcrSuggestion> => {
  const result = await extractText(buffer, mimeType);
  const suggestion =
    kind === "certificate"
      ? parseCertificate(result.text)
      : parseIdentity(result.text, kind);
  suggestion.confidence = result.confidence;
  return suggestion;
};
