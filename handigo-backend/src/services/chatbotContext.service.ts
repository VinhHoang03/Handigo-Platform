import { createHash } from "crypto";
import { Types } from "mongoose";
import type { RequestUser } from "../middlewares/authContext";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { Service } from "../models/service.model";

const RECENT_ORDER_LIMIT = 5;
const SERVICE_LIMIT = 12;

const getPageOrderId = (path: string) => {
  const match = path.match(/\/(?:bookings|orders)\/([0-9a-fA-F]{24})(?:\/|$)/);
  return match?.[1];
};

const getOrderContext = async (
  user: RequestUser,
  providerId?: Types.ObjectId,
) => {
  if (user.role === "PROVIDER" && !providerId) return [];
  const ownership =
    user.role === "CUSTOMER" ? { customerId: user.id } : { providerId };
  return Order.find({ ...ownership, isDeleted: false })
    .select("orderCode serviceId status bookingStatus scheduledAt orderType")
    .sort({ createdAt: -1 })
    .limit(RECENT_ORDER_LIMIT)
    .populate("serviceId", "name")
    .lean();
};

const getPageOrder = async (
  user: RequestUser,
  orderId: string | undefined,
  providerId?: Types.ObjectId,
) => {
  if (!orderId || (user.role === "PROVIDER" && !providerId)) return null;
  const ownership =
    user.role === "CUSTOMER" ? { customerId: user.id } : { providerId };
  return Order.findOne({ _id: orderId, ...ownership, isDeleted: false })
    .select("orderCode serviceId status bookingStatus scheduledAt orderType")
    .populate("serviceId", "name")
    .lean();
};

const removeInternalIdentifiers = (key: string, value: unknown) => {
  if (["_id", "__v", "userId", "customerId", "providerId"].includes(key)) {
    return undefined;
  }
  return value;
};

export const buildChatbotContext = async (
  user: RequestUser,
  currentPath: string,
) => {
  const anonymousUserId = createHash("sha256").update(user.id).digest("hex").slice(0, 16);
  const provider =
    user.role === "PROVIDER"
      ? await Provider.findOne({ userId: user.id, isDeleted: false })
          .select("_id availabilityStatus verified serviceIds workingAreas")
          .populate("serviceIds", "name")
          .lean()
      : null;
  const pageOrderId = getPageOrderId(currentPath);
  const [orders, services, pageOrder] = await Promise.all([
    getOrderContext(user, provider?._id),
    user.role === "CUSTOMER"
      ? Service.find({ isActive: true, isDeleted: false })
          .select("name serviceType fixedPrice")
          .limit(SERVICE_LIMIT)
          .lean()
      : Promise.resolve([]),
    getPageOrder(user, pageOrderId, provider?._id),
  ]);

  return JSON.stringify(
    {
      user: { id: anonymousUserId, role: user.role },
      currentPage: currentPath.replace(/[0-9a-fA-F]{24}/g, ":id"),
      currentPageOrder: pageOrder,
      recentOrders: orders,
      availableServices: services,
      provider: provider
        ? {
            availabilityStatus: provider.availabilityStatus,
            verified: provider.verified,
            workingAreas: provider.workingAreas,
            services: provider.serviceIds,
          }
        : null,
    },
    removeInternalIdentifiers,
  );
};
