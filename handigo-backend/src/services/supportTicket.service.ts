import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import User from "../models/user.model";
import {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "../models/supportTicket.model";

type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

interface Query {
  page?: string | number;
  limit?: string | number;
  status?: string;
  category?: string;
  priority?: string;
  keyword?: string;
  assignedAdminId?: string;
  assignment?: "assigned" | "unassigned";
}

interface AttachmentPayload {
  fileType: "image" | "video" | "file";
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
}

const TERMINAL_STATUSES: SupportTicketStatus[] = ["resolved", "closed", "cancelled"];
const ACTIVE_STATUSES: SupportTicketStatus[] = ["open", "in_progress", "waiting_user"];
const ADMIN_STATUS_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  open: ["in_progress", "waiting_user", "resolved"],
  in_progress: ["waiting_user", "resolved"],
  waiting_user: ["in_progress", "resolved"],
  resolved: ["in_progress", "closed"],
  closed: [],
  cancelled: [],
};

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`${fieldName} không hợp lệ`, 400);
  }
};

const getPagination = (query: Query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

const getAdminSupportSummary = async () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [summary] = await SupportTicket.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $in: ["$status", ACTIVE_STATUSES] }, 1, 0] },
        },
        urgentActive: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ACTIVE_STATUSES] },
                  { $eq: ["$priority", "URGENT"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        unassignedActive: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ACTIVE_STATUSES] },
                  { $eq: [{ $ifNull: ["$assignedAdminId", null] }, null] },
                ],
              },
              1,
              0,
            ],
          },
        },
        waitingUser: {
          $sum: { $cond: [{ $eq: ["$status", "waiting_user"] }, 1, 0] },
        },
        resolvedToday: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ["resolved", "closed"]] },
                  { $gte: ["$resolvedAt", startOfToday] },
                ],
              },
              1,
              0,
            ],
          },
        },
        oldestActiveAt: {
          $min: {
            $cond: [{ $in: ["$status", ACTIVE_STATUSES] }, "$createdAt", "$$REMOVE"],
          },
        },
        averageResolutionMs: {
          $avg: {
            $cond: [
              {
                $and: [
                  { $in: ["$status", ["resolved", "closed"]] },
                  { $ne: ["$resolvedAt", null] },
                ],
              },
              { $subtract: ["$resolvedAt", "$createdAt"] },
              null,
            ],
          },
        },
      },
    },
    { $project: { _id: 0 } },
  ]);

  return summary ?? {
    total: 0,
    active: 0,
    urgentActive: 0,
    unassignedActive: 0,
    waitingUser: 0,
    resolvedToday: 0,
    oldestActiveAt: null,
    averageResolutionMs: 0,
  };
};

const normalizeAttachments = (attachments: AttachmentPayload[] = []) =>
  attachments.map((file) => ({
    fileType: file.fileType,
    url: file.url,
    mimeType: file.mimeType ?? null,
    fileName: file.fileName ?? null,
    uploadedAt: new Date(),
  }));

const populateTicket = () => [
  { path: "requesterId", select: "fullName email avatar role" },
  { path: "orderId", select: "orderCode status paymentStatus" },
  { path: "assignedAdminId", select: "fullName email" },
  { path: "resolvedBy", select: "fullName email" },
  { path: "responses.responderId", select: "fullName email avatar role" },
  { path: "createdViolationId", select: "violationType severity penaltyType status" },
];

const assertOrderVisibleToRequester = async (
  requesterId: string,
  role: UserRole,
  orderId?: string | null,
) => {
  if (!orderId) return null;
  assertObjectId(orderId, "Order id");
  const order = await Order.findOne({ _id: orderId, isDeleted: false }).select(
    "customerId providerId",
  );
  if (!order) throw new AppError("Không tìm thấy đơn dịch vụ", 404);

  if (role === "CUSTOMER" && order.customerId.toString() === requesterId) {
    return order._id;
  }

  if (role === "PROVIDER") {
    const provider = await Provider.findOne({ userId: requesterId, isDeleted: false }).select("_id");
    if (provider && order.providerId?.toString() === provider._id.toString()) {
      return order._id;
    }
  }

  throw new AppError("Bạn không có quyền tạo yêu cầu hỗ trợ cho đơn này", 403);
};

export const createSupportTicket = async (
  requesterId: string,
  role: UserRole,
  payload: {
    orderId?: string | null;
    category: SupportTicketCategory;
    priority?: SupportTicketPriority;
    subject: string;
    description: string;
    attachments?: AttachmentPayload[];
  },
) => {
  assertObjectId(requesterId, "User id");
  if (!["CUSTOMER", "PROVIDER"].includes(role)) {
    throw new AppError("Chỉ khách hàng và thợ được tạo yêu cầu hỗ trợ", 403);
  }

  const orderId = await assertOrderVisibleToRequester(requesterId, role, payload.orderId);
  const ticket = await SupportTicket.create({
    requesterId,
    orderId,
    category: payload.category,
    priority: payload.priority ?? "MEDIUM",
    subject: payload.subject,
    description: payload.description,
    attachments: normalizeAttachments(payload.attachments),
  });

  return SupportTicket.findById(ticket._id).populate(populateTicket());
};

export const getMySupportTickets = async (requesterId: string, query: Query = {}) => {
  assertObjectId(requesterId, "User id");
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { requesterId, isDeleted: false };

  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.priority) filter.priority = query.priority;

  const [items, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(populateTicket()),
    SupportTicket.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getSupportTicketForUser = async (requesterId: string, ticketId: string) => {
  assertObjectId(requesterId, "User id");
  assertObjectId(ticketId, "Support ticket id");
  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    requesterId,
    isDeleted: false,
  }).populate(populateTicket());
  if (!ticket) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);
  return ticket;
};

export const addSupportTicketResponse = async (
  userId: string,
  role: UserRole,
  ticketId: string,
  payload: { message: string; attachments?: AttachmentPayload[] },
) => {
  assertObjectId(userId, "User id");
  assertObjectId(ticketId, "Support ticket id");
  const ticket = await SupportTicket.findOne({ _id: ticketId, isDeleted: false });
  if (!ticket) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);

  if (role !== "ADMIN" && ticket.requesterId.toString() !== userId) {
    throw new AppError("Bạn không có quyền phản hồi yêu cầu hỗ trợ này", 403);
  }
  if (TERMINAL_STATUSES.includes(ticket.status)) {
    throw new AppError("Yêu cầu hỗ trợ đã kết thúc, không thể phản hồi", 400);
  }

  ticket.responses.push({
    responderId: new Types.ObjectId(userId),
    responderRole: role === "ADMIN" ? "ADMIN" : "USER",
    message: payload.message,
    attachments: normalizeAttachments(payload.attachments),
    respondedAt: new Date(),
  });

  if (role === "ADMIN" && ticket.status === "open") {
    ticket.status = "in_progress";
    ticket.assignedAdminId = ticket.assignedAdminId ?? new Types.ObjectId(userId);
  } else if (role !== "ADMIN" && ticket.status === "waiting_user") {
    ticket.status = "in_progress";
  }

  await ticket.save();
  return SupportTicket.findById(ticket._id).populate(populateTicket());
};

export const cancelSupportTicket = async (requesterId: string, ticketId: string) => {
  assertObjectId(requesterId, "User id");
  assertObjectId(ticketId, "Support ticket id");
  const ticket = await SupportTicket.findOne({
    _id: ticketId,
    requesterId,
    isDeleted: false,
  });
  if (!ticket) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);
  if (TERMINAL_STATUSES.includes(ticket.status)) {
    throw new AppError("Yêu cầu hỗ trợ đã kết thúc", 400);
  }

  ticket.status = "cancelled";
  ticket.resolvedAt = new Date();
  await ticket.save();
  return getSupportTicketForUser(requesterId, ticketId);
};

export const getAdminSupportTickets = async (query: Query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.priority) filter.priority = query.priority;
  if (query.assignedAdminId) filter.assignedAdminId = query.assignedAdminId;
  if (query.assignment === "assigned") filter.assignedAdminId = { $ne: null };
  if (query.assignment === "unassigned") filter.assignedAdminId = null;
  if (query.keyword?.trim()) {
    const keyword = query.keyword
      .trim()
      .replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
    const regex = new RegExp(keyword, "i");
    filter.$or = [{ subject: regex }, { description: regex }];
  }

  const [items, total, summary] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(populateTicket()),
    SupportTicket.countDocuments(filter),
    getAdminSupportSummary(),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary,
  };
};

export const getAdminSupportTicketById = async (ticketId: string) => {
  assertObjectId(ticketId, "Support ticket id");
  const ticket = await SupportTicket.findOne({ _id: ticketId, isDeleted: false }).populate(
    populateTicket(),
  );
  if (!ticket) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);
  return ticket;
};

export const updateSupportTicketStatus = async (
  adminId: string,
  ticketId: string,
  payload: { status: SupportTicketStatus; resolutionNote?: string | null },
) => {
  assertObjectId(adminId, "Admin id");
  assertObjectId(ticketId, "Support ticket id");
  const ticket = await SupportTicket.findOne({ _id: ticketId, isDeleted: false });
  if (!ticket) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);
  if (ticket.createdViolationId && payload.status !== "resolved") {
    throw new AppError("Yêu cầu hỗ trợ đã tạo vi phạm, chỉ có thể giữ trạng thái đã xử lý", 400);
  }
  if (
    payload.status !== ticket.status &&
    !ADMIN_STATUS_TRANSITIONS[ticket.status].includes(payload.status)
  ) {
    throw new AppError(
      "Không thể chuyển yêu cầu hỗ trợ từ " + ticket.status + " sang " + payload.status,
      400,
    );
  }

  ticket.status = payload.status;
  ticket.assignedAdminId = ticket.assignedAdminId ?? new Types.ObjectId(adminId);
  ticket.resolutionNote = payload.resolutionNote ?? ticket.resolutionNote ?? null;
  if (TERMINAL_STATUSES.includes(payload.status)) {
    ticket.resolvedBy = new Types.ObjectId(adminId);
    ticket.resolvedAt = new Date();
  } else {
    ticket.resolvedBy = null;
    ticket.resolvedAt = null;
    if (payload.status === "in_progress") {
      ticket.resolutionNote = null;
    }
  }
  await ticket.save();
  return getAdminSupportTicketById(ticketId);
};

export const assignSupportTicket = async (
  adminId: string,
  ticketId: string,
  assignedAdminId?: string | null,
) => {
  assertObjectId(adminId, "Admin id");
  assertObjectId(ticketId, "Support ticket id");
  if (assignedAdminId) assertObjectId(assignedAdminId, "Assigned admin id");

  const targetAdminId = assignedAdminId ?? adminId;
  const targetAdmin = await User.exists({
    _id: targetAdminId,
    role: "ADMIN",
    status: "active",
    isDeleted: false,
  });
  if (!targetAdmin) {
    throw new AppError("Quản trị viên được phân công không hợp lệ hoặc đã bị khóa", 400);
  }

  const existingTicket = await SupportTicket.findOne({
    _id: ticketId,
    isDeleted: false,
  }).select("status");
  if (!existingTicket) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);
  if (TERMINAL_STATUSES.includes(existingTicket.status)) {
    throw new AppError("Yêu cầu hỗ trợ đã kết thúc, không thể phân công", 400);
  }

  const ticket = await SupportTicket.findOneAndUpdate(
    { _id: ticketId, isDeleted: false },
    {
      assignedAdminId: new Types.ObjectId(targetAdminId),
      status: existingTicket.status === "open" ? "in_progress" : existingTicket.status,
    },
    { new: true, runValidators: true },
  ).populate(populateTicket());

  if (!ticket) throw new AppError("Không tìm thấy yêu cầu hỗ trợ", 404);
  return ticket;
};
