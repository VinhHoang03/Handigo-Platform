import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import { Complaint, ComplaintStatus } from "../models/complaint.model";
import { ComplaintEvidence } from "../models/complaintEvidence.model";
import { Order } from "../models/order.model";
import { OrderStatus } from "../models/orderStatus.model";
import { Provider } from "../models/provider.model";

type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";

interface Query {
  page?: string | number;
  limit?: string | number;
  status?: string;
  keyword?: string;
  orderId?: string;
}

interface EvidenceFilePayload {
  fileType: "image" | "video" | "file";
  url: string;
  mimeType?: string | null;
  fileName?: string | null;
}

const TERMINAL_STATUSES: ComplaintStatus[] = ["resolved", "rejected", "cancelled"];

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

const getProviderByUserId = async (userId: string) => {
  return Provider.findOne({ userId, isDeleted: false }).select("_id userId");
};

const resolveOrderParticipant = async (userId: string, role: UserRole, orderId: string) => {
  assertObjectId(userId, "User id");
  assertObjectId(orderId, "Order id");

  const order = await Order.findOne({ _id: orderId, isDeleted: false });
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
    );
    if (!provider) throw new AppError("Không tìm thấy hồ sơ thợ", 404);
    complainantRole = "CUSTOMER";
    targetUserId = provider.userId;
  } else if (role === "PROVIDER") {
    const provider = await getProviderByUserId(userId);
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

const getCompletedAt = async (orderId: Types.ObjectId, fallback: Date) => {
  const completedStatus = await OrderStatus.findOne({
    orderId,
    status: "completed",
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean();

  return completedStatus?.createdAt ?? fallback;
};

const assertComplaintWindow = async (orderId: Types.ObjectId, fallback: Date) => {
  const completedAt = await getCompletedAt(orderId, fallback);
  const deadline = completedAt.getTime() + 3 * 24 * 60 * 60 * 1000;
  if (Date.now() > deadline) {
    throw new AppError("Chỉ có thể tạo khiếu nại trong vòng 3 ngày từ khi hoàn thành đơn", 400);
  }
};

const populateComplaint = () => [
  { path: "complainantId", select: "fullName email avatar role" },
  { path: "targetUserId", select: "fullName email avatar role" },
  { path: "orderId", select: "orderCode status paymentStatus" },
  { path: "resolvedBy", select: "fullName email" },
  { path: "reviewedBy", select: "fullName email" },
  { path: "createdViolationId", select: "violationType severity penaltyType status" },
];

const withEvidence = async (complaint: any) => {
  const value = typeof complaint.toObject === "function" ? complaint.toObject() : complaint;
  const evidence = await ComplaintEvidence.find({
    complaintId: value._id,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .populate("uploadedBy", "fullName email avatar role");

  return { ...value, evidence };
};

export const createComplaint = async (
  userId: string,
  role: UserRole,
  payload: {
    orderId: string;
    title: string;
    description: string;
    evidenceImages?: string[];
  },
) => {
  const { order, complainantRole, targetUserId } = await resolveOrderParticipant(
    userId,
    role,
    payload.orderId,
  );
  await assertComplaintWindow(order._id as Types.ObjectId, order.updatedAt);

  const existing = await Complaint.findOne({
    orderId: order._id,
    complainantId: userId,
    isDeleted: false,
  });
  if (existing) {
    throw new AppError("Bạn đã tạo khiếu nại cho đơn dịch vụ này", 400);
  }

  const complaint = await Complaint.create({
    orderId: order._id,
    complainantId: userId,
    complainantRole,
    targetUserId,
    title: payload.title,
    description: payload.description,
    evidenceImages: payload.evidenceImages ?? [],
  });

  const populated = await Complaint.findById(complaint._id).populate(populateComplaint());
  return withEvidence(populated);
};

export const getMyComplaints = async (userId: string, query: Query = {}) => {
  assertObjectId(userId, "User id");
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { complainantId: userId, isDeleted: false };

  if (query.status) filter.status = query.status;
  if (query.orderId && Types.ObjectId.isValid(query.orderId)) filter.orderId = query.orderId;

  const [items, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(populateComplaint()),
    Complaint.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getComplaintForUser = async (userId: string, complaintId: string) => {
  assertObjectId(userId, "User id");
  assertObjectId(complaintId, "Complaint id");
  const complaint = await Complaint.findOne({
    _id: complaintId,
    complainantId: userId,
    isDeleted: false,
  }).populate(populateComplaint());
  if (!complaint) throw new AppError("Không tìm thấy khiếu nại", 404);
  return withEvidence(complaint);
};

export const cancelComplaint = async (userId: string, complaintId: string) => {
  assertObjectId(userId, "User id");
  assertObjectId(complaintId, "Complaint id");
  const complaint = await Complaint.findOne({
    _id: complaintId,
    complainantId: userId,
    isDeleted: false,
  });
  if (!complaint) throw new AppError("Không tìm thấy khiếu nại", 404);
  if (TERMINAL_STATUSES.includes(complaint.status)) {
    throw new AppError("Khiếu nại đã kết thúc, không thể hủy", 400);
  }

  complaint.status = "cancelled";
  complaint.resolvedAt = new Date();
  await complaint.save();
  return getComplaintForUser(userId, complaintId);
};

export const addComplaintEvidence = async (
  userId: string,
  role: UserRole,
  complaintId: string,
  payload: { files: EvidenceFilePayload[]; note?: string | null },
) => {
  assertObjectId(userId, "User id");
  assertObjectId(complaintId, "Complaint id");
  const complaint = await Complaint.findOne({ _id: complaintId, isDeleted: false });
  if (!complaint) throw new AppError("Không tìm thấy khiếu nại", 404);

  if (role !== "ADMIN" && complaint.complainantId.toString() !== userId) {
    throw new AppError("Bạn không có quyền bổ sung bằng chứng cho khiếu nại này", 403);
  }
  if (TERMINAL_STATUSES.includes(complaint.status)) {
    throw new AppError("Khiếu nại đã kết thúc, không thể bổ sung bằng chứng", 400);
  }

  await ComplaintEvidence.insertMany(
    payload.files.map((file) => ({
      complaintId: complaint._id,
      uploadedBy: userId,
      fileType: file.fileType,
      url: file.url,
      mimeType: file.mimeType ?? null,
      fileName: file.fileName ?? null,
      note: payload.note ?? null,
    })),
  );

  if (complaint.status === "evidence_requested") {
    complaint.status = "under_review";
    await complaint.save();
  }

  const populated = await Complaint.findById(complaint._id).populate(populateComplaint());
  return withEvidence(populated);
};

export const getAdminComplaints = async (query: Query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (query.status) filter.status = query.status;
  if (query.orderId && Types.ObjectId.isValid(query.orderId)) filter.orderId = query.orderId;
  if (query.keyword?.trim()) {
    const keyword = query.keyword
      .trim()
      .replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
    const regex = new RegExp(keyword, "i");
    filter.$or = [{ title: regex }, { description: regex }];
  }

  const [items, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(populateComplaint()),
    Complaint.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getAdminComplaintById = async (complaintId: string) => {
  assertObjectId(complaintId, "Complaint id");
  const complaint = await Complaint.findOne({ _id: complaintId, isDeleted: false }).populate(
    populateComplaint(),
  );
  if (!complaint) throw new AppError("Không tìm thấy khiếu nại", 404);
  return withEvidence(complaint);
};

export const requestEvidence = async (
  adminId: string,
  complaintId: string,
  requestedEvidenceNote: string,
) => {
  assertObjectId(adminId, "Admin id");
  assertObjectId(complaintId, "Complaint id");
  const complaint = await Complaint.findOne({ _id: complaintId, isDeleted: false });
  if (!complaint) throw new AppError("Không tìm thấy khiếu nại", 404);
  if (TERMINAL_STATUSES.includes(complaint.status)) {
    throw new AppError("Khiếu nại đã kết thúc", 400);
  }

  complaint.status = "evidence_requested";
  complaint.reviewedBy = new Types.ObjectId(adminId);
  complaint.reviewedAt = new Date();
  complaint.requestedEvidenceNote = requestedEvidenceNote;
  await complaint.save();
  return getAdminComplaintById(complaintId);
};

export const updateComplaintStatus = async (
  adminId: string,
  complaintId: string,
  payload: { status: ComplaintStatus; resolutionNote?: string | null },
) => {
  assertObjectId(adminId, "Admin id");
  assertObjectId(complaintId, "Complaint id");
  const complaint = await Complaint.findOne({ _id: complaintId, isDeleted: false });
  if (!complaint) throw new AppError("Không tìm thấy khiếu nại", 404);
  if (complaint.createdViolationId && payload.status !== "resolved") {
    throw new AppError("Khiếu nại đã tạo vi phạm, chỉ có thể giữ trạng thái đã xử lý", 400);
  }

  complaint.status = payload.status;
  complaint.reviewedBy = new Types.ObjectId(adminId);
  complaint.reviewedAt = new Date();
  complaint.resolutionNote = payload.resolutionNote ?? complaint.resolutionNote ?? null;
  if (TERMINAL_STATUSES.includes(payload.status)) {
    complaint.resolvedBy = new Types.ObjectId(adminId);
    complaint.resolvedAt = new Date();
  }
  await complaint.save();
  return getAdminComplaintById(complaintId);
};
