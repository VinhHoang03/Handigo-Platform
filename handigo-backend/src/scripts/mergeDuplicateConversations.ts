import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import mongoose, { Types } from "mongoose";
import { Conversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { Provider } from "../models/provider.model";
import { Order } from "../models/order.model";
import { Report } from "../models/report.model";
import { withTransactionRetry } from "../utils/transaction";

const apply = process.argv.includes("--apply");
const backupDirectory = resolve("backups", `chat-dedup-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const groupsQuery = () => Conversation.aggregate<{
  _id: { customerId: Types.ObjectId; providerId: Types.ObjectId }; count: number;
}>([
  { $match: { isDeleted: false } },
  { $group: { _id: { customerId: "$customerId", providerId: "$providerId" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
]);

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Chưa cấu hình MONGO_URI hoặc MONGODB_URI.");
  await mongoose.connect(uri, { autoIndex: false });
  try {
    const groups = await groupsQuery();
    const initialMessages = await Message.countDocuments({});
    console.log("Thống kê trước xử lý.", {
      duplicatePairs: groups.length,
      redundantConversations: groups.reduce((total, group) => total + group.count - 1, 0),
      activeConversations: await Conversation.countDocuments({ isDeleted: false }),
      totalMessages: initialMessages,
      apply,
    });
    if (!apply) return;
    if (groups.length) mkdirSync(backupDirectory, { recursive: true });
    let archived = 0; let movedMessages = 0; let movedReports = 0; let skipped = 0;
    for (const group of groups) {
      const session = await mongoose.startSession();
      try {
        const result = await withTransactionRetry(session, async () => {
          // Cùng khóa với luồng tạo chat; khóa các chat để gửi/sửa tin đồng thời phải thử lại.
          const provider = await Provider.findOneAndUpdate(
            { _id: group._id.providerId, isDeleted: false }, { $inc: { __v: 1 } },
            { returnDocument: "after", session, runValidators: true },
          );
          if (!provider) return { skipped: true, archived: 0, messages: 0, reports: 0 };
          const filter = { ...group._id, isDeleted: false };
          const conversations = await Conversation.find(filter).sort({ createdAt: 1, _id: 1 }).session(session).lean();
          if (conversations.length < 2) return { skipped: false, archived: 0, messages: 0, reports: 0 };
          const ids = conversations.map((item) => item._id);
          await Conversation.updateMany({ _id: { $in: ids }, isDeleted: false }, { $inc: { __v: 1 } },
            { session, runValidators: true, timestamps: false });
          const messages = await Message.find({ conversationId: { $in: ids } }).session(session).lean();
          // Dữ liệu cũ từng đổi người tham gia phải được rà soát riêng, không gộp sang người khác.
          const invalidChatIds = new Set(messages.filter((message) =>
            (message.senderRole === "customer" && String(message.senderId) !== String(group._id.customerId))
            || (message.senderRole === "provider" && String(message.senderId) !== String(provider.userId)))
            .map((message) => String(message.conversationId)));
          const eligible = conversations.filter((item) => !invalidChatIds.has(String(item._id)));
          // Luồng chat luôn chọn chat cũ nhất; không đổi chat chính khi lịch sử của nó chưa rõ.
          if (eligible.length < 2 || invalidChatIds.has(String(conversations[0]!._id))) {
            return { skipped: true, archived: 0, messages: 0, reports: 0 };
          }
          const reports = await Report.find({ conversationId: { $in: ids } }).session(session).lean();
          const canonical = eligible[0]!;
          const redundantIds = eligible.slice(1).map((item) => item._id);
          const order = await Order.findOne({ ...group._id, isDeleted: false })
            .sort({ createdAt: -1, _id: -1 }).session(session).select("_id").lean();
          writeFileSync(resolve(backupDirectory, `${canonical._id}.json`), mongoose.mongo.BSON.EJSON.stringify({
            conversations, messages, reports, canonicalId: canonical._id,
          }, { relaxed: false }), { encoding: "utf8", mode: 0o600 });
          const moved = await Message.updateMany({ conversationId: { $in: redundantIds } },
            { $set: { conversationId: canonical._id } }, { session, runValidators: true, timestamps: false });
          const updatedReports = await Report.updateMany({ conversationId: { $in: redundantIds } },
            { $set: { conversationId: canonical._id } }, { session, runValidators: true, timestamps: false });
          const latest = await Message.findOne({ conversationId: canonical._id, isDeleted: false })
            .sort({ createdAt: -1, _id: -1 }).session(session).lean();
          const lastSeen = (field: "customerLastSeenAt" | "providerLastSeenAt") =>
            eligible.some((item) => !item[field]) ? null
              : new Date(Math.min(...eligible.map((item) => new Date(item[field]!).getTime())));
          await Conversation.updateOne({ _id: canonical._id, isDeleted: false }, { $set: {
            orderId: order?._id ?? canonical.orderId,
            customerLastSeenAt: lastSeen("customerLastSeenAt"), providerLastSeenAt: lastSeen("providerLastSeenAt"),
            lastMessage: latest ? {
              messageId: latest._id, senderId: latest.senderId,
              messageType: latest.messageType === "image" ? "image" : "text",
              content: latest.content || latest.imageUrl || "Tin nhắn hệ thống", sentAt: latest.createdAt,
            } : null,
          } }, { session, runValidators: true });
          const removed = await Conversation.updateMany({ _id: { $in: redundantIds }, isDeleted: false },
            { $set: { isDeleted: true, deletedAt: new Date(), lastMessage: null } }, { session, runValidators: true });
          if (await Message.countDocuments({ conversationId: { $in: redundantIds } }).session(session)) {
            throw new Error("Vẫn còn tin nhắn ở chat trùng; đã hủy giao dịch để bảo toàn dữ liệu.");
          }
          return { skipped: invalidChatIds.size > 0, archived: removed.modifiedCount, messages: moved.modifiedCount, reports: updatedReports.modifiedCount };
        });
        archived += result.archived; movedMessages += result.messages; movedReports += result.reports;
        if (result.skipped) skipped++;
      } finally { await session.endSession(); }
    }
    console.log("Đã hoàn tất gộp chat, không xóa tin nhắn.", {
      archivedConversations: archived, movedMessages, movedReports, skippedPairs: skipped,
      remainingDuplicatePairs: (await groupsQuery()).length,
      totalMessages: await Message.countDocuments({}),
      backupDirectory: groups.length ? backupDirectory : null,
    });
  } finally { await mongoose.disconnect(); }
};

run().catch((error: unknown) => {
  console.error("Không thể hoàn tất gộp chat.", error instanceof Error ? error.message : "Lỗi chưa xác định");
  process.exitCode = 1;
});
