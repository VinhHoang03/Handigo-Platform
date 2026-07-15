import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as chatService from "../services/chat.service";
import { emitToConversation } from "../sockets/socketServer";
import { sendControllerError } from "../utils/controllerError";

export const getMyConversations = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await chatService.getMyConversations(
      user.id,
      user.role,
      req.query,
    );
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getOrCreateConversationByOrder = async (
  req: Request,
  res: Response,
) => {
  try {
    const user = requireRequestUser(req);
    const conversation = await chatService.getOrCreateConversationByOrder(
      user.id,
      user.role,
      req.params.orderId as string,
    );
    return res.json({ success: true, data: conversation, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await chatService.getMessages(
      user.id,
      user.role,
      req.params.conversationId as string,
      req.query,
    );
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const message = await chatService.sendMessage(
      user.id,
      user.role,
      req.params.conversationId as string,
      req.body,
    );
    emitToConversation(req.params.conversationId as string, "message:new", message);
    return res
      .status(201)
      .json({ success: true, data: message, message: "Message sent" });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const markConversationSeen = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await chatService.markConversationSeen(
      user.id,
      user.role,
      req.params.conversationId as string,
    );
    emitToConversation(req.params.conversationId as string, "message:seen", result);
    return res.json({
      success: true,
      data: result,
      message: "Conversation marked as seen",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const reportConversation = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const report = await chatService.reportConversation(
      user.id,
      user.role,
      req.params.conversationId as string,
      req.body.description,
    );
    return res.status(201).json({
      success: true,
      data: report,
      message: "Đã gửi báo cáo cuộc trò chuyện.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const updateMessage = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const message = await chatService.updateMessage(
      user.id,
      user.role,
      req.params.messageId as string,
      req.body.content,
    );
    emitToConversation(message!.conversationId.toString(), "message:updated", message);
    return res.json({
      success: true,
      data: message,
      message: "Đã cập nhật tin nhắn.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const user = requireRequestUser(req);
    const result = await chatService.deleteMessage(
      user.id,
      user.role,
      req.params.messageId as string,
    );
    emitToConversation(result.conversationId.toString(), "message:deleted", {
      messageId: result._id,
    });
    return res.json({
      success: true,
      data: { messageId: result._id },
      message: "Đã xóa tin nhắn.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
