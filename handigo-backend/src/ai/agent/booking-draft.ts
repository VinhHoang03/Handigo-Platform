import { z } from "zod";
import { AppError } from "../../utils/appError";
import { bookingSchema, idSchema } from "../tools/implementations/booking.schemas";
import type { AgentChoiceGroup } from "../llm/llm.interface";
import { getUniformServicePrice } from "../../utils/uniformServicePrice";
import { getEarliestScheduledAt } from "../../utils/bookingPolicy";

const selectedOptionsSchema = z.array(z.object({
  optionId: idSchema,
  quantity: z.number().int().min(1).max(99).optional()
}).strict()).max(50);
export const bookingDraftPatchSchema = z.object({
  mode: z.enum(["update", "pause", "discard", "resume"]).default("update"),
  startNew: z.boolean().optional(),
  serviceQuery: z.string().trim().min(1).max(100).optional(),
  serviceId: idSchema.optional(),
  selectedOptions: selectedOptionsSchema.nullable().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
  optionPreference: z.string().trim().max(300).nullable().optional(),
  addressId: idSchema.nullable().optional(),
  addressPreference: z.string().trim().max(300).nullable().optional(),
  orderType: z.enum(["normal", "scheduled"]).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  schedulePreference: z.string().trim().max(200).nullable().optional(),
  scheduleDate: z.string().date().nullable().optional(),
  timeWindow: z.enum(["morning", "afternoon", "evening"]).nullable().optional(),
  paymentMethod: z.enum(["bank", "wallet", "cash"]).optional(),
  problemDescription: z.string().trim().max(2000).optional(),
}).strict();
export type BookingDraftPatch = z.infer<typeof bookingDraftPatchSchema>;
type DraftFields = "serviceId" | "selectedOptions" | "uniformQuantity" | "addressId" | "orderType" | "scheduledAt" | "paymentMethod" | "problemDescription";
export interface BookingDraft {
  revision: number;
  status: "active" | "paused" | "discarded" | "booked";
  values: Partial<z.infer<typeof bookingSchema>>;
  sources: Partial<Record<DraftFields, "customer" | "default">>;
  serviceQuery?: string;
  addressPreference?: string;
  schedulePreference?: string;
  optionPreference?: string;
  requestedQuantity?: number;
  scheduleDate?: string;
  timeWindow?: "morning" | "afternoon" | "evening";
  missing: string[];
  summary: string[];
  choiceGroups: AgentChoiceGroup[];
  orderId?: string;
  /** Internal flag: true khi scheduledAt được tự động chuyển sang ngày hôm sau vì đã qua giờ */
  _autoAdvancedDay?: boolean;
}
export interface DraftService {
  id: string; name: string; serviceType: string; requiresOptionSelection: boolean;
  fixedPrice?: number | null;
  options: Array<{
    _id: unknown; name: string; price: number; optionType: string;
    allowsQuantity: boolean; selectionGroup?: string | null; selectionMode: string;
    description?: string | null; isRequired?: boolean
  }>;
}
export interface DraftAddress { id: string; fullAddress: string; ward: string; province: string; isDefault: boolean }
export interface BookingDraftDependencies {
  search(query: string): Promise<Array<{ id: string; name: string }>>;
  service(id: string): Promise<DraftService>;
  addresses(userId: string): Promise<DraftAddress[]>;
}

export async function updateBookingDraft(previous: BookingDraft | undefined, input: BookingDraftPatch,
  userId: string, deps: BookingDraftDependencies): Promise<BookingDraft> {
  if ((previous?.status === "booked" || previous?.orderId) && (!input.startNew || input.mode !== "update")) {
    throw new AppError("Bản nháp này đã tạo đơn. Chỉ bắt đầu đơn mới khi khách yêu cầu đặt thêm; không tạo lại đơn cũ.", 409);
  }
  if (input.mode === "pause" || input.mode === "discard") {
    if (!previous) throw new AppError("Chưa có bản nháp đặt lịch.", 400);
    return { ...previous, status: input.mode === "pause" ? "paused" : "discarded", revision: previous.revision + 1 };
  }
  const draft: BookingDraft = !previous || input.startNew || previous.status === "discarded"
    ? { revision: 0, status: "active", values: {}, sources: {}, missing: [], summary: [], choiceGroups: [] }
    : JSON.parse(JSON.stringify(previous));
  draft.status = "active";
  draft.revision += 1;
  draft.missing = []; draft.summary = []; draft.choiceGroups = [];
  const values = draft.values;
  const oldServiceId = values.serviceId;
  if (input.serviceQuery !== undefined) {
    if (input.serviceQuery !== draft.serviceQuery && !input.serviceId) delete values.serviceId;
    draft.serviceQuery = input.serviceQuery;
  }
  if (input.serviceId !== undefined) { values.serviceId = input.serviceId; draft.sources.serviceId = "customer"; }
  if (!values.serviceId && draft.serviceQuery) {
    const candidates = await deps.search(draft.serviceQuery);
    const exact = candidates.filter((item) => item.name.trim().toLocaleLowerCase("vi")
      === draft.serviceQuery!.trim().toLocaleLowerCase("vi"));
    const match = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : undefined;
    if (match) {
      values.serviceId = match.id; draft.sources.serviceId = "customer";
    } else {
      draft.missing.push(candidates.length ? "Chọn dịch vụ phù hợp" : "Chưa tìm thấy dịch vụ; hãy mô tả lại nhu cầu");
      if (candidates.length) draft.choiceGroups.push({ label: "Dịch vụ", multiple: false, options: candidates.map((item) => item.name) });
    }
  }
  if (oldServiceId !== values.serviceId) {
    delete values.selectedOptions; delete draft.sources.selectedOptions;
    delete values.uniformQuantity; delete draft.sources.uniformQuantity;
    if (oldServiceId) draft.requestedQuantity = undefined;
    if (oldServiceId) draft.optionPreference = undefined;
  }
  if (input.optionPreference !== undefined) {
    draft.optionPreference = input.optionPreference || undefined;
    if (draft.optionPreference && !input.selectedOptions) { delete values.selectedOptions; delete draft.sources.selectedOptions; }
  }
  if (input.selectedOptions?.length) draft.optionPreference = undefined;
  if (input.quantity !== undefined) draft.requestedQuantity = input.quantity;
  if (input.selectedOptions !== undefined || draft.optionPreference) {
    delete values.uniformQuantity; delete draft.sources.uniformQuantity;
  }
  if (input.selectedOptions === null) {
    delete values.selectedOptions; delete draft.sources.selectedOptions;
  } else if (input.selectedOptions !== undefined) {
    const selectedOptions = input.selectedOptions;
    const previousQuantities = new Map(values.selectedOptions?.map((item) => [item.optionId, item.quantity]));
    if (selectedOptions.length > 1 && draft.requestedQuantity !== undefined
      && selectedOptions.some((item) => item.quantity === undefined && !previousQuantities.has(item.optionId))) {
      throw new AppError("Vui lòng nêu số lượng cho từng tùy chọn đã chọn.", 400);
    }
    values.selectedOptions = selectedOptions.map((item) => ({
      optionId: item.optionId,
      quantity: item.quantity ?? previousQuantities.get(item.optionId)
        ?? (selectedOptions.length === 1 ? draft.requestedQuantity : undefined) ?? 1
    }));
    draft.sources.selectedOptions = "customer";
  }
  for (const key of ["addressId", "orderType", "paymentMethod", "problemDescription"] as const) {
    if (input[key] === undefined) continue;
    if (input[key] === null) { delete values[key]; delete draft.sources[key]; }
    else Object.assign(values, { [key]: input[key] });
    if (input[key] !== null) draft.sources[key] = "customer";
  }
  if (input.addressPreference !== undefined) {
    draft.addressPreference = input.addressPreference || undefined;
    if (draft.addressPreference && !input.addressId) { delete values.addressId; delete draft.sources.addressId; }
  }
  if (input.addressId) draft.addressPreference = undefined;
  if (input.schedulePreference !== undefined) {
    draft.schedulePreference = input.schedulePreference || undefined;
    if (draft.schedulePreference && !input.scheduledAt) {
      delete values.scheduledAt; delete draft.sources.scheduledAt;
      draft.scheduleDate = undefined; draft.timeWindow = undefined;
      values.orderType = "scheduled"; draft.sources.orderType = "customer";
    }
  }
  if (input.scheduleDate !== undefined) {
    draft.scheduleDate = input.scheduleDate || undefined;
    if (draft.scheduleDate && !input.scheduledAt) { delete values.scheduledAt; delete draft.sources.scheduledAt; values.orderType = "scheduled"; draft.sources.orderType = "customer"; }
  }
  if (input.timeWindow !== undefined) {
    draft.timeWindow = input.timeWindow || undefined;
    if (input.timeWindow && !input.scheduledAt) { delete values.scheduledAt; delete draft.sources.scheduledAt; values.orderType = "scheduled"; draft.sources.orderType = "customer"; }
  }
  if (input.scheduledAt === null) {
    delete values.scheduledAt; delete draft.sources.scheduledAt;
  } else if (input.scheduledAt) {
    let scheduledMs = Date.parse(input.scheduledAt);
    // Nếu giờ đã qua, tự chuyển sang ngày hôm sau cùng giờ thay vì báo lỗi
    if (scheduledMs <= Date.now()) {
      scheduledMs += 24 * 3600 * 1000;
      draft._autoAdvancedDay = true;
    } else {
      draft._autoAdvancedDay = false;
    }
    // Tính giờ địa phương tại Asia/Ho_Chi_Minh (+07:00) để format ISO với offset đúng
    const localMs = scheduledMs + 7 * 3600 * 1000; // UTC → +07:00 chỉ dùng để lấy các thành phần local
    const d = new Date(localMs);
    const pad = (n: number) => String(n).padStart(2, "0");
    const adjustedIso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+07:00`;
    values.scheduledAt = adjustedIso;
    draft.sources.scheduledAt = "customer";
    values.orderType = "scheduled"; draft.sources.orderType = "customer"; draft.schedulePreference = undefined;
    draft.scheduleDate = adjustedIso.slice(0, 10);
  }
  if (input.orderType === "normal" && !input.scheduledAt) {
    delete values.scheduledAt; delete draft.sources.scheduledAt; draft.schedulePreference = undefined;
    draft.scheduleDate = undefined; draft.timeWindow = undefined;
  }
  if (!values.orderType) { values.orderType = "normal"; draft.sources.orderType = "default"; }
  if (!values.paymentMethod) { values.paymentMethod = "bank"; draft.sources.paymentMethod = "default"; }

  const [service, addresses] = await Promise.all([
    values.serviceId ? deps.service(values.serviceId) : Promise.resolve(null), deps.addresses(userId),
  ]);
  if (values.addressId && !addresses.some((address) => address.id === values.addressId)) {
    delete values.addressId; delete draft.sources.addressId;
    draft.addressPreference = "Địa chỉ đã chọn không còn khả dụng";
  }
  if (!values.addressId && !draft.addressPreference) {
    const defaults = addresses.filter((address) => address.isDefault);
    const address = defaults.length === 1 ? defaults[0] : addresses.length === 1 ? addresses[0] : undefined;
    if (address) { values.addressId = address.id; draft.sources.addressId = "default"; }
  }
  if (!values.addressId) {
    draft.missing.push(addresses.length ? "Chọn địa chỉ thực hiện" : "Thêm địa chỉ vào sổ địa chỉ trước khi đặt lịch");
    if (addresses.length) draft.choiceGroups.push({
      label: "Địa chỉ", multiple: false,
      options: addresses.slice(0, 12).map((address) => `${address.fullAddress}, ${address.ward}, ${address.province}`)
    });
  }
  if (!service && !draft.missing.some((item) => item.includes("dịch vụ"))) draft.missing.push("Chọn dịch vụ cần đặt");
  if (service) {
    const needsOptions = service.requiresOptionSelection || service.serviceType === "fixed_price";
    const uniform = getUniformServicePrice(service.serviceType, service.options, service.fixedPrice);
    if (uniform && service.options.length === 0) {
      delete values.selectedOptions; delete draft.sources.selectedOptions;
      delete draft.optionPreference;
    }
    if (values.uniformQuantity !== undefined && !uniform) {
      delete values.uniformQuantity; delete draft.sources.uniformQuantity;
    }
    if (!values.selectedOptions?.length && !draft.optionPreference && uniform) {
      const quantity = draft.requestedQuantity ?? values.uniformQuantity ?? 1;
      if (!uniform.allowsQuantity && quantity !== 1) throw new AppError("Dịch vụ này không cho phép thay đổi số lượng.", 400);
      values.uniformQuantity = quantity;
      draft.sources.uniformQuantity = draft.requestedQuantity !== undefined ? "customer" : "default";
    }
    if (values.selectedOptions === undefined && values.uniformQuantity === undefined && needsOptions && !draft.optionPreference) {
      const candidates = service.options.filter((option) => option.optionType !== "add_on"
        && (service.serviceType !== "fixed_price" || option.price > 0));
      if (candidates.length >= 1) {
        values.selectedOptions = [{ optionId: String(candidates[0]._id), quantity: draft.requestedQuantity ?? 1 }];
        draft.sources.selectedOptions = "default";
      }
    }
    const selected = values.selectedOptions ?? [];
    if (input.quantity !== undefined && selected.length === 1) selected[0].quantity = input.quantity;
    if (input.quantity !== undefined && selected.length > 1) throw new AppError("Vui lòng nêu số lượng cho từng tùy chọn đã chọn.", 400);
    const ids = new Set(selected.map((item) => item.optionId));
    if (ids.size !== selected.length) throw new AppError("Danh sách tùy chọn bị trùng lặp.", 400);
    for (const item of selected) {
      const option = service.options.find((candidate) => String(candidate._id) === item.optionId);
      if (!option) throw new AppError("Tùy chọn không thuộc dịch vụ đang chọn hoặc đã ngừng hoạt động.", 400);
      if (!option.allowsQuantity && item.quantity !== 1) throw new AppError(`“${option.name}” không cho phép thay đổi số lượng.`, 400);
    }
    const groups = new Map<string, DraftService["options"]>();
    for (const option of service.options) {
      const group = option.selectionGroup?.trim().toLowerCase() || "";
      groups.set(group, [...(groups.get(group) ?? []), option]);
    }
    for (const [group, options] of groups) {
      if (group && options.every((option) => option.selectionMode === "single")
        && options.filter((option) => ids.has(String(option._id))).length > 1) {
        throw new AppError(`Nhóm “${options[0].selectionGroup}” chỉ được chọn một tùy chọn.`, 400);
      }
    }
    if (draft.optionPreference || (values.uniformQuantity === undefined && needsOptions && (!selected.length || (service.serviceType === "fixed_price"
      && !service.options.some((option) => ids.has(String(option._id)) && option.price > 0))))) {
      draft.missing.push(`Chọn gói hoặc loại dịch vụ${draft.optionPreference ? ` (${draft.optionPreference})` : ""}`);
      for (const [group, options] of groups) {
        draft.choiceGroups.push({
          label: options[0].selectionGroup || "Gói dịch vụ",
          multiple: !group || options.some((option) => option.selectionMode !== "single"),
          options: options.slice(0, 12).map((option) => `${option.name}${service.serviceType === "fixed_price" ? ` — ${option.price.toLocaleString("vi-VN")} đ` : ""}`)
        });
      }
    }
    if (service.serviceType === "variable_price" && values.paymentMethod === "cash") {
      draft.missing.push("Tiền cọc cần thanh toán chuyển khoản hoặc ví Handigo");
      draft.choiceGroups.push({ label: "Thanh toán tiền cọc", multiple: false, options: ["Chuyển khoản", "Ví Handigo"] });
    }
    draft.summary.push(`Dịch vụ: ${service.name}`);
    if (values.uniformQuantity !== undefined && uniform) {
      draft.summary.push(`Số lượng: ${values.uniformQuantity}; đơn giá chung: ${uniform.unitPrice.toLocaleString("vi-VN")} đ. Không cần chọn loại thiết bị.`);
    }
    for (const item of selected) {
      const option = service.options.find((candidate) => String(candidate._id) === item.optionId)!;
      draft.summary.push(`${option.name} × ${item.quantity}`);
    }
  }
  if (values.orderType === "scheduled") {
    if (!values.scheduledAt || Date.parse(values.scheduledAt) < getEarliestScheduledAt().getTime()) {
      // scheduledAt bị thiếu hoặc vẫn nằm trong quá khứ (sau khi đã thử auto-advance)
      if (values.scheduledAt) { delete values.scheduledAt; delete draft.sources.scheduledAt; }
      draft.missing.push(`Chọn ngày và giờ hẹn trong tương lai${draft.schedulePreference ? ` (${draft.schedulePreference})` : ""}`);
      if (draft.scheduleDate) {
        const hours = draft.timeWindow === "morning" ? [8, 9, 10] : draft.timeWindow === "afternoon" ? [13, 14, 15]
          : draft.timeWindow === "evening" ? [18, 19, 20] : [9, 14, 18];
        const options = hours.map((hour) => `${draft.scheduleDate}T${String(hour).padStart(2, "0")}:00:00+07:00`)
          .filter((time) => Date.parse(time) > Date.now())
          .map((time) => new Date(time).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }));
        if (options.length) draft.choiceGroups.push({ label: "Giờ hẹn mong muốn (chưa giữ chỗ)", multiple: false, options });
      }
    } else if (draft._autoAdvancedDay) {
      // Đã tự chuyển sang hôm sau, thêm ghi chú vào summary
      const displayTime = new Date(Date.parse(values.scheduledAt!)).toLocaleString("vi-VN",
        { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
      draft.summary.push(`⚠️ Giờ bạn chọn đã qua, đã tự chuyển lịch sang ${displayTime} (ngày mai). Bạn có thể nhắn để đổi lại.`);
    }
  }
  const address = addresses.find((item) => item.id === values.addressId);
  if (address) draft.summary.push(`Địa chỉ: ${address.fullAddress}, ${address.ward}, ${address.province}`);
  draft.summary.push(`Thời gian: ${values.orderType === "normal" ? "Đặt ngay" : values.scheduledAt || draft.schedulePreference || "Chưa chọn"}`);
  draft.summary.push(`Thanh toán: ${{ bank: "Chuyển khoản", wallet: "Ví Handigo", cash: "Tiền mặt" }[values.paymentMethod]}`);
  draft.choiceGroups = draft.choiceGroups.slice(0, 6);
  return draft;
}

export function readyBookingArguments(draft: BookingDraft) {
  if (draft.status !== "active" || draft.missing.length) return null;
  return bookingSchema.parse(draft.values);
}
