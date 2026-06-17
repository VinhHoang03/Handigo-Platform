import { z } from "zod";

const dateStringSchema = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid date",
});

const toStartOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const toEndOfDay = (value: string) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

export const dashboardQuerySchema = z
  .object({
    fromDate: dateStringSchema.optional().transform((value) => (value ? toStartOfDay(value) : undefined)),
    toDate: dateStringSchema.optional().transform((value) => (value ? toEndOfDay(value) : undefined)),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    topLimit: z.coerce.number().int().min(1).max(50).default(10),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .superRefine((query, ctx) => {
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      ctx.addIssue({
        code: "custom",
        path: ["toDate"],
        message: "toDate must be greater than or equal to fromDate",
      });
    }
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const providerAvailabilitySchema = z.object({
  availabilityStatus: z.enum(["online", "offline", "busy"]),
});
