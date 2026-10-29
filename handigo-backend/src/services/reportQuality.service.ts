import { ClientSession, Types } from "mongoose";
import { AppError } from "../utils/appError";
import { Report } from "../models/report.model";
import { Order } from "../models/order.model";
import { OrderStatus } from "../models/orderStatus.model";
import { Provider } from "../models/provider.model";
type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`${fieldName} không hợp lệ`, 400);
  }
};

const getProviderByUserId = async (userId: string, session?: ClientSession) => {
  return Provider.findOne({ userId, isDeleted: false }).select("_id userId").session(session ?? null);
};

const resolveOrderParticipant = async (userId: string, role: UserRole, orderId: string, session?: ClientSession) => {
  assertObjectId(userId, "User id");
  assertObjectId(orderId, "Order id");

  const order = await Order.findOne({ _id: orderId, isDeleted: false }).session(session ?? null);
  if (!order) throw new AppError("Không tìm thấy đơn dịch vụ", 404);
  if (order.status !== "completed") {
    throw new AppError("Chỉ có thể khiếu nại đơn dịch vụ đã hoàn thành", 400);
  }
  if (!order.providerId) {
    throw new AppError("Đơn dịch vụ chưa có thợ thực hiện", 400);
  }

  let complainantRole: "CUSTOMER" | "PROVIDER";
  let targetUserId: Types.ObjectId;

  if (role === "CUSTOMER" && order.customerId.toString() === userId) {
    const provider = await Provider.findOne({ _id: order.providerId, isDeleted: false }).select(
      "userId",
    ).session(session ?? null);
    if (!provider) throw new AppError("Không tìm thấy hồ sơ thợ", 404);
    complainantRole = "CUSTOMER";
    targetUserId = provider.userId;
  } else if (role === "PROVIDER") {
    const provider = await getProviderByUserId(userId, session);
    if (!provider || order.providerId.toString() !== provider._id.toString()) {
      throw new AppError("Bạn không có quyền khiếu nại đơn dịch vụ này", 403);
    }
    complainantRole = "PROVIDER";
    targetUserId = order.customerId;
  } else {
    throw new AppError("Chỉ khách hàng và thợ được tạo khiếu nại", 403);
  }

  return { order, complainantRole, targetUserId };
};

const getCompletedAt = async (orderId: Types.ObjectId, fallback: Date, session?: ClientSession) => {
  const completedStatus = await OrderStatus.findOne({
    orderId,
    status: "completed",
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .session(session ?? null)
    .lean();

  return completedStatus?.createdAt ?? fallback;
};

const assertComplaintWindow = async (orderId: Types.ObjectId, fallback: Date, session?: ClientSession) => {
  const completedAt = await getCompletedAt(orderId, fallback, session);
  const deadline = completedAt.getTime() + 3 * 24 * 60 * 60 * 1000;
  if (Date.now() > deadline) {
    throw new AppError("Chỉ có thể tạo khiếu nại trong vòng 3 ngày từ khi hoàn thành đơn", 400);
  }
};

export const getServiceQualityReportContext = async (
  userId: string,
  role: UserRole,
  orderId: string,
  session?: ClientSession,
) => {
  const { order, complainantRole, targetUserId } = await resolveOrderParticipant(
    userId,
    role,
    orderId,
    session,
  );
  await assertComplaintWindow(order._id as Types.ObjectId, order.updatedAt, session);

  const existing = await Report.findOne({
    orderId: order._id,
    reporterId: userId,
    reportType: "service_quality",
    isDeleted: false,
  }).session(session ?? null);
  if (existing) {
    throw new AppError("Bạn đã tạo khiếu nại cho đơn dịch vụ này", 400);
  }

  return { order, complainantRole, targetUserId };
};

