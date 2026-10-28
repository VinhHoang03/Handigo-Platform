import { createRequire } from "node:module";
import { MongoDBSaver, type MongoDBSaverParams } from "@langchain/langgraph-checkpoint-mongodb";
import { AppError } from "../../utils/appError";

export const GRAPH_CHECKPOINT_COLLECTIONS = Object.freeze({
  checkpoints: "ai_graph_checkpoints", writes: "ai_graph_checkpoint_writes",
});

// Lấy đúng driver mà package checkpointer đang dùng; không ép client Mongoose 7.x sang driver 6.x.
export function createGraphMongoClient(uri: string) {
  const packageRequire = createRequire(require.resolve("@langchain/langgraph-checkpoint-mongodb"));
  type Client = MongoDBSaverParams["client"];
  const { MongoClient } = packageRequire("mongodb") as {
    MongoClient: new (uri: string, options: { maxPoolSize: number; serverSelectionTimeoutMS: number }) => Client;
  };
  try { return new MongoClient(uri, { maxPoolSize: 3, serverSelectionTimeoutMS: 12000 }); }
  catch { throw new AppError("Địa chỉ kho checkpoint không hợp lệ.", 503); }
}

export function createGraphCheckpointConnection(uri: string) {
  const client = createGraphMongoClient(uri);
  const saver = new MongoDBSaver({ client,
    checkpointCollectionName: GRAPH_CHECKPOINT_COLLECTIONS.checkpoints,
    checkpointWritesCollectionName: GRAPH_CHECKPOINT_COLLECTIONS.writes,
    enableTimestamps: true,
    // Chưa có chính sách lưu giữ được duyệt: không đặt TTL hoặc tự xóa checkpoint.
  });
  return {
    saver,
    async setup() {
      try {
        await client.connect();
        const errors = await saver.setup();
        if (errors.length) throw new Error("Không tạo được index checkpoint.");
      } catch {
        await client.close().catch(() => undefined);
        throw new AppError("Chưa thể chuẩn bị kho checkpoint của trợ lý.", 503);
      }
    },
    close: () => client.close(),
  };
}
