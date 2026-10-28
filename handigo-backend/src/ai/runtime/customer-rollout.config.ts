import { z } from "zod";
import { AppError } from "../../utils/appError";
import type { RequestUser } from "../../middlewares/authContext";
import type { SessionEngine } from "../session/session.service";

export function selectNewSessionEngine(user: RequestUser, env: NodeJS.ProcessEnv = process.env): SessionEngine {
  if (user.role !== "CUSTOMER") return "legacy";
  const mode = z.enum(["off", "pilot", "all"]).safeParse(env.AI_AGENT_CUSTOMER_ROLLOUT?.trim()
    || (env.AI_AGENT_CUSTOMER_NEW_SESSIONS === "true" ? "pilot" : "off"));
  if (!mode.success) throw new AppError("Chế độ phát hành engine nghiệp vụ phải là off, pilot hoặc all.", 503);
  if (mode.data === "all") return "langgraph-customer";
  if (mode.data === "pilot") {
    const users = z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(100).safeParse((env.AI_AGENT_CUSTOMER_PILOT_USERS ?? "")
      .split(",").map((value) => value.trim()).filter(Boolean));
    if (!users.success || !users.data.length) throw new AppError("Nhóm thử nghiệm engine nghiệp vụ chưa được cấu hình hợp lệ.", 503);
    if (users.data.includes(user.id)) return "langgraph-customer";
  }
  if (env.AI_AGENT_GRAPH_NEW_SESSIONS !== "true") return "legacy";
  const users = z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(100).safeParse((env.AI_AGENT_GRAPH_PILOT_USERS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean));
  if (!users.success || !users.data.length) throw new AppError("Nhóm thử nghiệm graph chưa được cấu hình hợp lệ.", 503);
  return users.data.includes(user.id) ? "langgraph-readonly" : "legacy";
}
