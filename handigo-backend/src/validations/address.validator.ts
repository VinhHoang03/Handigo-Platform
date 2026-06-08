import { z } from "zod";

export const createAddressSchema = z.object({
  receiverName: z
    .string()
    .min(1, "Receiver name is required")
    .max(100, "Receiver name must be less than 100 characters"),

  phone: z
    .string()
    .min(1, "Phone is required")
    .max(20, "Phone must be less than 20 characters"),

  fullAddress: z
    .string()
    .min(5, "Full address must be at least 5 characters"),

  province: z
    .string()
    .min(1, "Province is required"),

  ward: z
    .string()
    .min(1, "Ward is required"),

  latitude: z
    .number()
    .min(-90)
    .max(90)
    .optional(),

  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional(),

  isDefault: z
    .boolean()
    .optional(),

  note: z
    .string()
    .nullable()
    .optional(),
});

export const updateAddressSchema = z.object({
  receiverName: z
    .string()
    .max(100)
    .optional(),

  phone: z
    .string()
    .max(20)
    .optional(),

  fullAddress: z
    .string()
    .min(5)
    .optional(),

  province: z
    .string()
    .optional(),

  ward: z
    .string()
    .optional(),

  note: z
    .string()
    .nullable()
    .optional(),

  latitude: z
    .number()
    .min(-90)
    .max(90)
    .optional(),

  longitude: z
    .number()
    .min(-180)
    .max(180)
    .optional(),

  isDefault: z
    .boolean()
    .optional(),
});
