export interface ChatbotMessage {
  bookingSearch?: import("./agent.types").AgentBookingSearch;
  customerAttachments?: string[];
  confirmation?: import("./agent.types").AgentConfirmation;
  choiceGroups?: Array<{ label: string; multiple: boolean; options: string[] }>;
  _id: string;
  sender: "user" | "assistant";
  content: string;
  pagePath?: string | null;
  createdAt: string;
}

export interface ChatbotHistory {
  items: ChatbotMessage[];
}

export interface ChatbotReply {
  userMessage: ChatbotMessage;
  assistantMessage: ChatbotMessage;
}

export type ChatbotAudience = "CUSTOMER" | "PROVIDER" | "ADMIN" | "GUEST";
