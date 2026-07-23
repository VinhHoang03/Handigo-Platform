import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RepairQuotationItemType } from "../models/repairQuotationItem.model";
import { AppError } from "../utils/appError";

export interface ScannedQuotationItem {
  title: string;
  description: string;
  itemType: RepairQuotationItemType;
  quantity: number;
  unitPrice: number;
  note: string;
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_SCANNED_ITEMS = 100;
const ITEM_TYPES = new Set<RepairQuotationItemType>([
  "labor",
  "material",
  "replacement_part",
  "other",
]);

const getGeminiApiKey = () => process.env.GEMINI_API_KEY_1?.trim();

const extractJsonObject = (text: string) => {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini không trả về JSON hợp lệ");
  }
  return cleaned.slice(start, end + 1);
};

const normalizeText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizePositiveInteger = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.trunc(parsed), 1000);
};

const normalizePrice = (value: unknown) => {
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^\d-]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
};

export const normalizeScannedQuotationItems = (
  value: unknown,
): ScannedQuotationItem[] => {
  const rawItems = Array.isArray((value as { items?: unknown })?.items)
    ? (value as { items: unknown[] }).items
    : [];

  return rawItems
    .slice(0, MAX_SCANNED_ITEMS)
    .map((rawItem) => {
      const item = rawItem as Record<string, unknown>;
      const itemType = ITEM_TYPES.has(item.itemType as RepairQuotationItemType)
        ? (item.itemType as RepairQuotationItemType)
        : "other";

      return {
        title: normalizeText(item.title, 200),
        description: normalizeText(item.description, 2000),
        itemType,
        quantity: normalizePositiveInteger(item.quantity),
        unitPrice: normalizePrice(item.unitPrice),
        note: normalizeText(item.note, 1000),
      };
    })
    .filter((item) => item.title);
};

export const analyzeQuotationImage = async (
  buffer: Buffer,
  mimeType: string,
): Promise<ScannedQuotationItem[]> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new AppError("Chưa cấu hình GEMINI_API_KEY_1", 503);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_QUOTATION_MODEL || DEFAULT_MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const prompt = [
    "Bạn là trợ lý nhập liệu báo giá sửa chữa tại nhà của Handigo.",
    "Hãy đọc ảnh chụp giấy viết tay, bảng tính Excel hoặc bảng báo giá và tách từng dòng thành một hạng mục độc lập.",
    "Chỉ lấy dữ liệu thật sự nhìn thấy trong ảnh, không tự bịa thêm hạng mục, số lượng hoặc đơn giá.",
    "Bỏ qua tiêu đề bảng, dòng tổng cộng, tạm tính, giảm giá và các dòng không phải hạng mục.",
    "Chuẩn hóa itemType thành đúng một trong: labor (nhân công), material (vật tư), replacement_part (linh kiện thay thế), other (khác).",
    "Nếu không thấy số lượng thì dùng 1. Nếu không thấy đơn giá thì dùng 0.",
    "Đơn giá phải là số VND không âm, không chứa ký hiệu tiền tệ hoặc dấu phân cách.",
    "Tối đa 100 hạng mục.",
    'Chỉ trả về JSON đúng schema: {"items":[{"title":"string","description":"string","itemType":"labor|material|replacement_part|other","quantity":1,"unitPrice":0,"note":"string"}]}.',
    "Nếu ảnh không có hạng mục báo giá có thể đọc được, trả về {\"items\":[]}.",
  ].join(" ");

  let items: ScannedQuotationItem[];
  try {
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType,
        },
      },
    ]);
    const parsed = JSON.parse(extractJsonObject(result.response.text()));
    items = normalizeScannedQuotationItems(parsed);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Không thể phân tích ảnh hạng mục bằng Gemini. Vui lòng thử lại.",
      502,
    );
  }

  if (!items.length) {
    throw new AppError(
      "Không nhận diện được hạng mục báo giá trong ảnh. Vui lòng dùng ảnh rõ nét hơn hoặc nhập thủ công.",
      422,
    );
  }

  return items;
};
