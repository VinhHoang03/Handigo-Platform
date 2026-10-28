import assert from "node:assert/strict";
import { Annotation, StateGraph, START, END, MemorySaver, interrupt, Command } from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";

// Kiểm tra dependency trên CommonJS/Node 22; không mở kết nối Atlas hoặc ghi nghiệp vụ.
async function run() {
  const State = Annotation.Root({ requestId: Annotation<string>, approved: Annotation<boolean> });
  const saver = new MemorySaver();
  const build = () => new StateGraph(State)
    .addNode("approval", () => ({ approved: interrupt<{ message: string }, boolean>({ message: "Xác nhận thử nghiệm" }) }))
    .addEdge(START, "approval").addEdge("approval", END).compile({ checkpointer: saver });
  const config = { configurable: { thread_id: "kiem-thu-tuong-thich-g0" } };
  const graph = build();
  await graph.invoke({ requestId: "yeu-cau-g0" }, config);
  assert.equal((await graph.getState(config)).tasks[0]?.interrupts.length, 1);
  // Dựng lại graph với cùng kho checkpoint để kiểm tra tiếp tục sau gián đoạn.
  const resumed = await build().invoke(new Command({ resume: true }), config);
  assert.equal(resumed.requestId, "yeu-cau-g0");
  assert.equal(resumed.approved, true);
  assert.equal(typeof MongoDBSaver, "function");
  console.log("Đạt tương thích LangGraph: CommonJS, checkpoint bộ nhớ, interrupt/resume và tải MongoDBSaver. Chưa kiểm chứng Atlas.");
}
void run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
