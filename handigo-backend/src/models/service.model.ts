import { Document, Schema, model, Types } from "mongoose";
import { baseFields, IBaseDocument } from "./common";

export interface IServiceProcessStep {
  title: string;
  description: string;
}

export interface IServiceOptionGroup {
  _id: Types.ObjectId;
  name: string;
  selectionMode: "single" | "multiple";
  isRequired: boolean;
  sortOrder: number;
}

export interface IService extends Document, IBaseDocument {
  categoryId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string | null;
  processSteps: IServiceProcessStep[];
  optionGroups: IServiceOptionGroup[];
  serviceType: "fixed_price" | "variable_price";
  fixedPrice?: number | null;
  depositAmount?: number | null;
  image?: string | null;
  coverImage?: string | null;
  galleryImages: string[];
  requiresOptionSelection: boolean;
  isActive: boolean;
}

const ServiceProcessStepSchema = new Schema<IServiceProcessStep>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const ServiceSchema = new Schema<IService>(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, default: null },
    optionGroups: { type: [new Schema<IServiceOptionGroup>({
      name: { type: String, required: true, trim: true, maxlength: 120 },
      selectionMode: { type: String, enum: ["single", "multiple"], required: true },
      isRequired: { type: Boolean, default: false },
      sortOrder: { type: Number, min: 0, default: 0 },
    })], default: [] },
    processSteps: {
      type: [ServiceProcessStepSchema],
      default: [],
      validate: {
        validator: (steps: IServiceProcessStep[]) => Array.isArray(steps) && steps.length <= 20,
        message: "Quy trình dịch vụ chỉ được có tối đa 20 bước",
      },
    },
    serviceType: {
      type: String,
      enum: ["fixed_price", "variable_price"],
      required: true,
    },
    fixedPrice: { type: Number, default: null, min: 0 },
    depositAmount: { type: Number, default: null, min: 0 },
    image: { type: String, default: undefined },
    coverImage: { type: String, default: undefined },
    galleryImages: {
      type: [String],
      default: [],
      validate: {
        validator: (images: string[]) => images.length <= 8 && new Set(images).size === images.length,
        message: "Thư viện tối đa 8 ảnh và không được trùng ảnh",
      },
    },
    requiresOptionSelection: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    ...baseFields,
  },
  { timestamps: true },
);

// image chỉ là bí danh tương thích của cover trong response.
for (const option of ["toJSON", "toObject"] as const) {
  ServiceSchema.set(option, {
    transform: (_doc, value) => {
      value.coverImage = value.coverImage === undefined ? value.image ?? null : value.coverImage;
      value.image = value.coverImage;
      return value;
    },
  });
}

ServiceSchema.index({ categoryId: 1, slug: 1 }, { unique: true });
ServiceSchema.index({ categoryId: 1 });

export const Service = model<IService>("Service", ServiceSchema, "services");
