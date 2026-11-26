import { Category } from "../models/category.model";
import { Order } from "../models/order.model";
import { Service } from "../models/service.model";

async function loadAgentServiceCatalog() {
  const categoryIds = await Category.distinct("_id", { isActive: true, isDeleted: false });
  const filter = { isActive: true, isDeleted: false, categoryId: { $in: categoryIds } };
  const [total, services, popularServices] = await Promise.all([
    Service.countDocuments(filter),
    Service.find(filter).select("name serviceType").sort({ name: 1, _id: 1 }).limit(10).lean(),
    Order.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$serviceId", bookingCount: { $sum: 1 } } },
      { $lookup: { from: Service.collection.name, localField: "_id", foreignField: "_id", as: "service" } },
      { $unwind: "$service" },
      { $match: { "service.isActive": true, "service.isDeleted": false, "service.categoryId": { $in: categoryIds } } },
      { $sort: { bookingCount: -1, "service.name": 1, _id: 1 } },
      { $limit: 5 },
      { $project: { _id: 0, id: { $toString: "$_id" }, name: "$service.name", bookingCount: 1 } },
    ]),
  ]);
  return {
    total,
    services: services.map((service) => ({ id: String(service._id), name: service.name, serviceType: service.serviceType })),
    popularServices,
    note: "Tổng số chỉ gồm dịch vụ đang hoạt động trong danh mục đang hoạt động, chưa xóa. Danh sách minh họa tối đa 10 dịch vụ; dịch vụ phổ biến xếp theo số đơn chưa xóa trong toàn bộ thời gian, bao gồm đơn đã hủy. Nếu chưa có đơn, không có dữ liệu xếp hạng phổ biến.",
  };
}

type Catalog = Awaited<ReturnType<typeof loadAgentServiceCatalog>>;
const catalogTtlMs = 60_000;
let cached: { catalog: Catalog; expiresAt: number } | undefined;
let pending: Promise<Catalog> | undefined;

export function invalidateAgentServiceCatalog() {
  cached = undefined;
  pending = undefined;
}

export async function getAgentServiceCatalog(onCacheLookup?: (hit: boolean) => void) {
  if (cached && cached.expiresAt > Date.now()) {
    onCacheLookup?.(true);
    return structuredClone(cached.catalog);
  }
  if (pending) {
    onCacheLookup?.(true);
    return structuredClone(await pending);
  }

  onCacheLookup?.(false);
  const request = loadAgentServiceCatalog();
  pending = request;
  try {
    const catalog = await request;
    // Kết quả bắt đầu trước lần vô hiệu hóa không được ghi đè danh mục mới.
    if (pending === request) cached = { catalog, expiresAt: Date.now() + catalogTtlMs };
    return structuredClone(catalog);
  } finally {
    if (pending === request) pending = undefined;
  }
}
