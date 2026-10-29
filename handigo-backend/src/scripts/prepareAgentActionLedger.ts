import { createGraphMongoClient } from "../ai/runtime/checkpoint";
import { MongoActionLedger } from "../ai/runtime/mongo-action-ledger";

export async function prepareAgentActionLedger(uri: string) {
  const client = createGraphMongoClient(uri);
  try {
    await client.connect();
    const ledger = new MongoActionLedger(client);
    await ledger.setup();
    await ledger.assertReady();
    return { collection: "ai_agent_actions", ready: true, businessWrites: 0, deletedDocuments: 0 };
  } finally { await client.close(); }
}

if (require.main === module) {
  void (async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Cần cấp MONGO_URI cho tiến trình; chương trình không tự đọc .env.");
    console.log(JSON.stringify(await prepareAgentActionLedger(uri)));
  })().catch((error: unknown) => {
    console.error("Chuẩn bị sổ hành động chưa thành công.", { type: error instanceof Error ? error.name : "unknown" });
    process.exitCode = 1;
  });
}
