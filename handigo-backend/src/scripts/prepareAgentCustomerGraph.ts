import { createCustomerGraphConnection } from "../ai/runtime/customer-graph-connection";

export async function prepareAgentCustomerGraph(uri: string) {
  const connection = createCustomerGraphConnection(uri);
  try {
    await connection.setup();
    await connection.open();
    return { engine: "langgraph-customer", ready: true, businessWrites: 0, deletedDocuments: 0 };
  } finally { await connection.close(); }
}

if (require.main === module) {
  void (async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("Cần cấp MONGO_URI cho tiến trình; chương trình không tự đọc .env.");
    console.log(JSON.stringify(await prepareAgentCustomerGraph(uri)));
  })().catch((error: unknown) => {
    console.error("Chuẩn bị engine nghiệp vụ chưa thành công.", { type: error instanceof Error ? error.name : "unknown" });
    process.exitCode = 1;
  });
}
