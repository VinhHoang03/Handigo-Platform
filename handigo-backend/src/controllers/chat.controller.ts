import { Request, Response } from "express";
import * as chatService from "../services/chat.service";
import { emitToConversation } from "../sockets/socketServer";

const getStatusCode = (error: any) => error.statusCode || 500;

export const getMyConversations = async (req: Request, res: Response) => {
  try {
    const result = await chatService.getMyConversations(
      req.user!.id,
      req.user!.role as any,
      req.query,
    );
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const getOrCreateConversationByOrder = async (req: Request, res: Response) => {
  try {
    const conversation = await chatService.getOrCreateConversationByOrder(
      req.user!.id,
      req.user!.role as any,
      req.params.orderId as string,
    );
    return res.json({ success: true, data: conversation, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const result = await chatService.getMessages(
      req.user!.id,
      req.user!.role as any,
      req.params.conversationId as string,
      req.query,
    );
    return res.json({ success: true, data: result, message: "Success" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const message = await chatService.sendMessage(
      req.user!.id,
      req.user!.role as any,
      req.params.conversationId as string,
      req.body,
    );
    emitToConversation(req.params.conversationId as string, "message:new", message);
    return res.status(201).json({ success: true, data: message, message: "Message sent" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const markConversationSeen = async (req: Request, res: Response) => {
  try {
    const result = await chatService.markConversationSeen(
      req.user!.id,
      req.user!.role as any,
      req.params.conversationId as string,
    );
    emitToConversation(req.params.conversationId as string, "message:seen", result);
    return res.json({ success: true, data: result, message: "Conversation marked as seen" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const reportConversation = async (req: Request, res: Response) => {
  try {
    const report = await chatService.reportConversation(
      req.user!.id,
      req.user!.role as any,
      req.params.conversationId as string,
      req.body.description,
    );
    return res.status(201).json({
      success: true,
      data: report,
      message: "Đã gửi báo cáo cuộc trò chuyện.",
    });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const updateMessage = async (req: Request, res: Response) => {
  try {
    const message = await chatService.updateMessage(
      req.user!.id,
      req.user!.role as any,
      req.params.messageId as string,
      req.body.content,
    );
    emitToConversation(message!.conversationId.toString(), "message:updated", message);
    return res.json({ success: true, data: message, message: "Đã cập nhật tin nhắn." });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};

export const deleteMessage = async (req: Request, res: Response) => {
  try {
    const result = await chatService.deleteMessage(
      req.user!.id,
      req.user!.role as any,
      req.params.messageId as string,
    );
    emitToConversation(result.conversationId.toString(), "message:deleted", { messageId: result._id });
    return res.json({ success: true, data: { messageId: result._id }, message: "Đã xóa tin nhắn." });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};
