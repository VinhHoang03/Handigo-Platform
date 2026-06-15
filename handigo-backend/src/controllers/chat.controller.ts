import { Request, Response } from "express";
import * as chatService from "../services/chat.service";

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
    return res.json({ success: true, data: result, message: "Conversation marked as seen" });
  } catch (error: any) {
    return res.status(getStatusCode(error)).json({ success: false, message: error.message });
  }
};
