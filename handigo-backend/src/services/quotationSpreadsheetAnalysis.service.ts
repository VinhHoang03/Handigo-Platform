import { readSheet, type Row } from "read-excel-file/node";
import { AppError } from "../utils/appError";
import {
  normalizeScannedQuotationItems,
  type ScannedQuotationItem,
} from "./quotationImageAnalysis.service";

type QuotationColumn =
  | "title"
  | "description"
  | "itemType"
  | "quantity"
  | "unitPrice"
  | "note";

const MAX_HEADER_ROWS = 20;
const MAX_SCANNED_ITEMS = 100;
type SpreadsheetRow = Row<number>;

const HEADER_ALIASES: Record<QuotationColumn, Set<string>> = {
  title: new Set([
    "hang muc",
    "ten hang muc",
    "cong viec",
    "ten cong viec",
    "san pham",
    "ten san pham",
    "noi dung",
  ]),
  description: new Set(["mo ta", "dien giai", "chi tiet"]),
  itemType: new Set(["loai", "loai hang muc", "phan loai"]),
  quantity: new Set(["so luong", "sl", "qty", "quantity"]),
  unitPrice: new Set(["don gia", "gia", "gia tien", "unit price"]),
  note: new Set(["ghi chu", "note"]),
};

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getCellValue = (row: SpreadsheetRow, columnIndex: number): unknown =>
  row[columnIndex] ?? "";

const findColumn = (header: string): QuotationColumn | undefined =>
  (Object.entries(HEADER_ALIASES) as [QuotationColumn, Set<string>][]).find(
    ([, aliases]) => aliases.has(header),
  )?.[0];

const findHeader = (rows: SpreadsheetRow[]) => {
  let bestMatch:
    | { rowIndex: number; columns: Map<QuotationColumn, number> }
    | undefined;

  const headerRowCount = Math.min(rows.length, MAX_HEADER_ROWS);
  for (let rowIndex = 0; rowIndex < headerRowCount; rowIndex += 1) {
    const columns = new Map<QuotationColumn, number>();
    rows[rowIndex].forEach((cell, columnIndex) => {
      const column = findColumn(normalizeHeader(String(cell ?? "")));
      if (column && !columns.has(column)) columns.set(column, columnIndex);
    });

    if (
      columns.has("title") &&
      (!bestMatch || columns.size > bestMatch.columns.size)
    ) {
      bestMatch = { rowIndex, columns };
    }
  }

  return bestMatch;
};

const normalizeItemType = (value: unknown) => {
  const normalized = normalizeHeader(String(value ?? ""));
  if (normalized.includes("nhan cong") || normalized === "labor") {
    return "labor";
  }
  if (
    normalized.includes("linh kien") ||
    normalized.includes("phu tung") ||
    normalized.includes("thay the") ||
    normalized === "replacement part"
  ) {
    return "replacement_part";
  }
  if (
    normalized.includes("vat tu") ||
    normalized.includes("vat lieu") ||
    normalized === "material"
  ) {
    return "material";
  }
  return "other";
};

export const analyzeQuotationSpreadsheet = async (
  buffer: Buffer,
): Promise<ScannedQuotationItem[]> => {
  let rows: SpreadsheetRow[];
  try {
    rows = await readSheet(buffer);
  } catch {
    throw new AppError(
      "Không thể đọc tệp Excel. Vui lòng kiểm tra lại định dạng .xlsx.",
      422,
    );
  }

  if (!rows.length) {
    throw new AppError("Tệp Excel không có trang tính để đọc.", 422);
  }

  const header = findHeader(rows);
  if (!header) {
    throw new AppError(
      'Không tìm thấy cột "Tên hạng mục" hoặc "Hạng mục" trong tệp Excel.',
      422,
    );
  }

  const rawItems: Record<string, unknown>[] = [];
  for (
    let rowIndex = header.rowIndex + 1;
    rowIndex < rows.length && rawItems.length < MAX_SCANNED_ITEMS;
    rowIndex += 1
  ) {
    const row = rows[rowIndex];
    const titleColumn = header.columns.get("title");
    if (titleColumn === undefined) break;

    const title = getCellValue(row, titleColumn);
    if (!String(title ?? "").trim()) continue;

    const getValue = (column: QuotationColumn) => {
      const columnIndex = header.columns.get(column);
      return columnIndex === undefined ? "" : getCellValue(row, columnIndex);
    };

    rawItems.push({
      title,
      description: getValue("description"),
      itemType: normalizeItemType(getValue("itemType")),
      quantity: getValue("quantity") || 1,
      unitPrice: getValue("unitPrice") || 0,
      note: getValue("note"),
    });
  }

  const items = normalizeScannedQuotationItems({ items: rawItems });
  if (!items.length) {
    throw new AppError(
      "Không tìm thấy dòng hạng mục hợp lệ trong tệp Excel.",
      422,
    );
  }

  return items;
};
