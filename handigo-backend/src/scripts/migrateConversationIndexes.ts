import "dotenv/config";
import mongoose from "mongoose";
import { Conversation } from "../models/conversation.model";

// Mặc định chỉ xem trước; --apply mới thay đổi index, có thể chạy lại an toàn.
const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Chưa cấu hình MONGO_URI hoặc MONGODB_URI.");
  await mongoose.connect(uri, { autoIndex: false });
  try {
    const indexes = await Conversation.collection.indexes();
    const oldIndex = indexes.find((index) => index.unique
      && Object.keys(index.key).length === 1 && index.key.orderId === 1);
    if (!process.argv.includes("--apply")) {
      console.log("Xem trước: bỏ ràng buộc mỗi đơn chỉ có một chat và thêm index tìm chat theo khách–thợ.",
        { oldIndex: oldIndex?.name ?? null });
      return;
    }
    if (oldIndex?.name) await Conversation.collection.dropIndex(oldIndex.name);
    await Conversation.collection.createIndex({ orderId: 1 });
    await Conversation.collection.createIndex({ customerId: 1, providerId: 1, isDeleted: 1, createdAt: 1, _id: 1 });
    console.log("Đã cập nhật index trò chuyện; giữ nguyên toàn bộ cuộc trò chuyện và tin nhắn cũ.");
  } finally { await mongoose.disconnect(); }
};

run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
