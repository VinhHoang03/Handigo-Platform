import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI!;

const dropLegacyIndex = async (
  collectionName: string,
  indexName: string,
): Promise<void> => {
  const collection = mongoose.connection.collection(collectionName);

  if (!(await collection.indexExists(indexName))) {
    return;
  }

  await collection.dropIndex(indexName);
  console.log(`Dropped legacy ${collectionName}.${indexName} index`);
};

export const connectDB = async (): Promise<void> => {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env file");
    }

    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully!");

    await dropLegacyIndex("sessions", "refreshToken_1");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });
};
