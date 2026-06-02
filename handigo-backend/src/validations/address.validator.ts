import { z } from "zod";

export const createAddressSchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(50, "Label must be less than 50 characters"),

  addressLine: z
    .string()
    .min(5, "Address line must be at least 5 characters"),

  ward: z
    .string()
    .min(1, "Ward is required"),

  district: z
    .string()
    .min(1, "District is required"),

  city: z
    .string()
    .min(1, "City is required"),

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

export const updateAddressSchema = z.object({
  label: z
    .string()
    .max(50)
    .optional(),

  addressLine: z
    .string()
    .min(5)
    .optional(),

  ward: z
    .string()
    .optional(),

  district: z
    .string()
    .optional(),

  city: z
    .string()
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