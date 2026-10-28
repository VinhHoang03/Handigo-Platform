import { buildConfirmedActionGraph, type ConfirmedActionDependencies } from "./confirmed-action.graph";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { isDeepStrictEqual } from "node:util";
import { readyBookingArguments, type BookingDraftPatch } from "../agent/booking-draft";
import type { AgentSession } from "../agent/agent-state";
import { ConfirmationService } from "../agent/confirmation.service";
import { ToolExecutor } from "../tools/tool-executor";
import { withAgentTimeout } from "../agent/timeout";
import { AppError } from "../../utils/appError";

export const BOOKING_WRITE_TOOLS = ["create_booking", "save_booking_address", "cancel_booking",
  "select_order_provider", "respond_provider_reassignment"] as const;

export const buildBookingActionGraph = (deps: ConfirmedActionDependencies) =>
  buildConfirmedActionGraph("booking", BOOKING_WRITE_TOOLS, deps);

interface BookingDraftData {
  session: AgentSession;
  patch: BookingDraftPatch;
  expectedRevision: number | null;
}
const DraftState = Annotation.Root({ data: Annotation<BookingDraftData> });

// Chuẩn bị bản nháp chỉ thay state của lần chạy; service tạo đơn chỉ thuộc graph hành động đã xác nhận.
export function buildBookingDraftGraph(deps: Pick<ConfirmedActionDependencies, "registry" | "context">) {
  return new StateGraph(DraftState)
    .addNode("validate_draft", ({ data: previous }) => {
      const data = structuredClone(previous);
      const { session } = data;
      if (deps.context.user.role !== "CUSTOMER" || deps.context.user.id !== session.userId
        || deps.context.sessionId !== session.id || deps.context.readOnly || session.requiresReconciliation) {
        throw new AppError("Không có quyền cập nhật bản nháp trong phiên này.", 403);
      }
      if ((session.bookingDraft?.revision ?? null) !== data.expectedRevision) {
        throw new AppError("Bản nháp đã thay đổi. Vui lòng tải lại trước khi cập nhật.", 409);
      }
      if (!session.activeRequest || !("message" in session.activeRequest.input)) {
        throw new AppError("Thiếu yêu cầu đang xử lý cho bản nháp.", 409);
      }
      if (session.pendingAction) {
        if (session.pendingAction.tool !== "create_booking" || session.pendingAction.status !== "WAITING_CONFIRMATION") {
          throw new AppError("Cần xử lý xác nhận đang chờ trước khi sửa bản nháp.", 409);
        }
        session.actions.push({ ...session.pendingAction, status: "EXPIRED" });
        session.pendingAction = null;
      }
      return { data };
    })
    .addNode("update_draft", async ({ data: previous }) => {
      const data = structuredClone(previous);
      const context = { ...deps.context, session: data.session };
      deps.context.signal.throwIfAborted();
      const tool = deps.registry.get("update_booking_draft", context);
      const patch = new ToolExecutor(deps.registry).authorize(data.session, context, tool, data.patch);
      await withAgentTimeout(tool.execute(context, patch), deps.context.signal, 25000);
      deps.context.signal.throwIfAborted();
      return { data };
    })
    .addNode("prepare_booking", async ({ data: previous }) => {
      const data = structuredClone(previous);
      const session = data.session;
      const draft = session.bookingDraft;
      const args = draft ? readyBookingArguments(draft) : null;
      session.state = "WAITING_USER_INPUT";
      if (!args) return { data };
      const previousAction = session.actions.find((item) => item.tool === "create_booking" && item.taskVersion === session.taskVersion
        && isDeepStrictEqual(item.arguments, args) && ["SUCCEEDED", "REJECTED", "UNKNOWN", "EXECUTING"].includes(item.status));
      if (previousAction) {
        if (["UNKNOWN", "EXECUTING"].includes(previousAction.status)) {
          session.requiresReconciliation = true;
          session.state = "FAILED";
        }
        return { data };
      }
      const context = { ...deps.context, session };
      const tool = deps.registry.get("create_booking", context);
      session.pendingAction = await new ConfirmationService().prepare(tool, context, tool.inputSchema.parse(args));
      session.pendingAction.taskVersion = session.taskVersion;
      session.state = "WAITING_CONFIRMATION";
      return { data };
    })
    .addEdge(START, "validate_draft")
    .addEdge("validate_draft", "update_draft")
    .addEdge("update_draft", "prepare_booking")
    .addEdge("prepare_booking", END)
    .compile({ checkpointer: false });
}
