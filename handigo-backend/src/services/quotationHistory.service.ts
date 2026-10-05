import { RepairQuotation } from "../models/repairQuotation.model";
import { RepairQuotationItem } from "../models/repairQuotationItem.model";
import { Order, type IOrder } from "../models/order.model";
import { Types } from "mongoose";

export interface QuotationHistoryItem {
  id: string;
  title: string;
  description: string;
  itemType: "labor" | "material" | "replacement_part" | "other";
  unitPrice: number;
  usedAt: string;
}

export const normalizeQuotationSearch = (value: string) => value.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function matchQuotationHistory(items: QuotationHistoryItem[], query: string) {
  const normalized = normalizeQuotationSearch(query);
  const tokens = normalized.split(" ").filter(Boolean);
  if (!tokens.length) return { items: [] as QuotationHistoryItem[], autoFillId: null as string | null };
  const seen = new Set<string>();
  const matches = items.filter((item) => {
    const text = normalizeQuotationSearch(`${item.title} ${item.description}`);
    if (!tokens.every((token) => /^\d+$/.test(token) ? text.split(" ").includes(token) : text.includes(token))) return false;
    const key = JSON.stringify([normalizeQuotationSearch(item.title), normalizeQuotationSearch(item.description), item.itemType, item.unitPrice]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const exact = matches.filter((item) => normalizeQuotationSearch(item.title) === normalized);
  return { items: matches.slice(0, 8), autoFillId: matches.length === 1 && exact.length === 1 ? exact[0].id : null };
}

// Dùng index providerId/createdAt và quotationId hiện có, giới hạn dữ liệu trước khi đối chiếu tên.
export async function loadQuotationHistory(order: Pick<IOrder, "providerId" | "serviceId">): Promise<QuotationHistoryItem[]> {
  const quotations = await RepairQuotation.aggregate<{ _id: Types.ObjectId; createdAt: Date }>([
    { $match: { providerId: order.providerId, status: { $in: ["approved", "saved"] }, isDeleted: { $ne: true } } },
    { $sort: { createdAt: -1 } },
    { $limit: 200 },
    { $lookup: { from: Order.collection.name, localField: "orderId", foreignField: "_id", as: "order" } },
    { $match: { "order.serviceId": order.serviceId, "order.isDeleted": { $ne: true } } },
    { $project: { _id: 1, createdAt: 1 } },
  ]).option({ maxTimeMS: 5000 });
  if (!quotations.length) return [];
  const dates = new Map(quotations.map((q) => [String(q._id), new Date(q.createdAt).toISOString()]));
  const items = await RepairQuotationItem.find({ quotationId: { $in: quotations.map((q) => q._id) },
    isDeleted: { $ne: true }, unitPrice: { $gt: 0 } })
    .select("_id quotationId title description itemType unitPrice").limit(20_000).maxTimeMS(5000).lean();
  return items.map((item) => ({ id: String(item._id), title: item.title, description: item.description || "",
    itemType: item.itemType, unitPrice: item.unitPrice, usedAt: dates.get(String(item.quotationId))! }))
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt));
}
