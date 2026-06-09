import { Document, Schema, model } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface ICategory extends Document, IBaseDocument {
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  isActive: boolean;
  sortOrder: number;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: null },
    icon: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    ...baseFields,
  },
  { timestamps: true },
);

export const Category = model<ICategory>("Category", CategorySchema, "categories");
