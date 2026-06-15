import { Types } from "mongoose";
import { AppError } from "../utils/appError";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { Order } from "../models/order.model";
import { Provider } from "../models/provider.model";

type UserRole = "CUSTOMER" | "PROVIDER" | "ADMIN";
type SenderRole = "customer" | "provider";

interface Query {
  page?: string | number;
  limit?: string | number;
}

interface SendMessagePayload {
  messageType?: "text" | "image";
  content?: string;
  imageUrl?: string;
}

const chatEnabledStatuses = ["accepted", "in_progress", "completed"];

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

const getPagination = (query: Query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

  return { page, limit, skip: (page - 1) * limit };
};

const getProviderByUserId = async (userId: string) => {
  return Provider.findOne({ userId, isDeleted: false });
};

const resolveParticipant = async (userId: string, role: UserRole, conversation: any) => {
  if (role === "CUSTOMER" && conversation.customerId.toString() === userId) {
    return { senderRole: "customer" as SenderRole };
  }

  if (role === "PROVIDER") {
    const provider = await getProviderByUserId(userId);
    if (provider && conversation.providerId.toString() === provider._id.toString()) {
      return { senderRole: "provider" as SenderRole, provider };
    }
  }

  throw new AppError("You are not a participant of this conversation", 403);
};

const assertOrderCanChat = async (userId: string, role: UserRole, orderId: string) => {
  assertObjectId(orderId, "order id");

  const order = await Order.findOne({ _id: orderId, isDeleted: false });

  if (!order) {
    throw new AppError("Order not found", 404);
  }

  if (!order.providerId) {
    throw new AppError("Order does not have a provider yet", 400);
  }

  if (!chatEnabledStatuses.includes(order.status)) {
    throw new AppError("Order is not ready for chat", 400);
  }

  if (role === "CUSTOMER" && order.customerId.toString() === userId) {
    return order;
  }

  if (role === "PROVIDER") {
    const provider = await getProviderByUserId(userId);
    if (provider && order.providerId.toString() === provider._id.toString()) {
      return order;
    }
  }

  throw new AppError("You are not allowed to chat for this order", 403);
};

const getConversationForParticipant = async (
  userId: string,
  role: UserRole,
  conversationId: string,
) => {
  assertObjectId(conversationId, "conversation id");

  const conversation = await Conversation.findOne({
    _id: conversationId,
    isDeleted: false,
  });

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const participant = await resolveParticipant(userId, role, conversation);

  return { conversation, participant };
};

export const getMyConversations = async (userId: string, role: UserRole, query: Query = {}) => {
  assertObjectId(userId, "user id");
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isDeleted: false };

  if (role === "CUSTOMER") {
    filter.customerId = userId;
  } else if (role === "PROVIDER") {
    const provider = await getProviderByUserId(userId);
    if (!provider) {
      throw new AppError("Provider profile not found", 404);
    }
    filter.providerId = provider._id;
  } else {
    throw new AppError("Only customers and providers can access chat", 403);
  }

  const [items, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ "lastMessage.sentAt": -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("orderId", "orderCode status")
      .populate("customerId", "fullName avatar")
      .populate({
        path: "providerId",
        select: "userId averageRating",
        populate: { path: "userId", select: "fullName avatar" },
      }),
    Conversation.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getOrCreateConversationByOrder = async (
  userId: string,
  role: UserRole,
  orderId: string,
) => {
  const order = await assertOrderCanChat(userId, role, orderId);

  const conversation = await Conversation.findOneAndUpdate(
    { orderId: order._id },
    {
      $setOnInsert: {
        orderId: order._id,
        customerId: order.customerId,
        providerId: order.providerId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .populate("orderId", "orderCode status")
    .populate("customerId", "fullName avatar")
    .populate({
      path: "providerId",
      select: "userId averageRating",
      populate: { path: "userId", select: "fullName avatar" },
    });

  return conversation;
};

export const getMessages = async (
  userId: string,
  role: UserRole,
  conversationId: string,
  query: Query = {},
) => {
  await getConversationForParticipant(userId, role, conversationId);
  const { page, limit, skip } = getPagination(query);

  const [items, total] = await Promise.all([
    Message.find({ conversationId, isDeleted: false })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "fullName avatar role"),
    Message.countDocuments({ conversationId, isDeleted: false }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const sendMessage = async (
  userId: string,
  role: UserRole,
  conversationId: string,
  payload: SendMessagePayload,
) => {
  const { conversation, participant } = await getConversationForParticipant(
    userId,
    role,
    conversationId,
  );

  await assertOrderCanChat(userId, role, conversation.orderId.toString());

  const messageType = payload.messageType || "text";
  const content = messageType === "text" ? payload.content : payload.imageUrl;

  if (!content) {
    throw new AppError("Message content is required", 400);
  }

  const message = await Message.create({
    conversationId: conversation._id,
    senderId: userId,
    senderRole: participant.senderRole,
    messageType,
    content: payload.content ?? null,
    imageUrl: payload.imageUrl ?? null,
  });

  conversation.lastMessage = {
    messageId: message._id as Types.ObjectId,
    senderId: new Types.ObjectId(userId),
    messageType,
    content,
    sentAt: message.createdAt,
  };
  await conversation.save();

  return Message.findById(message._id).populate("senderId", "fullName avatar role");
};

export const markConversationSeen = async (
  userId: string,
  role: UserRole,
  conversationId: string,
) => {
  const { conversation, participant } = await getConversationForParticipant(
    userId,
    role,
    conversationId,
  );

  const seenAt = new Date();

  if (participant.senderRole === "customer") {
    conversation.customerLastSeenAt = seenAt;
  } else {
    conversation.providerLastSeenAt = seenAt;
  }

  await Promise.all([
    conversation.save(),
    Message.updateMany(
      {
        conversationId: conversation._id,
        senderId: { $ne: userId },
        status: "sent",
        isDeleted: false,
      },
      { status: "seen", seenAt },
    ),
  ]);

  return { conversationId: conversation._id, seenAt };
};
