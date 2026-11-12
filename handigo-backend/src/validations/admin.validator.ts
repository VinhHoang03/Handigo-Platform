import { z } from "zod";

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "locked"]),
});

export const adminEntityIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "ID không hợp lệ"),
});

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  keyword: z.string().trim().max(100).optional(),
  role: z.enum(["CUSTOMER", "PROVIDER", "ADMIN"]).optional(),
  status: z.enum(["active", "locked"]).optional(),
});

export {
  providerApplicationIdParamSchema,
  providerApplicationListQuerySchema,
  reviewProviderApplicationSchema,
} from "./providerApplication.validator";
