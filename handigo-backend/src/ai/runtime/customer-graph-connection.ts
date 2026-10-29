import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { AppError } from "../../utils/appError";
import { newSession } from "../agent/agent-state";
import { GRAPH_CHECKPOINT_COLLECTIONS, createGraphMongoClient } from "./checkpoint";
import { CUSTOMER_GRAPH_PROFILE, MongoGraphThreadAccess, FencedMongoDBSaver } from "./mongo-graph-access";
import { MongoActionLedger } from "./mongo-action-ledger";
import { projectCustomerWorkflow, type CustomerWorkflowData } from "./customer-workflow-state";

export function createCustomerGraphConnection(uri: string) {
  const client = createGraphMongoClient(uri);
  const access = new MongoGraphThreadAccess(client, undefined, CUSTOMER_GRAPH_PROFILE);
  const saver = new FencedMongoDBSaver(client, access);
  const ledger = new MongoActionLedger(client);
  const reader = new MongoDBSaver({ client, checkpointCollectionName: GRAPH_CHECKPOINT_COLLECTIONS.checkpoints,
    checkpointWritesCollectionName: GRAPH_CHECKPOINT_COLLECTIONS.writes });
  return {
    access, saver, ledger,
    assertWriteAccess: (threadId: string) => access.write(threadId, async () => undefined),
    async get(id: string, userId: string) {
      const doc = await access.lookup(id, userId);
      if (!doc) return newSession(id, userId);
      const tuple = await reader.getTuple({ configurable: { thread_id: doc.threadId } });
      const data = tuple?.checkpoint.channel_values.data as CustomerWorkflowData | undefined;
      if (!data) {
        if (doc.writeVersion > 0) throw new AppError("Phiên nghiệp vụ cần khôi phục checkpoint trước khi tiếp tục.", 409);
        return newSession(id, userId);
      }
      return projectCustomerWorkflow(data, id, userId);
    },
    async open() {
      try {
        await client.connect();
        const required = [
          { collection: CUSTOMER_GRAPH_PROFILE.collection, name: "graph_thread_unique", key: { threadId: 1 }, unique: true },
          { collection: GRAPH_CHECKPOINT_COLLECTIONS.checkpoints, name: "thread_ns_checkpoint_idx",
            key: { thread_id: 1, checkpoint_ns: 1, checkpoint_id: -1 }, unique: false },
          { collection: GRAPH_CHECKPOINT_COLLECTIONS.writes, name: "thread_ns_checkpoint_task_idx",
            key: { thread_id: 1, checkpoint_ns: 1, checkpoint_id: 1, task_id: 1, idx: 1 }, unique: false },
        ];
        for (const spec of required) {
          const index = (await client.db().collection(spec.collection).listIndexes().toArray()).find((item) => item.name === spec.name);
          if (!index || JSON.stringify(index.key) !== JSON.stringify(spec.key) || Boolean(index.unique) !== spec.unique) {
            throw new Error("Kho engine nghiệp vụ chưa có index tương thích.");
          }
        }
        await ledger.assertReady();
      } catch {
        await client.close().catch(() => undefined);
        throw new AppError("Kho engine nghiệp vụ chưa sẵn sàng. Cần chuẩn bị collection và index trước khi mở pilot.", 503);
      }
    },
    async setup() {
      try {
        await client.connect();
        await access.setup();
        if ((await saver.setup()).length) throw new Error("Chưa tạo được index checkpoint.");
        await ledger.setup();
      } catch {
        await client.close().catch(() => undefined);
        throw new AppError("Chưa thể chuẩn bị kho engine nghiệp vụ.", 503);
      }
    },
    close: () => client.close(),
  };
}
