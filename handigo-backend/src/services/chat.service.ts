import mongoose, { type ClientSession, Types } from "mongoose";
import { withTransactionRetry } from "../utils/transaction";
import { AppError } from "../utils/appError";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { Order, type IOrder } from "../models/order.model";
import { Provider } from "../models/provider.model";
import { Report } from "../models/report.model";
import User from "../models/user.model";
import { emitToConversation } from "../sockets/socketServer";
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

const getOrCreateParticipantConversation = async (
  order: IOrder, providerId: Types.ObjectId, session: ClientSession, updateOrder = false,
) => {
  // Khóa cùng hồ sơ thợ để hai đơn đồng thời không tạo hai chat cho cùng một cặp.
  const lock = await Provider.updateOne(
    { _id: providerId, isDeleted: false }, { $inc: { __v: 1 } }, { session, runValidators: true },
  );
  if (!lock.matchedCount) throw new AppError("Không tìm thấy hồ sơ nhà cung cấp", 404);
  const filter = { customerId: order.customerId, providerId, isDeleted: false };
  const previous = await Conversation.findOne(filter).sort({ createdAt: 1, _id: 1 }).session(session);
  if (previous) {
    if (updateOrder) {
      previous.orderId = order._id as Types.ObjectId;
      await previous.save({ session });
    }
    return previous;
  }
  const [conversation] = await Conversation.create([{ ...filter, orderId: order._id }], { session });
  return conversation!;
};

export const buildAssignmentWelcomeContent = (
  providerName: string,
  order: Pick<IOrder, "orderCode" | "createdAt" | "scheduledAt">,
) => {
  const format = (date: Date) => {
    const parts = new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh", hourCycle: "h23",
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    return `${value("hour")}:${value("minute")} ngày ${value("day")}/${value("month")}/${value("year")}`;
  };
  const name = providerName.trim() || "thợ Handigo";
  const greeting = `Chào bạn, tôi là ${name}, thợ đã nhận đơn ${order.orderCode} của bạn được đặt lúc ${format(order.createdAt)}.`;
  return `${greeting} ${order.scheduledAt
    ? `Tôi sẽ đến đúng lịch hẹn lúc ${format(order.scheduledAt)}.`
    : "Tôi sẽ sớm đến địa chỉ thực hiện và liên hệ với bạn trước khi đến."} Hẹn gặp bạn!`;
};

// Lưu cùng giao dịch nhận đơn; mã assignment là khóa duy nhất cho lời chào này.
export const createAssignmentWelcome = async (
  order: IOrder,
  providerId: Types.ObjectId,
  providerUserId: string,
  assignmentId: Types.ObjectId,
  session: ClientSession,
) => {
  const existing = await Message.findById(assignmentId).session(session);
  if (existing) return;
  const user = await User.findById(providerUserId).select("fullName").session(session);
  const conversation = await getOrCreateParticipantConversation(order, providerId, session, true);
  const content = buildAssignmentWelcomeContent(user?.fullName ?? "", order);
  const [message] = await Message.create([{
    _id: assignmentId, conversationId: conversation._id,
    senderId: providerUserId, senderRole: "provider", messageType: "text", content,
  }], { session });
  conversation.lastMessage = {
    messageId: message!._id as Types.ObjectId, senderId: new Types.ObjectId(providerUserId),
    messageType: "text", content, sentAt: message!.createdAt,
  };
  await conversation.save({ session });
};

export const publishAssignmentWelcome = async (assignmentId: Types.ObjectId) => {
  const message = await Message.findById(assignmentId).populate("senderId", "fullName avatar role");
  if (message) emitToConversation(message.conversationId.toString(), "message:new", message);
};

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

const assertOrderCanChat = async (userId: string, role: UserRole, orderId: string, requireChatEnabled = true, session?: ClientSession) => {
  assertObjectId(orderId, "order id");

  const order = await Order.findOne({ _id: orderId, isDeleted: false }).session(session ?? null);

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
    filter.providerId = provider._id;
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
  const session = await mongoose.startSession();
  let conversationId: Types.ObjectId;
  try {
    conversationId = await withTransactionRetry(session, async () => {
      const order = await assertOrderCanChat(userId, role, orderId, true, session);
      const conversation = await getOrCreateParticipantConversation(order, order.providerId!, session);
      return conversation._id as Types.ObjectId;
    });
  } finally { await session.endSession(); }
  const conversation = await Conversation.findById(conversationId)
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

  const activeOrder = await Order.exists({
    customerId: conversation.customerId, providerId: conversation.providerId,
    status: { $in: chatEnabledStatuses }, isDeleted: false,
  });
  if (!activeOrder) throw new AppError("Đơn hàng chưa sẵn sàng để trò chuyện", 400);

  const messageType = payload.messageType || "text";
  const content = messageType === "text" ? payload.content : payload.imageUrl;

  if (!content) {
    throw new AppError("Vui lòng nhập nội dung tin nhắn", 400);
  }

  const messageId = await withConversationWrite(conversationId, async (current, session) => {
    if (participant.senderRole === "customer") {
      // Ghi cùng giao dịch để tự duyệt phát hiện phản hồi đồng thời và thử lại.
      await Order.updateMany({ customerId: conversation.customerId, providerId: conversation.providerId,
        status: "accepted", "customerNoShow.status": "pending", isDeleted: false },
        { $set: { "customerNoShow.customerRepliedAt": new Date() } }, { session, runValidators: true });
    }
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
