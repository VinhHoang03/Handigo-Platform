import type { AgentSession, PendingAction } from "../agent/agent-state";
import type { ToolContext } from "../tools/tool.interface";
import type { ToolRegistry } from "../tools/tool-registry";
import { buildBookingActionGraph, BOOKING_WRITE_TOOLS } from "../graphs/booking.graph";
import { buildPaymentActionGraph, PAYMENT_WRITE_TOOLS } from "../graphs/payment.graph";
import { buildCustomerCareActionGraph, CUSTOMER_CARE_WRITE_TOOLS } from "../graphs/customer-care.graph";
import type { ConfirmedActionData } from "../graphs/confirmed-action.graph";
import { actionIdentity, type ActionDomain, type ActionLedger } from "./action-ledger";
import { AppError } from "../../utils/appError";

export interface ActionGraphRunner {
  run(session: AgentSession, context: ToolContext, action: PendingAction): Promise<ConfirmedActionData>;
  hasRecord(session: AgentSession, action: PendingAction): Promise<boolean>;
  recordReconciliation(session: AgentSession, action: PendingAction): Promise<void>;
}

export class ActionGraphDispatcher implements ActionGraphRunner {
  constructor(private readonly registry: ToolRegistry, private readonly ledger: ActionLedger,
    private readonly assertWriteAccess: () => Promise<void>, private readonly timeoutMs = 20000) {}

  private domain(tool: string): ActionDomain {
    if ((BOOKING_WRITE_TOOLS as readonly string[]).includes(tool)) return "booking";
    if ((PAYMENT_WRITE_TOOLS as readonly string[]).includes(tool)) return "payment";
    if ((CUSTOMER_CARE_WRITE_TOOLS as readonly string[]).includes(tool)) return "customer-care";
    throw new AppError("Công cụ chưa được chuyển sang graph nghiệp vụ. Chưa thực hiện thao tác.", 409);
  }

  async hasRecord(session: AgentSession, action: PendingAction) {
    return Boolean(await this.ledger.find(actionIdentity(session.userId, session.id, this.domain(action.tool), action)));
  }

  async run(session: AgentSession, context: ToolContext, action: PendingAction) {
    const domain = this.domain(action.tool);
    const deps = { registry: this.registry, ledger: this.ledger, context, assertWriteAccess: this.assertWriteAccess, timeoutMs: this.timeoutMs };
    const graph = domain === "booking" ? buildBookingActionGraph(deps)
      : domain === "payment" ? buildPaymentActionGraph(deps) : buildCustomerCareActionGraph(deps);
    return (await graph.invoke({ data: { session, action } }, { signal: context.signal })).data;
  }

  async recordReconciliation(session: AgentSession, action: PendingAction) {
    if (!["SUCCEEDED", "EXPIRED"].includes(action.status)) throw new AppError("Kết quả đối soát chưa kết thúc.", 409);
    const identity = actionIdentity(session.userId, session.id, this.domain(action.tool), action);
    if (await this.ledger.find(identity)) await this.ledger.settle(identity,
      action.status === "EXPIRED" ? "EXPIRED" : "SUCCEEDED", action.result);
  }
}
