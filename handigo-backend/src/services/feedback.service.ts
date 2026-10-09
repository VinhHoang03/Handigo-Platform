import { serviceImageResponse } from "../utils/serviceImageResponse";
import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import { Feedback } from "../models/feedback.model";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { OrderStatus } from "../models/orderStatus.model";
import { Service } from "../models/service.model";

interface FeedbackPayload {
  orderId: string;
  rating: number;
  comment?: string | null;
  images?: string[];
}

interface UpdateFeedbackPayload {
  rating?: number;
  comment?: string | null;
  images?: string[];
}

interface PaginationQuery {
  page?: string | number;
  limit?: string | number;
  rating?: string | number;
  hasImages?: string | boolean;
  replied?: string | boolean;
  keyword?: string;
  isVisible?: string | boolean;
}

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Định danh ${fieldName} không hợp lệ`, 400);
  }
};

const getPagination = (query: PaginationQuery) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

export const recalculateProviderRating = async (providerId: Types.ObjectId | string) => {
  const providerObjectId =
    typeof providerId === "string" ? new Types.ObjectId(providerId) : providerId;
  const orderIds = await Order.find({
    providerId: providerObjectId,
    isDeleted: false,
  }).distinct("_id");

  const [stats] = await Feedback.aggregate<{
    averageRating: number;
    totalFeedbacks: number;
  }>([
    {
      $match: {
        orderId: { $in: orderIds },
        isVisible: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalFeedbacks: { $sum: 1 },
      },
    },
  ]);

  await Provider.findByIdAndUpdate(providerObjectId, {
    averageRating: stats ? Number(stats.averageRating.toFixed(1)) : 0,
    totalFeedbacks: stats?.totalFeedbacks || 0,
  });
};

export const createFeedback = async (userId: string, payload: FeedbackPayload) => {
  assertObjectId(userId, "người dùng");
  assertObjectId(payload.orderId, "đơn hàng");

  const order = await Order.findOne({
    _id: payload.orderId,
    isDeleted: false,
  });

  if (!order) {
    throw new AppError("Không tìm thấy đơn dịch vụ", 404);
  }

  if (order.customerId.toString() !== userId) {
    throw new AppError("Bạn chỉ có thể đánh giá đơn dịch vụ của mình", 403);
  }

  if (order.status !== "completed") {
    throw new AppError("Chỉ có thể đánh giá đơn dịch vụ đã hoàn thành", 400);
  }

  if (!order.providerId) {
    throw new AppError("Đơn dịch vụ chưa có thợ thực hiện", 400);
  }

  const existingFeedback = await Feedback.findOne({
    orderId: order._id,
    isDeleted: false,
  });

  if (existingFeedback) {
    throw new AppError("Đơn dịch vụ này đã được đánh giá", 400);
  }

  const feedback = await Feedback.create({
    orderId: order._id,
    customerId: order.customerId,
    providerId: order.providerId,
    serviceId: order.serviceId,
    rating: payload.rating,
    comment: payload.comment ?? null,
    images: payload.images ?? [],
  });

  await recalculateProviderRating(order.providerId);

  return feedback;
};

export const updateMyFeedback = async (
  userId: string,
  feedbackId: string,
  payload: UpdateFeedbackPayload,
) => {
  assertObjectId(userId, "người dùng");
  assertObjectId(feedbackId, "đánh giá");

  const feedback = await Feedback.findOne({
    _id: feedbackId,
    customerId: userId,
    isDeleted: false,
  });

  if (!feedback) {
    throw new AppError("Không tìm thấy đánh giá", 404);
  }

  if (payload.rating !== undefined) {
    feedback.rating = payload.rating;
  }

  if (payload.comment !== undefined) {
    feedback.comment = payload.comment;
  }

  if (payload.images !== undefined) {
    feedback.images = payload.images;
  }

  await feedback.save();
  await recalculateProviderRating(feedback.providerId);

  return feedback;
};

export const getMyFeedbacks = async (userId: string) => {
  assertObjectId(userId, "người dùng");

  return Feedback.find({
    customerId: userId,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .populate("orderId", "orderCode status")
    .populate({
      path: "providerId",
      select: "userId averageRating totalFeedbacks",
      populate: { path: "userId", select: "fullName avatar" },
    })
    .populate({ path: "serviceId", select: "name image coverImage", transform: serviceImageResponse });
};

export const getLatestPublicFeedbacks = async () => {
  return Feedback.find({
    isVisible: true,
    isDeleted: false,
    rating: { $gte: 4 },
  })
    .sort({ rating: -1, createdAt: -1 })
    .populate("customerId", "fullName avatar")
    .populate("serviceId", "name")
    .populate("providerReply.repliedBy", "fullName avatar")
    .lean();
};

export const getFeedbackByOrder = async (userId: string, orderId: string) => {
  assertObjectId(userId, "người dùng");
  assertObjectId(orderId, "đơn hàng");

  const order = await Order.findOne({
    _id: orderId,
    customerId: userId,
    isDeleted: false,
  });

  if (!order) {
    throw new AppError("Không tìm thấy đơn dịch vụ", 404);
  }

  return Feedback.findOne({
    orderId,
    customerId: userId,
    isDeleted: false,
  })
    .populate("orderId", "orderCode status")
    .populate({
      path: "providerId",
      select: "userId averageRating totalFeedbacks",
      populate: { path: "userId", select: "fullName avatar" },
    })
    .populate({ path: "serviceId", select: "name image coverImage", transform: serviceImageResponse })
    .populate("providerReply.repliedBy", "fullName avatar");
};

export const getProviderFeedbackByOrder = async (userId: string, orderId: string) => {
  assertObjectId(userId, "người dùng");
  assertObjectId(orderId, "đơn hàng");

  const provider = await Provider.findOne({ userId, isDeleted: false }).select("_id");
  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ thợ", 404);
  }

  const order = await Order.findOne({
    _id: orderId,
    providerId: provider._id,
    isDeleted: false,
  }).select("_id");
  if (!order) {
    throw new AppError("Không tìm thấy đơn dịch vụ", 404);
  }

  return Feedback.findOne({
    orderId,
    isDeleted: false,
  })
    .populate("customerId", "fullName avatar")
    .populate("orderId", "orderCode status")
    .populate({ path: "serviceId", select: "name image coverImage", transform: serviceImageResponse })
    .populate("providerReply.repliedBy", "fullName avatar");
};

export const getOrderFeedbackContext = async (userId: string, orderId: string) => {
  assertObjectId(userId, "người dùng");
  assertObjectId(orderId, "đơn hàng");

  const order = await Order.findOne({
    _id: orderId,
    customerId: userId,
    isDeleted: false,
  })
    .select("orderCode status providerId serviceId createdAt")
    .populate({ path: "serviceId", select: "name image coverImage", transform: serviceImageResponse })
    .populate({
      path: "providerId",
      select: "userId",
      populate: { path: "userId", select: "fullName avatar" },
    });

  if (!order) {
    throw new AppError("Không tìm thấy đơn dịch vụ", 404);
  }

  const feedback = await Feedback.findOne({
    orderId,
    customerId: userId,
    isDeleted: false,
  })
    .populate("orderId", "orderCode status")
    .populate({
      path: "providerId",
      select: "userId averageRating totalFeedbacks",
      populate: { path: "userId", select: "fullName avatar" },
    })
    .populate({ path: "serviceId", select: "name image coverImage", transform: serviceImageResponse })
    .populate("providerReply.repliedBy", "fullName avatar");

  const canReview = order.status === "completed" && Boolean(order.providerId);
  const reason = order.status !== "completed"
    ? "Chỉ đơn hàng đã hoàn tất mới có thể được đánh giá."
    : !order.providerId
      ? "Đơn hàng chưa có thợ nhận."
      : null;

  return { order, feedback, canReview, reason };
};

const parseBoolean = (value: string | boolean | undefined) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

const buildFeedbackFilter = (
  query: PaginationQuery,
  base: Record<string, unknown>,
) => {
  const filter: Record<string, unknown> = { ...base, isDeleted: false };
  const rating = Number(query.rating);
  if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
    filter.rating = rating;
  }

  const hasImages = parseBoolean(query.hasImages);
  if (hasImages === true) filter["images.0"] = { $exists: true };
  if (hasImages === false) filter["images.0"] = { $exists: false };

  const replied = parseBoolean(query.replied);
  if (replied === true) filter.providerReply = { $ne: null };
  if (replied === false) filter.providerReply = null;

  if (query.keyword?.trim()) {
    const keyword = query.keyword
      .trim()
      .replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
    filter.comment = { $regex: keyword, $options: "i" };
  }

  return filter;
};

const getRatingSummary = async (filter: Record<string, unknown>) => {
  const rows = await Feedback.aggregate<{ _id: number; count: number }>([
    { $match: filter },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  rows.forEach((row) => {
    distribution[row._id as keyof typeof distribution] = row.count;
  });
  return distribution;
};

export const getServiceFeedbacks = async (
  serviceId: string,
  query: PaginationQuery & {
    optionId?: string;
    sort?: "newest" | "rating";
    positiveOnly?: string | boolean;
  } = {},
) => {
  if (!Types.ObjectId.isValid(serviceId)) {
    throw new AppError("Mã dịch vụ không hợp lệ", 400);
  }
  if (!await Service.exists({ _id: serviceId, isDeleted: false })) {
    throw new AppError("Không tìm thấy dịch vụ", 404);
  }
  const { page, limit, skip } = getPagination(query);
  const filter = buildFeedbackFilter(query, { serviceId, isVisible: true });
  if (parseBoolean(query.positiveOnly) === true) {
    if (filter.rating === undefined) filter.rating = { $gte: 4 };
    else if (Number(filter.rating) < 4) filter.rating = { $in: [] };
  }
  if (query.optionId) {
    if (!Types.ObjectId.isValid(query.optionId)) {
      throw new AppError("Mã gói dịch vụ không hợp lệ", 400);
    }
    filter.orderId = { $in: await Order.distinct("_id", {
      serviceId,
      isDeleted: false,
      $or: [
        { selectedOptionIds: query.optionId },
        { "selectedOptionsSnapshot.optionId": query.optionId },
      ],
    }) };
  }
  const [items, total] = await Promise.all([
    Feedback.find(filter)
      .select("rating comment images createdAt customerId orderId")
      .sort(query.sort === "rating" ? { rating: -1, createdAt: -1, _id: -1 } : { createdAt: -1, _id: -1 })
      .skip(skip).limit(limit)
      .populate("customerId", "fullName avatar")
      .populate("orderId", "selectedOptionsSnapshot")
      .lean(),
    Feedback.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => {
      // Chỉ đưa thông tin hiển thị ra API công khai, không trả chi tiết đơn.
      const customer = item.customerId as unknown as { fullName?: string; avatar?: string } | null;
      const order = item.orderId as unknown as {
        selectedOptionsSnapshot?: { optionId?: Types.ObjectId; name: string }[];
      } | null;
      return {
        _id: item._id,
        rating: item.rating,
        comment: item.comment,
        images: item.images,
        createdAt: item.createdAt,
        customer: { fullName: customer?.fullName ?? "Khách hàng", avatar: customer?.avatar ?? null },
        options: (order?.selectedOptionsSnapshot ?? []).map((option) => ({
          id: option.optionId?.toString() ?? null, name: option.name,
        })),
      };
    }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getProviderFeedbacks = async (
  providerId: string,
  query: PaginationQuery = {},
) => {
  assertObjectId(providerId, "nhà cung cấp");

  const provider = await Provider.findOne({
    _id: providerId,
    isDeleted: false,
  });

  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ thợ", 404);
  }

  const { page, limit, skip } = getPagination(query);
  const providerOrderIds = await Order.find({
    providerId: provider._id,
    isDeleted: false,
  }).distinct("_id");
  const summaryFilter = {
    orderId: { $in: providerOrderIds },
    isVisible: true,
    isDeleted: false,
  };
  const filter = buildFeedbackFilter(query, summaryFilter);

  const [items, total, ratingDistribution] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "fullName avatar")
      .populate("orderId", "orderCode status scheduledAt createdAt")
      .populate({ path: "serviceId", select: "name image coverImage", transform: serviceImageResponse })
      .populate("providerReply.repliedBy", "fullName avatar"),
    Feedback.countDocuments(filter),
    getRatingSummary(summaryFilter),
  ]);

  const orderIds = items.map((item) => item.orderId?._id).filter(Boolean);
  const startStatuses = await OrderStatus.find({
    orderId: { $in: orderIds },
    status: "in_progress",
    isDeleted: false,
  })
    .sort({ createdAt: 1 })
    .select("orderId createdAt")
    .lean();
  const startedAtByOrder = new Map(
    startStatuses.map((status) => [status.orderId.toString(), status.createdAt]),
  );
  const feedbackItems = items.map((item) => {
    const value = item.toObject() as any;
    const order = value.orderId;
    if (order?._id) {
      order.performedAt =
        startedAtByOrder.get(order._id.toString()) ||
        order.scheduledAt ||
        order.createdAt;
    }
    return value;
  });

  return {
    items: feedbackItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      averageRating: provider.averageRating,
      totalFeedbacks: provider.totalFeedbacks,
      ratingDistribution,
    },
  };
};

export const getMyProviderFeedbacks = async (
  userId: string,
  query: PaginationQuery = {},
) => {
  assertObjectId(userId, "người dùng");

  const provider = await Provider.findOne({
    userId,
    isDeleted: false,
  });

  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ thợ", 404);
  }

  return getProviderFeedbacks(provider.id, query);
};

export const setFeedbackVisibility = async (
  feedbackId: string,
  isVisible: boolean,
) => {
  assertObjectId(feedbackId, "đánh giá");

  const feedback = await Feedback.findOneAndUpdate(
    {
      _id: feedbackId,
      isDeleted: false,
    },
    { isVisible },
    { new: true },
  );

  if (!feedback) {
    throw new AppError("Không tìm thấy đánh giá", 404);
  }

  await recalculateProviderRating(feedback.providerId);

  return feedback;
};

export const upsertProviderReply = async (
  userId: string,
  feedbackId: string,
  content: string,
  images?: string[],
) => {
  assertObjectId(userId, "người dùng");
  assertObjectId(feedbackId, "đánh giá");

  const provider = await Provider.findOne({ userId, isDeleted: false });
  if (!provider) {
    throw new AppError("Không tìm thấy hồ sơ thợ", 404);
  }

  const feedback = await Feedback.findOne({
    _id: feedbackId,
    isDeleted: false,
  });
  if (!feedback) {
    throw new AppError("Không tìm thấy đánh giá", 404);
  }

  const order = await Order.findOne({
    _id: feedback.orderId,
    providerId: provider._id,
    isDeleted: false,
  }).select("_id");
  if (!order) {
    throw new AppError("Bạn không có quyền phản hồi đánh giá này", 403);
  }

  const now = new Date();
  feedback.providerReply = {
    content,
    images: images ?? feedback.providerReply?.images ?? [],
    repliedBy: new Types.ObjectId(userId),
    repliedAt: feedback.providerReply?.repliedAt || now,
    updatedAt: now,
  };
  await feedback.save();

  return feedback.populate("providerReply.repliedBy", "fullName avatar");
};

export const getAdminFeedbacks = async (query: PaginationQuery = {}) => {
  const { page, limit, skip } = getPagination(query);
  const base: Record<string, unknown> = {};
  const isVisible = parseBoolean(query.isVisible);
  if (isVisible !== undefined) base.isVisible = isVisible;
  const filter = buildFeedbackFilter(query, base);

  const [items, total] = await Promise.all([
    Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "fullName email avatar")
      .populate({
        path: "providerId",
        select: "userId",
        populate: { path: "userId", select: "fullName email avatar" },
      })
      .populate("orderId", "orderCode status")
      .populate({ path: "serviceId", select: "name image coverImage", transform: serviceImageResponse })
      .populate("providerReply.repliedBy", "fullName avatar"),
    Feedback.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
