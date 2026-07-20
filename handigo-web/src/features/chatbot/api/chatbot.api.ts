import api from "@/api/client";
import { unwrap } from "@/api/response";
import type {
  ChatbotHistory,
  ChatbotReply,
} from "../types/chatbot.types";

export const chatbotApi = {
  history: async (limit = 30) =>
    unwrap<ChatbotHistory>(
      await api.get("/chatbot/messages", { params: { limit } }),
    ),
  send: async (content: string, currentPath: string) =>
    unwrap<ChatbotReply>(
      await api.post("/chatbot/messages", { content, currentPath }),
    ),
};
