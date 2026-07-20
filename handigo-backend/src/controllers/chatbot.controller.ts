import { Request, Response } from "express";
import { requireRequestUser } from "../middlewares/authContext";
import * as chatbotService from "../services/chatbot.service";
import { sendControllerError } from "../utils/controllerError";

export const getMessages = async (req: Request, res: Response) => {
  try {
    const result = await chatbotService.getMessages(
      requireRequestUser(req),
      Number(req.query.limit),
    );
    return res.json({
      success: true,
      data: result,
      message: "Đã tải lịch sử trò chuyện.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const result = await chatbotService.sendMessage(
      requireRequestUser(req),
      req.body,
    );
    return res.status(201).json({
      success: true,
      data: result,
      message: "Trợ lý Handigo đã trả lời.",
    });
  } catch (error: unknown) {
    return sendControllerError(res, error);
  }
};
