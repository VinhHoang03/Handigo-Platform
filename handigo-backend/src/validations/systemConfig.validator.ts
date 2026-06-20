import { z } from "zod";

export const systemConfigTypeSchema = z.enum(["STRING", "NUMBER", "BOOLEAN", "JSON"]);

export const systemConfigKeyParamSchema = z.object({
  key: z.string().trim().min(1).max(120),
});

export const systemConfigListQuerySchema = z.object({
  isPublic: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === "true";
    }),
  type: systemConfigTypeSchema.optional(),
  search: z.string().trim().optional(),
});

export const createSystemConfigSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key cấu hình là bắt buộc")
    .max(120)
    .regex(/^[A-Z0-9_]+$/, "Key cấu hình chỉ được dùng chữ in hoa, số và dấu gạch dưới"),
  value: z.unknown(),
  type: systemConfigTypeSchema,
  description: z.string().trim().max(1000).nullable().optional(),
  isPublic: z.boolean().default(false),
});

export const updateSystemConfigSchema = z.object({
  value: z.unknown(),
  type: systemConfigTypeSchema.optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  isPublic: z.boolean().optional(),
});

export type SystemConfigType = z.infer<typeof systemConfigTypeSchema>;
export type SystemConfigListQuery = z.infer<typeof systemConfigListQuerySchema>;
export type CreateSystemConfigInput = z.infer<typeof createSystemConfigSchema>;
export type UpdateSystemConfigInput = z.infer<typeof updateSystemConfigSchema>;
