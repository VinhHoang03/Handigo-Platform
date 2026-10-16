import { Document, Schema, model } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface ICategory extends Document, IBaseDocument {
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  iconColor?: string | null;
  isActive: boolean;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: null },
    icon: { type: String, default: null },
    iconColor: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      match: [/^#[0-9a-f]{6}$/i, "Màu biểu tượng phải có định dạng #RRGGBB"],
    },
    isActive: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

CategorySchema.index(
  { iconColor: 1 },
  {
    unique: true,
    partialFilterExpression: { iconColor: { $type: "string" }, isDeleted: false },
    collation: { locale: "en", strength: 2 },
  },
);

export const Category = model<ICategory>("Category", CategorySchema, "categories");
