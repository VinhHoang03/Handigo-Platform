import type { Request, Response, NextFunction } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import { sendControllerError } from "../utils/controllerError";
import { loadAgentConfig } from "./ai.config";
import { AgentService, sessionView } from "./agent/agent.service";
import { AgentLoop } from "./agent/agent-loop.service";
import { SessionService } from "./session/session.service";
import { registerTools } from "./tools/register-tools";
import { withOrderActions } from "./agent/order-actions";
import { AgentFacade } from "./runtime/agent-facade";
import { getGraphHost, getCustomerGraphHost } from "./runtime/graph-host";

const sessions = new SessionService();
const facade = new AgentFacade(sessions, getGraphHost, (user, id, input) => {
  const config = loadAgentConfig();
  return new AgentService(sessions, new AgentLoop(config.createProvider(), registerTools(config.tools), config)).send(user, id, input);
}, undefined, getCustomerGraphHost);

export async function requireAttachmentSupport(req: Request, res: Response, next: NextFunction) {
  try {
    await facade.requireAttachmentSupport(requireRequestUser(req), String(req.params.sessionId));
    next();
  } catch (error) { return sendControllerError(res, error); }
}
export async function uploadAttachment(req: Request, res: Response) {
  try {
    const data = await facade.registerAttachment(requireRequestUser(req), String(req.params.sessionId), String(res.locals.imageUrl));
    return res.json({ success: true, data, message: "Đã tải ảnh hiện trạng cho cuộc trò chuyện." });
  } catch (error) { return sendControllerError(res, error); }
}

export async function deleteSession(req: Request, res: Response) {
  try {
    await facade.delete(requireRequestUser(req), String(req.params.sessionId));
    return res.json({ success: true, data: null, message: "Đã xóa cuộc trò chuyện." });
  } catch (error) { return sendControllerError(res, error); }
}

export async function listSessions(req: Request, res: Response) {
  try {
    const data = await facade.list(requireRequestUser(req), Number(req.query.page ?? 1), Number(req.query.limit ?? 20));
    return res.json({ success: true, data, message: "Đã tải danh sách cuộc trò chuyện." });
  } catch (error) { return sendControllerError(res, error); }
}

export async function getSession(req: Request, res: Response) {
  try {
    const session = await facade.get(requireRequestUser(req), String(req.params.sessionId));
    return res.json({ success: true, data: await withOrderActions(sessionView(session), requireRequestUser(req).id), message: "Đã tải cuộc trò chuyện." });
  } catch (error) { return sendControllerError(res, error); }
}
export async function getSessionProgress(req: Request, res: Response) {
  try {
    const data = await facade.progress(requireRequestUser(req), String(req.params.sessionId));
    return res.json({ success: true, data, message: "Đã tải tiến trình trợ lý." });
  } catch (error) { return sendControllerError(res, error); }
}
export async function resetSession(req: Request, res: Response) {
  try {
    const session = await facade.reset(requireRequestUser(req), req.body.sessionId);
    return res.json({ success: true, data: sessionView(session), message: "Đã bắt đầu phiên trợ lý mới." });
  } catch (error) { return sendControllerError(res, error); }
}

export async function getLatestSession(req: Request, res: Response) {
  try {
    const session = await facade.latest(requireRequestUser(req));
    return res.json({ success: true, data: session ? await withOrderActions(sessionView(session), requireRequestUser(req).id) : null, message: "Đã tải phiên trợ lý." });
  } catch (error) { return sendControllerError(res, error); }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const { sessionId, ...input } = req.body;
    const result = await facade.send(requireRequestUser(req), sessionId, input);
    return res.json({ success: true, data: await withOrderActions(result, requireRequestUser(req).id), message: "Đã xử lý lượt trợ lý." });
  } catch (error) { return sendControllerError(res, error); }
}
