import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Vui lòng nhập nội dung tìm kiếm").max(100),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
