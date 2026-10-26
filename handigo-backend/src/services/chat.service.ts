import mongoose, { ClientSession, Types } from "mongoose";
import { withTransactionRetry } from "../utils/transaction";
import { AppError } from "../utils/appError";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { Order, type IOrder } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { Report } from "../models/report.model";
import { assertFeatureAllowed } from "./penaltyPolicy.service";

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

const chatEnabledStatuses: IOrder["status"][] = ["accepted", "in_progress", "completed"];

const withConversationWrite = async <T>(
  conversationId: string,
  work: (conversation: InstanceType<typeof Conversation>, session: ClientSession) => Promise<T>,
) => {
  const session = await mongoose.startSession();
  try {
    return await withTransactionRetry(session, async () => {
      const conversation = await Conversation.findOneAndUpdate(
        { _id: conversationId, isDeleted: false }, { $inc: { __v: 1 } },
        { new: true, session, runValidators: true },
      );
      if (!conversation) throw new AppError("Không tìm thấy cuộc trò chuyện", 404);
      return work(conversation, session);
    });
  } finally { await session.endSession(); }
};

const refreshConversationPreview = async (conversation: InstanceType<typeof Conversation>, session: ClientSession) => {
  const latest = await Message.findOne({ conversationId: conversation._id, isDeleted: false })
    .sort({ createdAt: -1, _id: -1 }).session(session);
  conversation.lastMessage = latest ? {
    messageId: latest._id as Types.ObjectId, senderId: latest.senderId,
    messageType: latest.messageType as "text" | "image",
    content: latest.content || latest.imageUrl || "", sentAt: latest.createdAt,
  } : null;
  await conversation.save({ session });
};

const assertObjectId = (id: string, fieldName: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Định danh ${fieldName} không hợp lệ`, 400);
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

  throw new AppError("Bạn không thuộc cuộc trò chuyện này", 403);
};

const assertOrderCanChat = async (userId: string, role: UserRole, orderId: string, requireChatEnabled = true) => {
  assertObjectId(orderId, "order id");

  const order = await Order.findOne({ _id: orderId, isDeleted: false });

  if (!order) {
    throw new AppError("Không tìm thấy đơn hàng", 404);
  }

  if (!requireChatEnabled && role === "CUSTOMER" && order.customerId.toString() === userId) return order;

  if (!order.providerId) {
    throw new AppError("Đơn hàng chưa có nhà cung cấp", 400);
  }

  if (requireChatEnabled && !chatEnabledStatuses.includes(order.status)) {
    throw new AppError("Đơn hàng chưa sẵn sàng để trò chuyện", 400);
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

  throw new AppError("Bạn không có quyền trò chuyện trong đơn hàng này", 403);
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
    throw new AppError("Không tìm thấy cuộc trò chuyện", 404);
  }

  const order = await assertOrderCanChat(userId, role, conversation.orderId.toString(), false);
  if (order.providerId && conversation.providerId.toString() !== order.providerId.toString()) {
    conversation.providerId = order.providerId!;
    conversation.providerLastSeenAt = null;
    await conversation.save();
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
      throw new AppError("Không tìm thấy hồ sơ nhà cung cấp", 404);
    }
    const orderIds = await Order.find({ providerId: provider._id, isDeleted: false }).distinct("_id");
    await Conversation.updateMany({ orderId: { $in: orderIds }, providerId: { $ne: provider._id }, isDeleted: false },
      { $set: { providerId: provider._id, providerLastSeenAt: null } }, { runValidators: true });
    filter.providerId = provider._id;
    filter.orderId = { $in: orderIds };
  } else {
    throw new AppError("Chỉ khách hàng và nhà cung cấp có thể truy cập trò chuyện", 403);
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
  const previous = await Conversation.findOne({ orderId: order._id, isDeleted: false }).select("providerId");

  const conversation = await Conversation.findOneAndUpdate(
    { orderId: order._id },
    {
      $set: {
        customerId: order.customerId,
        providerId: order.providerId,
        ...(previous && previous.providerId.toString() !== order.providerId!.toString() ? { providerLastSeenAt: null } : {}),
      },
      $setOnInsert: { orderId: order._id },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
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

  const [messageDocuments, total] = await Promise.all([
    Message.find({ conversationId, isDeleted: false })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "fullName avatar role"),
    Message.countDocuments({ conversationId, isDeleted: false }),
  ]);

  return {
    items: messageDocuments.reverse(),
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
  await assertFeatureAllowed(userId, "chat");
  const { conversation, participant } = await getConversationForParticipant(
    userId,
    role,
    conversationId,
  );

  await assertOrderCanChat(userId, role, conversation.orderId.toString());

  const messageType = payload.messageType || "text";
  const content = messageType === "text" ? payload.content : payload.imageUrl;

  if (!content) {
    throw new AppError("Vui lòng nhập nội dung tin nhắn", 400);
  }

  const messageId = await withConversationWrite(conversationId, async (current, session) => {
    const [message] = await Message.create([{
      conversationId: conversation._id,
      senderId: userId,
      senderRole: participant.senderRole,
      messageType,
      content: payload.content ?? null,
      imageUrl: payload.imageUrl ?? null,
    }], { session });

    await refreshConversationPreview(current, session);
    return message._id;
  });


  return Message.findById(messageId).populate("senderId", "fullName avatar role");
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

export const updateMessage = async (
  userId: string,
  role: UserRole,
  messageId: string,
  content: string,
) => {
  await assertFeatureAllowed(userId, "chat");
  assertObjectId(messageId, "message id");
  const message = await Message.findOne({ _id: messageId, isDeleted: false });
  if (!message) throw new AppError("Không tìm thấy tin nhắn.", 404);

  const { conversation } = await getConversationForParticipant(
    userId,
    role,
    message.conversationId.toString(),
  );
  if (message.senderId.toString() !== userId) {
    throw new AppError("Bạn chỉ có thể chỉnh sửa tin nhắn của mình.", 403);
  }
  if (message.messageType !== "text") {
    throw new AppError("Chỉ có thể chỉnh sửa tin nhắn văn bản.", 400);
  }

  await withConversationWrite(conversation._id.toString(), async (current, session) => {
    const latest = await Message.findOne({ _id: messageId, senderId: userId, isDeleted: false }).session(session);
    if (!latest) throw new AppError("Không tìm thấy tin nhắn.", 404);
    latest.content = content.trim();
    await latest.save({ session });
    if (current.lastMessage?.messageId.toString() === messageId) {
      current.lastMessage.content = latest.content;
      await current.save({ session });
    }
  });
  return Message.findById(message._id).populate("senderId", "fullName avatar role");
};

export const deleteMessage = async (
  userId: string,
  role: UserRole,
  messageId: string,
) => {
  assertObjectId(messageId, "message id");
  const message = await Message.findOne({ _id: messageId, isDeleted: false });
  if (!message) throw new AppError("Không tìm thấy tin nhắn.", 404);

  const { conversation } = await getConversationForParticipant(
    userId,
    role,
    message.conversationId.toString(),
  );
  if (message.senderId.toString() !== userId) {
    throw new AppError("Bạn chỉ có thể xóa tin nhắn của mình.", 403);
  }

  await withConversationWrite(conversation._id.toString(), async (current, session) => {
    const latest = await Message.findOne({ _id: messageId, senderId: userId, isDeleted: false }).session(session);
    if (!latest) throw new AppError("Không tìm thấy tin nhắn.", 404);
    latest.isDeleted = true;
    latest.deletedAt = new Date();
    await latest.save({ session });

    if (current.lastMessage?.messageId.toString() === messageId) {
      await refreshConversationPreview(current, session);
    }
  });


  return { _id: message._id, conversationId: message.conversationId };
};

export const reportConversation = async (
  userId: string,
  role: UserRole,
  conversationId: string,
  description: string,
) => {
  const { conversation, participant } = await getConversationForParticipant(
    userId,
    role,
    conversationId,
  );

  let targetUserId = conversation.customerId;
  if (participant.senderRole === "customer") {
    const provider = await Provider.findById(conversation.providerId).select("userId");
    if (!provider) throw new AppError("Không tìm thấy nhà cung cấp.", 404);
    targetUserId = provider.userId;
  }

  return Report.create({
    reporterId: userId,
    targetType: "chat_conversation",
    targetUserId,
    orderId: conversation.orderId,
    conversationId: conversation._id,
    reportType: "spam_chat",
    title: "Báo cáo cuộc trò chuyện",
    description: description.trim(),
    evidenceImages: [],
  });
};
