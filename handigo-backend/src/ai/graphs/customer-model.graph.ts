import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { MODEL_WORKFLOW_PHASES, type AgentModelWorkflow, type ModelWorkflowPhase } from "../agent/model-workflow";
import { measureCustomerStage } from "../runtime/customer-runtime-metrics";

const ModelState = Annotation.Root({ phase: Annotation<ModelWorkflowPhase> });

// Mỗi node chốt con trỏ cùng session vào checkpoint chuẩn do host sở hữu/fencing.
// Không tạo kho checkpoint thứ hai hoặc phát lại callback ghi khi khôi phục graph con.
export async function runCustomerModelGraph(workflow: AgentModelWorkflow) {
  if (workflow.frame.waitingForModelRetry) {
    delete workflow.frame.waitingForModelRetry;
    workflow.frame.modelRetryCount = (workflow.frame.modelRetryCount ?? 0) + 1;
    workflow.frame.phase = "refresh_sources";
    delete workflow.frame.refreshCursor;
  }
  const node = (phase: ModelWorkflowPhase) => async () => {
    // done không phải node chạy; loại khỏi kiểu phase ở nơi tạo callback.
    if (phase !== "done") await measureCustomerStage(phase, () => workflow.step(phase));
    await workflow.checkpoint();
    return { phase: workflow.frame.waitingForModelRetry ? "done" as const : workflow.frame.phase };
  };
  const graph = new StateGraph(ModelState)
    .addNode("route_request", node("route_request"))
    .addNode("history_request", node("history_request"))
    .addNode("voucher_request", node("voucher_request"))
    .addNode("recover_draft", node("recover_draft"))
    .addNode("recover_address", node("recover_address"))
    .addNode("compact_context", node("compact_context"))
    .addNode("call_model", node("call_model"))
    .addNode("route_tool", node("route_tool"))
    .addNode("validate_tool", node("validate_tool"))
    .addNode("prepare_confirmation", node("prepare_confirmation"))
    .addNode("execute_read", node("execute_read"))
    .addNode("after_tool", node("after_tool"))
    .addNode("prepare_draft", node("prepare_draft"))
    .addNode("apply_address", node("apply_address"))
    .addNode("refresh_sources", node("refresh_sources"))
    .addNode("respond", node("respond"));
  const destinations: Array<Exclude<ModelWorkflowPhase, "done"> | typeof END> = [...MODEL_WORKFLOW_PHASES, END];
  const next = ({ phase }: { phase: ModelWorkflowPhase }) => phase === "done" ? END : phase;
  // Khôi phục luôn bắt đầu từ phase backend đã lưu, không nhận resume/node do client chọn.
  graph.addConditionalEdges(START, next, destinations);
  for (const phase of MODEL_WORKFLOW_PHASES) graph.addConditionalEdges(phase, next, destinations);
  await graph.compile({ checkpointer: false }).invoke({ phase: workflow.frame.phase },
    { recursionLimit: workflow.host.config.maxIterations * 8 + 24 });
  return workflow.frame.message ?? "";
}
