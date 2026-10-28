import { Annotation, END, START, StateGraph, type BaseCheckpointSaver } from "@langchain/langgraph";
import { AppError } from "../../utils/appError";
import type { AgentSession } from "../agent/agent-state";
import { CUSTOMER_GRAPH_VERSION } from "./mongo-graph-access";

export interface CustomerWorkflowData {
  version: typeof CUSTOMER_GRAPH_VERSION;
  session: AgentSession;
}
const CustomerState = Annotation.Root({ data: Annotation<CustomerWorkflowData> });

// Giữ checkpoint chuẩn cho các bước đã có của AgentService/AgentLoop; graph con quản lý thao tác ghi.
export function buildCustomerSessionGraph(checkpointer: BaseCheckpointSaver) {
  return new StateGraph(CustomerState).addNode("session", ({ data }) => ({ data }))
    .addEdge(START, "session").addEdge("session", END).compile({ checkpointer });
}

export function projectCustomerWorkflow(data: CustomerWorkflowData, sessionId: string, userId: string) {
  if (data.version !== CUSTOMER_GRAPH_VERSION || data.session.id !== sessionId || data.session.userId !== userId) {
    throw new AppError("Checkpoint không khớp phiên hoặc phiên bản engine nghiệp vụ.", 409);
  }
  return structuredClone(data.session);
}
