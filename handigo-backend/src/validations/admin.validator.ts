import { z } from "zod";

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "locked"]),
});

export { reviewProviderApplicationSchema } from "./providerApplication.validator";
