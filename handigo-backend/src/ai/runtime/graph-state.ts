import { Annotation } from "@langchain/langgraph";
import type { AgentMessage, AgentState } from "../agent/agent-state";
import type { LLMResponse } from "../llm/llm.interface";

export const READ_ONLY_GRAPH_VERSION = "customer-readonly-v1";

export interface ReadOnlyGraphData {
  version: typeof READ_ONLY_GRAPH_VERSION;
  sessionId: string;
  userId: string;
  conversation: AgentMessage[];
  receipts: Array<{ requestId: string; digest: string }>;
  turn: {
    requestId: string;
    digest: string;
    message: string;
    status: "running" | "done";
    iterations: number;
    waitingForModelRetry?: boolean;
    modelRetryCount?: number;
    decision?: LLMResponse;
    reply?: { message: string; state: AgentState };
  };
  state: AgentState;
}

// Một kênh thay thế toàn bộ dữ liệu: node lưu cả kết quả lẫn tiến độ trong cùng checkpoint.
export const ReadOnlyGraphState = Annotation.Root({ data: Annotation<ReadOnlyGraphData> });
