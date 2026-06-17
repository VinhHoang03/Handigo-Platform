import { z } from "zod";

const optionTypeEnum = z.enum([
  "room_count",
  "area_size",
  "package",
  "add_on",
  "other",
]);

const serviceOptionFields = {
  name: z.string().trim().min(1, "Name is required").max(200),
  optionType: optionTypeEnum,
  price: z.number().nonnegative("Price must be >= 0"),
  isActive: z.boolean().optional(),
};

export const createServiceOptionSchema = z.object(serviceOptionFields);

export const updateServiceOptionSchema = z
  .object(serviceOptionFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
