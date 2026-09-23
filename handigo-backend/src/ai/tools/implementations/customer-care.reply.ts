import { z } from "zod";
import type { AgentTool } from "../tool.interface";

const resultSchema = z.object({ id: z.string(), statusLabel: z.string() });
export const receipt = (message: string): NonNullable<AgentTool["reply"]> => (result) => {
  const item = resultSchema.parse(result);
  return { state: "COMPLETED", message: `${message}\nMã yêu cầu: ${item.id}. Trạng thái: ${item.statusLabel}.\nBạn có thể xem chi tiết và bổ sung tệp tại Hỗ trợ của tôi (/customer/support).` };
};

