import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export type ServiceOptionType =
  | "room_count"  // Theo số phòng: 1PN, 2PN, 3PN...
  | "area_size"   // Theo diện tích: dưới 50m², 50-100m²...
  | "package"     // Gói đặc biệt: tổng vệ sinh, cao cấp...
  | "add_on"      // Dịch vụ thêm: vệ sinh máy lạnh, khử khuẩn...
  | "other";

export interface IServiceOption extends Document, IBaseDocument {
  serviceId: Types.ObjectId;
  name: string;
  optionType: ServiceOptionType;
  price: Money;
  isActive: boolean;
}

const ServiceOptionSchema = new Schema<IServiceOption>(
  {
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    name: { type: String, required: true, trim: true },
    optionType: {
      type: String,
      enum: ["room_count", "area_size", "package", "add_on", "other"],
      required: true,
      default: "other",
    },
    price: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

ServiceOptionSchema.index({ serviceId: 1 });

export const ServiceOption = model<IServiceOption>("ServiceOption", ServiceOptionSchema, "serviceoptions");
