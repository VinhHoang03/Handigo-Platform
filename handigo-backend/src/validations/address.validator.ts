import { z } from "zod";
import { personNameSchema, vietnamesePhoneSchema } from "./user.validator";

const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);
const administrativeCodeSchema = z.number().int().positive();

export const createAddressSchema = z.object({
  recipientName: personNameSchema,
  recipientPhone: vietnamesePhoneSchema,
  fullAddress: z
    .string()
    .trim()
    .min(5, "Full address must be at least 5 characters"),

  province: z
    .string()
    .trim()
    .min(1, "Province is required"),

  provinceCode: administrativeCodeSchema.optional(),

  ward: z
    .string()
    .trim()
    .min(1, "Ward is required"),

  wardCode: administrativeCodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  placeId: z.string().trim().max(255).optional(),
  isDefault: z.boolean().optional(),
  note: z.string().trim().nullable().optional(),
});

export const updateAddressSchema = z.object({
  recipientName: personNameSchema.optional(),
  recipientPhone: vietnamesePhoneSchema.optional(),
  fullAddress: z
    .string()
    .trim()
    .min(5)
    .optional(),

  province: z
    .string()
    .trim()
    .min(1)
    .optional(),

  provinceCode: administrativeCodeSchema.optional(),

  ward: z
    .string()
    .trim()
    .min(1)
    .optional(),

  wardCode: administrativeCodeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  placeId: z.string().trim().max(255).optional(),
  isDefault: z.boolean().optional(),
  note: z.string().trim().nullable().optional(),
});
