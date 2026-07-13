import { z } from "zod";

export const currentLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type CurrentLocationPayload = z.infer<typeof currentLocationSchema>;

export const reverseGeocodeQuerySchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "Vĩ độ phải nằm trong khoảng từ -90 đến 90")
    .max(90, "Vĩ độ phải nằm trong khoảng từ -90 đến 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Kinh độ phải nằm trong khoảng từ -180 đến 180")
    .max(180, "Kinh độ phải nằm trong khoảng từ -180 đến 180"),
});

export type ReverseGeocodeQuery = z.infer<typeof reverseGeocodeQuerySchema>;
