import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import { Feedback } from "../models/feedback.model";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";

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
    throw new AppError(`Invalid ${fieldName}`, 400);
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

  const [stats] = await Feedback.aggregate<{
    averageRating: number;
    totalFeedbacks: number;
  }>([
    {
      $match: {
        providerId: providerObjectId,
        isVisible: true,
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$providerId",
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
  assertObjectId(userId, "user id");
  assertObjectId(payload.orderId, "order id");

  const order = await Order.findOne({
    _id: payload.orderId,
    isDeleted: false,
  });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (order.customerId.toString() !== userId) {
    throw new AppError("You can only feedback your own order", 403);
  }

  if (order.status !== "completed") {
    throw new AppError("Only completed orders can be reviewed", 400);
  }

  if (!order.providerId) {
    throw new AppError("Order does not have a provider", 400);
  }

  const existingFeedback = await Feedback.findOne({
    orderId: order._id,
    isDeleted: false,
  });

  if (existingFeedback) {
    throw new AppError("Feedback already exists for this order", 400);
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
  assertObjectId(userId, "user id");
  assertObjectId(feedbackId, "feedback id");

  const feedback = await Feedback.findOne({
    _id: feedbackId,
    customerId: userId,
    isDeleted: false,
  });

  if (!feedback) {
    throw new AppError("Feedback not found", 404);
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
  assertObjectId(userId, "user id");

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
    .populate("serviceId", "name image");
};

export const getFeedbackByOrder = async (userId: string, orderId: string) => {
  assertObjectId(userId, "user id");
  assertObjectId(orderId, "order id");

  const order = await Order.findOne({
    _id: orderId,
    customerId: userId,
    isDeleted: false,
  });

  if (!order) {
    throw new AppError("Order not found", 404);
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
    .populate("serviceId", "name image")
    .populate("providerReply.repliedBy", "fullName avatar");
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
    filter.comment = { $regex: query.keyword.trim(), $options: "i" };
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

export const getProviderFeedbacks = async (
  providerId: string,
  query: PaginationQuery = {},
) => {
  assertObjectId(providerId, "provider id");

  const provider = await Provider.findOne({
    _id: providerId,
    isDeleted: false,
  });

  if (!provider) {
    throw new AppError("Provider not found", 404);
  }

  const { page, limit, skip } = getPagination(query);
  const summaryFilter = {
    providerId: new Types.ObjectId(providerId),
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
      .populate("orderId", "orderCode status")
      .populate("serviceId", "name image")
      .populate("providerReply.repliedBy", "fullName avatar"),
    Feedback.countDocuments(filter),
    getRatingSummary(summaryFilter),
  ]);

  return {
    items,
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
  assertObjectId(userId, "user id");

  const provider = await Provider.findOne({
    userId,
    isDeleted: false,
  });

  if (!provider) {
    throw new AppError("Provider profile not found", 404);
  }

  return getProviderFeedbacks(provider.id, query);
};

export const setFeedbackVisibility = async (
  feedbackId: string,
  isVisible: boolean,
) => {
  assertObjectId(feedbackId, "feedback id");

  const feedback = await Feedback.findOneAndUpdate(
    {
      _id: feedbackId,
      isDeleted: false,
    },
    { isVisible },
    { new: true },
  );

  if (!feedback) {
    throw new AppError("Feedback not found", 404);
  }

  await recalculateProviderRating(feedback.providerId);

  return feedback;
};

export const upsertProviderReply = async (
  userId: string,
  feedbackId: string,
  content: string,
) => {
  assertObjectId(userId, "user id");
  assertObjectId(feedbackId, "feedback id");

  const provider = await Provider.findOne({ userId, isDeleted: false });
  if (!provider) {
    throw new AppError("Provider profile not found", 404);
  }

  const feedback = await Feedback.findOne({
    _id: feedbackId,
    providerId: provider._id,
    isDeleted: false,
  });
  if (!feedback) {
    throw new AppError("Feedback not found", 404);
  }

  const now = new Date();
  feedback.providerReply = {
    content,
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
      .populate("serviceId", "name image")
      .populate("providerReply.repliedBy", "fullName avatar"),
    Feedback.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
