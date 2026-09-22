import type { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import { sendControllerError } from "../utils/controllerError";
import { loadAgentConfig } from "./ai.config";
import { AgentService, sessionView } from "./agent/agent.service";
import { AgentLoop } from "./agent/agent-loop.service";
import { SessionService } from "./session/session.service";
import { registerTools } from "./tools/register-tools";

const sessions = new SessionService();
export async function resetSession(req: Request, res: Response) {
  try {
    const session = await sessions.reset(req.body.sessionId, requireRequestUser(req).id);
    return res.json({ success: true, data: sessionView(session), message: "Đã bắt đầu phiên trợ lý mới." });
  } catch (error) { return sendControllerError(res, error); }
}

export async function getLatestSession(req: Request, res: Response) {
  try {
    const session = await sessions.latest(requireRequestUser(req).id);
    return res.json({ success: true, data: session ? sessionView(session) : null, message: "Đã tải phiên trợ lý." });
  } catch (error) { return sendControllerError(res, error); }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const config = loadAgentConfig();
    const service = new AgentService(sessions, new AgentLoop(config.createProvider(), registerTools(config.tools), config));
    const { sessionId, ...input } = req.body;
    const result = await service.send(requireRequestUser(req), sessionId, input);
    return res.json({ success: true, data: result, message: "Đã xử lý lượt trợ lý." });
  } catch (error) { return sendControllerError(res, error); }
}
