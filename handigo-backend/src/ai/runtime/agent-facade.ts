import { randomUUID } from "node:crypto";
import type { RequestUser } from "../../middlewares/authContext";
import { AppError } from "../../utils/appError";
import { selectNewSessionEngine } from "./customer-rollout.config";
import { newSession, type AgentInput, type AgentSession, type PendingAction } from "../agent/agent-state";
import { sessionView } from "../agent/agent.service";
import type { SessionService, SessionEngine } from "../session/session.service";

export interface GraphSessionHost {
  exclusive<T>(user: RequestUser, id: string, run: () => Promise<T>): Promise<T>;
  send(user: RequestUser, id: string, input: { requestId: string; message: string }): Promise<AgentSession>;
  get(id: string, userId: string): Promise<AgentSession>;
}
export interface CustomerGraphHost extends Omit<GraphSessionHost, "send"> {
  hasActionRecord(session: AgentSession, action: PendingAction): Promise<boolean>;
  send(user: RequestUser, id: string, input: AgentInput): Promise<AgentSession>;
  requireAttachmentSupport(user: RequestUser, id: string): Promise<void>;
  registerAttachment(user: RequestUser, id: string, url: string): Promise<{ url: string }>;
}
type Directory = Pick<SessionService, "resolveEngine" | "get" | "listDirectory" | "latest" | "progress" | "delete" | "reset"
  | "acquireEngine" | "release" | "saveGraphProjection" | "archiveGraph" | "registerAttachment">;

export { selectNewSessionEngine } from "./customer-rollout.config";

export class AgentFacade {
  constructor(private readonly sessions: Directory, private readonly graph: () => Promise<GraphSessionHost>,
    private readonly legacySend: (user: RequestUser, id: string, input: AgentInput) => Promise<ReturnType<typeof sessionView>>,
    private readonly selectEngine = selectNewSessionEngine,
    private readonly customerGraph?: () => Promise<CustomerGraphHost>) {}

  private async host(engine: SessionEngine): Promise<GraphSessionHost | CustomerGraphHost> {
    if (engine === "langgraph-customer") return this.businessHost();
    return this.graph();
  }

  private businessHost() {
    if (!this.customerGraph) throw new AppError("Engine nghiệp vụ chưa sẵn sàng; chưa chuyển sang engine khác.", 503);
    return this.customerGraph();
  }

  private customer(user: RequestUser) {
    if (user.role !== "CUSTOMER") throw new AppError("Trợ lý hệ thống chỉ dành cho khách hàng.", 403);
  }

  async send(user: RequestUser, id: string, input: AgentInput) {
    this.customer(user);
    // _id duy nhất ở directory ghim engine một lần cho cả hai runtime.
    const engine = await this.sessions.resolveEngine(id, user.id, () => this.selectEngine(user));
    if (engine === "legacy") return this.legacySend(user, id, input);
    if (engine === "langgraph-readonly" && (!("message" in input) || input.bookingAction || input.customerAttachments?.length)) {
      throw new AppError("Phiên thử nghiệm này chỉ hỗ trợ tra cứu bằng tin nhắn. Vui lòng dùng chức năng tương ứng trên ứng dụng để thực hiện thao tác.", 409);
    }
    const { lockId } = await this.sessions.acquireEngine(id, user.id, engine);
    try {
      const projection = engine === "langgraph-customer"
        ? await (await this.businessHost()).send(user, id, input)
        : await (await this.graph()).send(user, id, { requestId: input.requestId, message: (input as Extract<AgentInput, { message: string }>).message });
      await this.sessions.saveGraphProjection(projection, lockId, engine);
      return sessionView(projection);
    } finally { await this.sessions.release(id, lockId); }
  }

  async get(user: RequestUser, id: string) {
    this.customer(user);
    const engine = await this.sessions.resolveEngine(id, user.id);
    return engine === "legacy" ? this.sessions.get(id, user.id) : (await this.host(engine)).get(id, user.id);
  }

  async list(user: RequestUser, page: number, limit: number) {
    this.customer(user);
    const result = await this.sessions.listDirectory(user.id, page, limit);
    // Đọc checkpoint chuẩn cho phiên graph, kể cả khi cache projection chưa lưu sau sự cố.
    // Giới hạn năm phiên đồng thời để tránh dồn truy vấn trên Atlas Free.
    for (let offset = 0; offset < result.items.length; offset += 5) {
      await Promise.all(result.items.slice(offset, offset + 5).map(async (item) => {
        if (item.engine === "legacy") return;
        const session = await (await this.host(item.engine)).get(item.sessionId, user.id);
        item.title = (session.conversation.find((message) => message.role === "user")?.content || session.currentGoal || "Cuộc trò chuyện mới").slice(0, 120);
        item.state = session.state;
        item.needsAttention = Boolean(session.activeRequest || session.pendingAction || session.requiresReconciliation);
      }));
    }
    return { ...result, items: result.items.map(({ engine: _engine, ...item }) => item) };
  }

  async latest(user: RequestUser) {
    this.customer(user);
    const session = await this.sessions.latest(user.id);
    if (!session) return null;
    const engine = await this.sessions.resolveEngine(session.id, user.id);
    return engine === "legacy" ? session : (await this.host(engine)).get(session.id, user.id);
  }

  async progress(user: RequestUser, id: string) {
    this.customer(user);
    const engine = await this.sessions.resolveEngine(id, user.id);
    if (engine === "legacy") return this.sessions.progress(id, user.id);
    const session = await (await this.host(engine)).get(id, user.id);
    return { sessionId: id, requestId: session.activeRequest?.requestId ?? null, state: session.state, activity: session.activity ?? null };
  }

  async delete(user: RequestUser, id: string) {
    this.customer(user);
    const engine = await this.sessions.resolveEngine(id, user.id);
    if (engine === "legacy") return this.sessions.delete(id, user.id);
    await this.manageGraph(user, id, engine, async (lockId) => {
      // Giữ checkpoint và tombstone; cùng ID không được tái tạo hoặc chuyển sang engine cũ.
      await this.sessions.archiveGraph(id, user.id, lockId, engine);
    });
  }

  private async manageGraph<T>(user: RequestUser, id: string, engine: SessionEngine, action: (lockId: string) => Promise<T>) {
    const { lockId } = await this.sessions.acquireEngine(id, user.id, engine);
    try {
      const graph = await this.host(engine);
      return await graph.exclusive(user, id, async () => {
        const session = await graph.get(id, user.id);
        const modelPaused = session.state === "FAILED" && session.modelWorkflow?.waitingForModelRetry
          && session.activeRequest && "message" in session.activeRequest.input
          && session.modelWorkflow.requestId === session.activeRequest.requestId
          && session.modelWorkflow.digest === session.activeRequest.digest;
        if (session.requiresReconciliation || [session.pendingAction, ...session.actions]
          .some((item) => item && ["UNKNOWN", "EXECUTING"].includes(item.status))) {
          throw new AppError("Kết quả thao tác trước chưa được xác định. Vui lòng mở cuộc trò chuyện và kiểm tra kết quả trước khi xóa.", 409);
        }
        if (session.pendingAction && engine === "langgraph-customer"
          && await (graph as CustomerGraphHost).hasActionRecord(session, session.pendingAction)) {
          throw new AppError("Thao tác xác nhận đã được tiếp nhận. Vui lòng kiểm tra kết quả trước khi xóa cuộc trò chuyện.", 409);
        }
        if (session.activeRequest && !modelPaused) {
          throw new AppError("Lượt trước chưa hoàn tất. Vui lòng mở cuộc trò chuyện và tiếp tục yêu cầu trước khi xóa.", 409);
        }
        return action(lockId);
      });
    } finally { await this.sessions.release(id, lockId); }
  }

  async reset(user: RequestUser, id: string) {
    this.customer(user);
    const engine = await this.sessions.resolveEngine(id, user.id);
    if (engine === "legacy") return this.sessions.reset(id, user.id, this.selectEngine(user));
    // Tạo phiên độc lập, giữ nguyên khóa, xác nhận và tiến độ giao dịch của phiên cũ.
    const next = newSession(randomUUID(), user.id);
    await this.sessions.resolveEngine(next.id, user.id, this.selectEngine(user));
    return next;
  }

  async requireAttachmentSupport(user: RequestUser, id: string) {
    this.customer(user);
    const engine = await this.sessions.resolveEngine(id, user.id, () => this.selectEngine(user));
    if (engine === "langgraph-customer") return (await this.businessHost()).requireAttachmentSupport(user, id);
    if (engine !== "legacy") {
      throw new AppError("Phiên thử nghiệm tra cứu chưa hỗ trợ tải ảnh. Vui lòng dùng chức năng tương ứng trên ứng dụng.", 409);
    }
  }

  async registerAttachment(user: RequestUser, id: string, url: string) {
    await this.requireAttachmentSupport(user, id);
    if (await this.sessions.resolveEngine(id, user.id) === "langgraph-customer") return (await this.businessHost()).registerAttachment(user, id, url);
    return this.sessions.registerAttachment(id, user.id, url);
  }
}
