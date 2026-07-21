import mongoose from "mongoose";
import { createLogger } from "../utils/logger";

const dbLogger = createLogger("Database");

const dropLegacyIndex = async (
  collectionName: string,
  indexName: string,
): Promise<void> => {
  const collection = mongoose.connection.collection(collectionName);

  if (!(await collection.indexExists(indexName))) {
    return;
  }

  await collection.dropIndex(indexName);
  dbLogger.info("Đã xóa index cũ.", { collectionName, indexName });
};

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("Chưa cấu hình MONGO_URI hoặc MONGODB_URI.");
    }

    await mongoose.connect(mongoUri);
    dbLogger.info("Đã kết nối MongoDB.");

    await dropLegacyIndex("sessions", "refreshToken_1");
    await dropLegacyIndex("feedbacks", "requestId_1");
  } catch (error) {
    dbLogger.error("Kết nối MongoDB thất bại.", error);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    dbLogger.warn("MongoDB đã ngắt kết nối.");
  });
};
