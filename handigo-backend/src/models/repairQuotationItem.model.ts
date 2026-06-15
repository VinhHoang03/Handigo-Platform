import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument, Money } from "./common";

export type RepairQuotationItemType =
  | "labor"
  | "material"
  | "replacement_part"
  | "other";

export interface IRepairQuotationItem extends Document, IBaseDocument {
  quotationId: Types.ObjectId;
  title: string;
  description?: string | null;
  itemType: RepairQuotationItemType;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  note?: string | null;
}

const RepairQuotationItemSchema = new Schema<IRepairQuotationItem>(
  {
    quotationId: {
      type: Schema.Types.ObjectId,
      ref: "RepairQuotation",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: null,
      trim: true,
    },

    itemType: {
      type: String,
      enum: ["labor", "material", "replacement_part", "other"],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    note: {
      type: String,
      default: null,
      trim: true,
    },

    ...baseFields,
  },
  { timestamps: true },
);

RepairQuotationItemSchema.index({
  quotationId: 1,
});

export const RepairQuotationItem = model<IRepairQuotationItem>(
  "RepairQuotationItem",
  RepairQuotationItemSchema,
  "repairquotationitems",
);
