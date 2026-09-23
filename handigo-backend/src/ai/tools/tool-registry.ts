import { z } from "zod";
import { AppError } from "../../utils/appError";
import type { AgentTool, ToolContext, ToolPolicy } from "./tool.interface";

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();
  constructor(private readonly policies: Record<string, ToolPolicy> = {}) {}

  register<T>(tool: AgentTool<T>) {
    if (this.tools.has(tool.name)) throw new Error("Tool đã được đăng ký.");
    if (tool.mutates && !tool.preview) throw new Error("Tool ghi dữ liệu phải có bản xem trước.");
    this.tools.set(tool.name, tool as AgentTool);
    return this;
  }

  get(name: string, context: ToolContext) {
    const tool = this.tools.get(name);
    const policy = this.policies[name];
    if (!tool || policy?.enabled === false || !tool.roles.includes(context.user.role)
      || (policy?.roles && !policy.roles.includes(context.user.role))) {
      throw new AppError("Tool không tồn tại hoặc bạn không có quyền sử dụng.", 403);
    }
    return tool;
  }

  needsConfirmation(tool: AgentTool) {
    return tool.mutates || tool.requiresConfirmation || this.policies[tool.name]?.requiresConfirmation === true;
  }

  list(context: ToolContext) {
    return [...this.tools.values()].flatMap((tool) => {
      try {
        this.get(tool.name, context);
        return [{ name: tool.name, description: tool.description,
          requiresConfirmation: this.needsConfirmation(tool),
          inputSchema: z.toJSONSchema(tool.inputSchema, { io: "input" }) }];
      } catch { return []; }
    });
  }
}
