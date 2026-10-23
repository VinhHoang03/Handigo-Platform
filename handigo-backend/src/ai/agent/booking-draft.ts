import { z } from "zod";
import { AppError } from "../../utils/appError";
import { bookingSchema, idSchema } from "../tools/implementations/booking.schemas";
import type { AgentChoiceGroup } from "../llm/llm.interface";
import { getUniformServicePrice } from "../../utils/uniformServicePrice";
import { getEarliestScheduledAt, isWithinAppointmentHours } from "../../utils/bookingPolicy";
import { bookingAttachmentsSchema } from "./booking-attachments";
import type { DraftBookingAddress } from "../../services/agentAddress.service";

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
  saveAddressToBook: z.boolean().optional(),
  addressPreference: z.string().trim().max(300).nullable().optional(),
  voucherCode: z.string().trim().min(1).max(50).nullable().optional(),
  voucherPreference: z.enum(["best", "choose"]).nullable().optional(),
  preferredProviderId: idSchema.nullable().optional(),
  providerPreference: z.string().trim().min(1).max(100).nullable().optional(),
  providerCriteria: z.enum(["nearest", "highest_rating", "most_completed", "choose"]).nullable().optional(),
  orderType: z.enum(["normal", "scheduled"]).optional(),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  schedulePreference: z.string().trim().max(200).nullable().optional(),
  scheduleDate: z.string().date().nullable().optional(),
  timeWindow: z.enum(["morning", "afternoon", "evening"]).nullable().optional(),
  paymentMethod: z.enum(["bank", "wallet", "cash"]).optional(),
  problemDescription: z.string().trim().max(2000).optional(),
  customerAttachments: bookingAttachmentsSchema.optional(),
}).strict();
export type BookingDraftPatch = z.infer<typeof bookingDraftPatchSchema>;
type DraftFields = "serviceId" | "selectedOptions" | "uniformQuantity" | "addressId" | "orderType" | "scheduledAt" | "paymentMethod" | "problemDescription" | "customerAttachments" | "voucherCode" | "preferredProviderId";
export interface BookingDraft {
  lookupFailures?: Array<"providers" | "vouchers">;
  draftAddress?: DraftBookingAddress;
  rebookNeedsOptionReview?: boolean;
  revision: number;
  status: "active" | "paused" | "discarded" | "booked";
  values: Partial<z.infer<typeof bookingSchema>>;
  sources: Partial<Record<DraftFields, "customer" | "default">>;
  serviceQuery?: string;
  addressPreference?: string;
  schedulePreference?: string;
  optionPreference?: string;
  providerPreference?: string;
  voucherDecision?: "selected" | "declined";
  voucherPreference?: "best" | "choose";
  voucherFeedback?: string;
  providerCriteria?: "nearest" | "highest_rating" | "most_completed" | "choose";
  availableVouchers?: Array<{ code: string; name: string; discountAmount: number; finalAmount: number; endAt?: string }>;
  providerCandidates?: Array<{ id: string; name: string; distanceMeters?: number; averageRating?: number; totalCompletedOrders?: number }>;
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
  id: string; name: string; slug?: string; serviceType: string; requiresOptionSelection: boolean;
  fixedPrice?: number | null;
  optionGroups?: Array<{ _id: unknown; name: string; selectionMode: string; isRequired: boolean }>;
  options: Array<{
    _id: unknown; groupId?: unknown; name: string; price: number; optionType: string;
    allowsQuantity: boolean; selectionGroup?: string | null; selectionMode: string;
    description?: string | null; isRequired?: boolean
  }>;
}
export interface DraftAddress { id: string; fullAddress: string; ward: string; province: string; isDefault: boolean;
  recipientName?: string; recipientPhone?: string; note?: string | null }
const normalizeAddress = (text: string) => text.toLocaleLowerCase("vi-VN").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[,.;\s]+/g, " ").trim();

export function bookingAddressLabel<T extends Pick<DraftAddress, "fullAddress" | "ward" | "province">>(address: T) {
  const parts = [address.fullAddress.trim(), address.ward.trim(), address.province.trim()].filter(Boolean);
  if (normalizeAddress(address.fullAddress).endsWith(normalizeAddress(`${address.ward}, ${address.province}`))) return address.fullAddress.trim();
  return parts.reduce<string[]>((result, part) => {
    if (!normalizeAddress(result.join(", ")).endsWith(normalizeAddress(part))) result.push(part);
    return result;
  }, []).join(", ");
}

export function uniqueBookingAddresses<T extends DraftAddress>(addresses: T[], selectedId?: string): T[] {
  const unique = new Map<string, T>();
  for (const address of addresses) {
    const key = JSON.stringify([normalizeAddress(bookingAddressLabel(address)),
      ...[address.recipientName ?? "", address.recipientPhone ?? "", address.note ?? ""]
        .map((value) => value.toLocaleLowerCase("vi-VN").trim().replace(/\s+/g, " "))]);
    const current = unique.get(key);
    if (!current || address.id === selectedId || (current.id !== selectedId && address.isDefault && !current.isDefault)) unique.set(key, address);
  }
  return [...unique.values()];
}

export function bookingAddressChoice(address: DraftAddress, addresses: DraftAddress[]) {
  const label = bookingAddressLabel(address);
  return addresses.filter((item) => normalizeAddress(bookingAddressLabel(item)) === normalizeAddress(label)).length > 1
    ? `${label} — ${address.recipientName || "Người nhận"}${address.recipientPhone ? `, ${address.recipientPhone}` : ""} (${address.id.slice(-6)})`
    : label;
}
export interface BookingDraftDependencies {
  search(query: string): Promise<Array<{ id: string; name: string }>>;
  service(id: string): Promise<DraftService>;
  addresses(userId: string): Promise<DraftAddress[]>;
  vouchers?(userId: string, args: Pick<z.infer<typeof bookingSchema>, "serviceId" | "selectedOptions" | "uniformQuantity">): Promise<NonNullable<BookingDraft["availableVouchers"]>>;
  voucherFeedback?(userId: string, args: Pick<z.infer<typeof bookingSchema>, "serviceId" | "selectedOptions" | "uniformQuantity" | "voucherCode">): Promise<string>;
  providers?(userId: string, args: z.infer<typeof bookingSchema> & { providerQuery?: string }, draftAddress?: DraftBookingAddress): Promise<{
    available: NonNullable<BookingDraft["providerCandidates"]>;
    requested: Array<{ id: string; name: string; eligible: boolean; reason: string }>;
  }>;
}

const optionGroupKey = (option: DraftService["options"][number]) => option.groupId
  ? String(option.groupId) : option.selectionGroup?.trim().toLocaleLowerCase("vi-VN") || "";
const normalizeOptionName = (value: string) => normalizeAddress(value).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export function parseBookingVoucherRequest(message: string): Pick<BookingDraftPatch, "voucherCode" | "voucherPreference"> | undefined {
  let text = normalizeAddress(message).replace(/[!?]+$/, "").trim();
  const group = /^(?:voucher co the su dung|kiem tra voucher):\s*(.+)$/.exec(text);
  if (group) {
    text = group[1].split(/\s*[—–]\s*/)[0].trim();
    if (/^[a-z0-9][a-z0-9_-]{1,49}$/.test(text)) return { voucherCode: text.toUpperCase() };
  }
  if (text === "kiem tra lai voucher") return { voucherPreference: "choose" };
  const prefix = "(?:(?:toi|minh|em) (?:muon|can) |cho toi |giup toi )?";
  const object = "(?:ma giam gia|voucher|ma)";
  const action = "(?:ap(?: dung)?|su dung|dung|chon|xem|kiem tra)";
  const tail = "(?: (?:cho don nay|vao don nay|giup toi|nhe|voi))?";
  if (new RegExp(`^${prefix}(?:bo|go|khong (?:su )?dung) ${object}${tail}$`).test(text)) return { voucherCode: null };
  if (new RegExp(`^${prefix}${action} ${object} (?:tot nhat|giam nhieu nhat|co loi nhat)${tail}$`).test(text)) return { voucherPreference: "best" };
  if (new RegExp(`^${prefix}${action} ${object}${tail}$`).test(text)
    || /^(?:toi|minh|em) co (?:ma giam gia|voucher|ma) nao (?:dung duoc|khong)$/.test(text)) return { voucherPreference: "choose" };
  const code = new RegExp(`^${prefix}${action} ${object} ([a-z0-9][a-z0-9_-]{1,49})${tail}$`).exec(text);
  return code ? { voucherCode: code[1].toUpperCase() } : undefined;
}

export const isGeneralRepairBookingRequest = (message: string) =>
  /^(?:(?:toi|minh|em|anh|chi) (?:muon|can) )?dat (?:dich vu )?(?:sua chua|sua) (?:dieu hoa|may lanh)(?: (?:cho toi|giup toi|nhe|voi))*$/.test(normalizeOptionName(message));

export function isAirConditionerRepair(service: Pick<DraftService, "name" | "slug" | "serviceType">) {
  return service.serviceType === "variable_price" && [service.name, service.slug ?? ""]
    .some((name) => /^(?:sua chua|sua) (?:dieu hoa|may lanh)$/.test(normalizeOptionName(name)));
}

export function defaultRepairOption(service: DraftService) {
  if (!isAirConditionerRepair(service)) return undefined;
  const options = service.options.filter((option) => option.optionType !== "add_on" && /\btreo tuong\b/.test(normalizeOptionName(option.name)));
  const exact = options.filter((option) => /^(?:(?:dieu hoa|may lanh) )?treo tuong$/.test(normalizeOptionName(option.name)));
  return exact.length === 1 ? exact[0] : options.length === 1 ? options[0] : undefined;
}

function resolveOptionPreference(preference: string, options: DraftService["options"]) {
  const parts = preference.split(/[\n;,]/).map((part) => part.trim()).filter(Boolean);
  const selected: DraftService["options"] = [];
  for (const part of parts) {
    const value = part.slice(part.indexOf(":") + 1).replace(/\s*[—–]\s*[\d.,]+\s*(?:đ|vnd)\s*$/i, "");
    const normalized = normalizeOptionName(value).replace(/^(?:toi (?:muon )?)?(?:chon|doi(?: loai)? sang|doi thanh)\s+/, "");
    if (!normalized) return [];
    const matches = options.filter((option) => normalizeOptionName(option.name) === normalized);
    if (matches.length !== 1) return [];
    if (!selected.some((option) => String(option._id) === String(matches[0]._id))) selected.push(matches[0]);
  }
  return selected;
}

export async function updateBookingDraft(previous: BookingDraft | undefined, input: BookingDraftPatch,
  userId: string, deps: BookingDraftDependencies, customerMessage?: string): Promise<BookingDraft> {
  if ((previous?.status === "booked" || previous?.orderId) && (!input.startNew || input.mode !== "update")) {
    throw new AppError("Bản nháp này đã tạo đơn. Chỉ bắt đầu đơn mới khi khách yêu cầu đặt thêm; không tạo lại đơn cũ.", 409);
  }
  if (input.mode === "pause" || input.mode === "discard") {
    if (!previous) throw new AppError("Chưa có bản nháp đặt lịch.", 400);
    return { ...previous, status: input.mode === "pause" ? "paused" : "discarded", revision: previous.revision + 1,
      ...(input.mode === "discard" ? { draftAddress: undefined } : {}) };
  }
  const draft: BookingDraft = !previous || input.startNew || previous.status === "discarded"
    ? { revision: 0, status: "active", values: {}, sources: {}, missing: [], summary: [], choiceGroups: [] }
    : JSON.parse(JSON.stringify(previous));
  draft.status = "active";
  draft.revision += 1;
  draft.missing = []; draft.summary = []; draft.choiceGroups = [];
  draft.lookupFailures = [];
  draft.availableVouchers = []; draft.providerCandidates = [];
  draft.voucherFeedback = undefined;
  const values = draft.values;
  const addressStorageRequest = customerMessage ? normalizeAddress(customerMessage) : "";
  const oneTimeAddress = /(?:khong|dung) (?:can )?luu dia chi|(?:khong|dung) (?:can )?luu (?:vao )?so dia chi|chi dung dia chi(?: nay)? (?:mot|1) lan|dia chi(?: nay)? (?:chi )?dung (?:mot|1) lan/.test(addressStorageRequest);
  if (oneTimeAddress) values.saveAddressToBook = false;
  else if (input.saveAddressToBook !== undefined) values.saveAddressToBook = input.saveAddressToBook;
  if (draft.draftAddress && ((input.addressId !== undefined && input.addressId !== draft.draftAddress.id)
    || input.addressPreference)) draft.draftAddress = undefined;
  if (input.selectedOptions !== undefined || input.quantity !== undefined || input.serviceId && input.serviceId !== values.serviceId) {
    draft.rebookNeedsOptionReview = undefined;
  }
  if (input.customerAttachments !== undefined) {
    values.customerAttachments = input.customerAttachments;
    draft.sources.customerAttachments = "customer";
  }
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
  for (const key of ["addressId", "orderType", "paymentMethod", "problemDescription", "preferredProviderId", "voucherCode"] as const) {
    if (input[key] === undefined) continue;
    if (input[key] === null) { delete values[key]; delete draft.sources[key]; }
    else Object.assign(values, { [key]: input[key] });
    if (input[key] !== null) draft.sources[key] = "customer";
  }
  if (input.voucherCode !== undefined) {
    draft.voucherDecision = input.voucherCode === null ? "declined" : "selected";
    if (input.voucherCode === null) draft.voucherFeedback = "Đã bỏ mã giảm giá. Xem số tiền mới bên dưới.";
    draft.voucherPreference = undefined;
    if (input.voucherCode) values.voucherCode = input.voucherCode.trim().toUpperCase();
  } else if (input.voucherPreference !== undefined) {
    draft.voucherPreference = input.voucherPreference || undefined;
    if (draft.voucherPreference) {
      delete values.voucherCode; delete draft.sources.voucherCode; draft.voucherDecision = undefined;
    }
  }
  if (input.providerPreference !== undefined) {
    draft.providerPreference = input.providerPreference || undefined;
    if (draft.providerPreference && !input.preferredProviderId) {
      delete values.preferredProviderId; delete draft.sources.preferredProviderId;
    }
  }
  if (input.preferredProviderId !== undefined) {
    draft.providerPreference = undefined; draft.providerCriteria = undefined;
  } else if (input.providerPreference) {
    draft.providerCriteria = undefined;
  } else if (input.providerCriteria !== undefined) {
    draft.providerCriteria = input.providerCriteria || undefined;
    if (draft.providerCriteria) {
      draft.providerPreference = undefined; delete values.preferredProviderId; delete draft.sources.preferredProviderId;
    }
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

  const [service, savedAddresses] = await Promise.all([
    values.serviceId ? deps.service(values.serviceId) : Promise.resolve(null), deps.addresses(userId),
  ]);
  const temporary = draft.draftAddress;
  const addresses = uniqueBookingAddresses([...savedAddresses,
    ...(temporary ? [{ ...temporary.payload, id: temporary.id }] : [])], values.addressId);
  if (values.addressId && !addresses.some((address) => address.id === values.addressId)) {
    delete values.addressId; delete draft.sources.addressId;
    draft.addressPreference = "Địa chỉ đã chọn không còn khả dụng";
  }
  if (!values.addressId && draft.addressPreference) {
    const requested = normalizeAddress(draft.addressPreference);
    const matches = addresses.filter((item) => [item.fullAddress, `${item.fullAddress}, ${item.ward}, ${item.province}`, bookingAddressChoice(item, addresses)]
      .some((text) => normalizeAddress(text) === requested));
    if (matches.length === 1) {
      values.addressId = matches[0].id; draft.sources.addressId = "customer"; draft.addressPreference = undefined;
    }
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
      options: addresses.slice(0, 12).map((address) => bookingAddressChoice(address, addresses))
    });
  }
  if (!service && !draft.missing.some((item) => item.includes("dịch vụ"))) draft.missing.push("Chọn dịch vụ cần đặt");
  if (service) {
    const repair = isAirConditionerRepair(service);
    const wall = defaultRepairOption(service);
    if (wall && customerMessage && isGeneralRepairBookingRequest(customerMessage)) {
      // Yêu cầu đặt chung dùng loại mặc định, không hỏi lại vì optionPreference do model tự thêm.
      if (!input.startNew && previous && previous.values.serviceId === values.serviceId && previous.values.selectedOptions?.length) {
        values.selectedOptions = previous.values.selectedOptions.map((option) => ({ ...option }));
        draft.sources.selectedOptions = previous.sources.selectedOptions;
      } else {
        delete values.selectedOptions; delete draft.sources.selectedOptions;
      }
      draft.optionPreference = undefined;
    }
    if (draft.optionPreference) {
      const matches = resolveOptionPreference(draft.optionPreference, service.options);
      if (matches.length) {
        const previous = values.selectedOptions ?? [];
        const replaces = (option: DraftService["options"][number], current: DraftService["options"][number]) => {
          const group = optionGroupKey(option);
          const single = option.selectionMode === "single"
            || service.optionGroups?.some((item) => String(item._id) === group && item.selectionMode === "single");
          return String(option._id) === String(current._id)
            || group === optionGroupKey(current) && (Boolean(group) && single
              || Boolean(repair && wall && group === optionGroupKey(wall) && option.optionType !== "add_on" && current.optionType !== "add_on"));
        };
        const retained = previous.filter((item) => {
          const current = service.options.find((option) => String(option._id) === item.optionId);
          return !current || !matches.some((option) => replaces(option, current));
        });
        values.selectedOptions = [...retained, ...matches.map((option) => {
          const replaced = previous.find((item) => {
            const current = service.options.find((candidate) => String(candidate._id) === item.optionId);
            return current && replaces(option, current);
          });
          return { optionId: String(option._id), quantity: option.allowsQuantity ? draft.requestedQuantity ?? replaced?.quantity ?? 1 : 1 };
        })];
        draft.sources.selectedOptions = "customer";
        draft.optionPreference = undefined;
      }
    }
    if (wall && !draft.optionPreference && !values.selectedOptions?.some((item) => service.options.some((option) =>
      String(option._id) === item.optionId && option.optionType !== "add_on" && optionGroupKey(option) === optionGroupKey(wall)))) {
      if (!values.selectedOptions?.length) draft.sources.selectedOptions = "default";
      values.selectedOptions = [...(values.selectedOptions ?? []), { optionId: String(wall._id), quantity: draft.requestedQuantity ?? 1 }];
    }
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
      const group = option.groupId ? String(option.groupId) : option.selectionGroup?.trim().toLowerCase() || "";
      groups.set(group, [...(groups.get(group) ?? []), option]);
    }
    for (const [group, options] of groups) {
      if (group && options.every((option) => option.selectionMode === "single")
        && options.filter((option) => ids.has(String(option._id))).length > 1) {
        throw new AppError(`Nhóm “${options[0].selectionGroup}” chỉ được chọn một tùy chọn.`, 400);
      }
    }
    const requiredGroups = service.optionGroups ?? [];
    const missingOptionGroups = new Set<string>();
    for (const group of requiredGroups) {
      const members = service.options.filter(option => String(option.groupId ?? "") === String(group._id));
      const count = members.filter(option => ids.has(String(option._id))).length;
      if (group.selectionMode === "single" && count > 1) throw new AppError(`Nhóm “${group.name}” chỉ được chọn một tùy chọn.`, 400);
      if (group.isRequired && count === 0) {
        missingOptionGroups.add(String(group._id));
        draft.missing.push(`Chọn tùy chọn trong nhóm “${group.name}”`);
        draft.choiceGroups.push({ label: `${group.name} · Bắt buộc`, multiple: group.selectionMode === "multiple",
          options: members.slice(0, 12).map(option => option.name) });
      }
    }
    if (draft.optionPreference || (requiredGroups.length === 0 && values.uniformQuantity === undefined && needsOptions && (!selected.length || (service.serviceType === "fixed_price"
      && !service.options.some((option) => ids.has(String(option._id)) && option.price > 0))))) {
      draft.missing.push(`Chọn gói hoặc loại dịch vụ${draft.optionPreference ? ` (${draft.optionPreference})` : ""}`);
      for (const [group, options] of groups) {
        if (missingOptionGroups.has(group)) continue;
        if (repair && wall && draft.optionPreference && /\b(?:loai|dieu hoa|may lanh|treo tuong|am tran|tu dung)\b/.test(normalizeOptionName(draft.optionPreference))
          && group !== optionGroupKey(wall)) continue;
        draft.choiceGroups.push({
          label: service.optionGroups?.find((item) => String(item._id) === group)?.name || options[0].selectionGroup || "Gói dịch vụ",
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
    const outsideHours = values.scheduledAt && !isWithinAppointmentHours(new Date(values.scheduledAt));
    if (!values.scheduledAt || Date.parse(values.scheduledAt) < getEarliestScheduledAt().getTime() || outsideHours) {
      // scheduledAt bị thiếu hoặc vẫn nằm trong quá khứ (sau khi đã thử auto-advance)
      if (values.scheduledAt) { delete values.scheduledAt; delete draft.sources.scheduledAt; }
      draft.missing.push(`Chọn ngày và giờ hẹn trong tương lai, từ 08:00 đến 21:00${draft.schedulePreference ? ` (${draft.schedulePreference})` : ""}`);
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
      draft.summary.push(`Giờ đã chọn đã qua, lịch được chuyển sang ${displayTime} (ngày mai). Bạn có thể đổi lại.`);
    }
  }
  const address = addresses.find((item) => item.id === values.addressId);
  if (address) draft.summary.push(`Địa chỉ: ${bookingAddressLabel(address)}`);
  if (values.saveAddressToBook === false) draft.summary.push("Địa chỉ chỉ dùng cho đơn này, không thêm vào sổ địa chỉ.");
  if (draft.rebookNeedsOptionReview) {
    draft.missing.push("Gói cũ đã thay đổi. Vui lòng chọn lại gói và số lượng trước khi đặt lại");
  }
  // Chỉ gợi ý sau khi giá/gói và lịch đã đủ rõ; không áp dụng mã hoặc đổi thợ thay khách.
  if (service && !draft.missing.length) {
    if (deps.providers && (values.preferredProviderId || draft.providerPreference || draft.providerCriteria || draft.draftAddress) && values.addressId) {
      const lookup = await deps.providers(userId, { ...bookingSchema.parse(values), providerQuery: draft.providerPreference }, draft.draftAddress)
        .then((result) => ({ result, failed: false })).catch(() => ({ result: { available: [], requested: [] }, failed: true }));
      if (lookup.failed) {
        draft.lookupFailures.push("providers");
        draft.missing.push("Tạm thời chưa thể kiểm tra thợ. Bạn có thể thử lại hoặc bỏ yêu cầu chọn thợ");
        draft.summary.push("Chưa kiểm tra được thợ đã chọn.");
        draft.choiceGroups.push({ label: "Kiểm tra chuyên gia", multiple: false, options: ["Kiểm tra lại thợ", "Để hệ thống tự tìm thợ"] });
      } else {
        const result = lookup.result;
        draft.providerCandidates = [...result.available, ...result.requested.filter((item) => item.eligible)]
          .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
        let chosen: { id: string; name: string } | undefined = result.requested.find((item) => item.id === values.preferredProviderId && item.eligible)
          ?? (draft.providerPreference && result.requested.length === 1 && result.requested[0].eligible ? result.requested[0] : undefined);
        if (!values.preferredProviderId && !draft.providerPreference && draft.providerCriteria && draft.providerCriteria !== "choose") {
          const fields = { nearest: "distanceMeters", highest_rating: "averageRating", most_completed: "totalCompletedOrders" } as const;
          const field = fields[draft.providerCriteria];
          const ranked = result.available.filter((item) => Number.isFinite(item[field])
            && Number(item[field]) >= (field === "distanceMeters" ? 0 : 1))
            .sort((a, b) => draft.providerCriteria === "nearest" ? Number(a[field]) - Number(b[field]) : Number(b[field]) - Number(a[field]));
          chosen = ranked[0];
          if (chosen) draft.summary.push(`Tiêu chí chọn thợ: ${{ nearest: "gần nhất theo khoảng cách hiện có", highest_rating: "đánh giá cao nhất", most_completed: "nhiều đơn hoàn thành nhất" }[draft.providerCriteria]} trong danh sách đang phù hợp.`);
          else if (result.available.length) draft.summary.push("Chưa đủ dữ liệu để chọn theo tiêu chí này. Bạn có thể chọn trực tiếp từ danh sách.");
        }
        if (chosen) {
          values.preferredProviderId = chosen.id; draft.sources.preferredProviderId = "customer";
          draft.providerPreference = undefined;
          draft.summary.push(`Chuyên gia ưu tiên: ${chosen.name}`);
        }
        else if (values.preferredProviderId || draft.providerPreference || draft.providerCriteria) {
          draft.missing.push("Chọn chuyên gia phù hợp hoặc để hệ thống tự tìm");
          draft.summary.push(...result.requested.filter((item) => !item.eligible).map((item) => `${item.name}: ${item.reason}`));
          if (draft.providerPreference && !result.requested.length) draft.summary.push(`Chưa tìm thấy chuyên gia “${draft.providerPreference}”.`);
          if (values.preferredProviderId && !result.requested.length) draft.summary.push("Thợ đã chọn hiện không khả dụng. Bạn có thể đổi thợ hoặc lịch hẹn.");
          if (!draft.providerCandidates.length) draft.summary.push("Chưa có thợ phù hợp. Bạn có thể đổi lịch hoặc địa chỉ.");
          draft.choiceGroups.push({ label: "Chuyên gia đang phù hợp", multiple: false,
            options: [...draft.providerCandidates.slice(0, 10).map((item) => {
              const details = [item.averageRating && item.averageRating > 0 ? `${item.averageRating.toLocaleString("vi-VN")} sao` : "",
                item.totalCompletedOrders !== undefined ? `${item.totalCompletedOrders.toLocaleString("vi-VN")} đơn hoàn thành` : "",
                item.distanceMeters !== undefined && item.distanceMeters >= 0 ? `${(item.distanceMeters / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km` : ""].filter(Boolean);
              return `${item.name} (${item.id.slice(-6)})${details.length ? ` — ${details.join("; ")}` : ""}`;
            }), "Để hệ thống tự tìm thợ"] });
        }
      }
    } else if (!deps.providers && (values.preferredProviderId || draft.providerPreference || draft.providerCriteria)) {
      draft.missing.push("Chưa thể kiểm tra chuyên gia đã yêu cầu. Vui lòng thử lại hoặc chọn để hệ thống tự tìm thợ");
    }
    const canCheckVouchers = !draft.missing.length;
    if (canCheckVouchers && deps.vouchers && draft.voucherDecision !== "declined") {
      const lookup = await deps.vouchers(userId, bookingSchema.parse(values))
        .then((vouchers) => ({ vouchers, failed: false })).catch(() => ({ vouchers: [], failed: true }));
      if (lookup.failed) {
        draft.lookupFailures.push("vouchers");
        if (values.voucherCode || draft.voucherPreference) {
          draft.missing.push("Tạm thời chưa thể kiểm tra voucher. Bạn có thể thử lại hoặc chọn không dùng voucher");
        }
        draft.voucherFeedback = "Tạm thời chưa thể kiểm tra voucher. Bạn có thể thử lại hoặc chọn không dùng voucher.";
        draft.summary.push("Chưa xác nhận được mức giảm giá.");
        draft.choiceGroups.push({ label: "Kiểm tra voucher", multiple: false, options: ["Kiểm tra lại voucher", "Không dùng voucher"] });
      } else {
        draft.availableVouchers = lookup.vouchers;
        if (draft.voucherPreference === "best") {
          const best = [...draft.availableVouchers].sort((a, b) => b.discountAmount - a.discountAmount
            || (Date.parse(a.endAt || "") || Infinity) - (Date.parse(b.endAt || "") || Infinity)
            || a.code.localeCompare(b.code))[0];
          if (best) {
            values.voucherCode = best.code; draft.sources.voucherCode = "customer"; draft.voucherDecision = "selected";
            draft.summary.push("Đã chọn mã giảm nhiều nhất cho bạn.");
          } else {
            delete values.voucherCode; delete draft.sources.voucherCode; draft.voucherDecision = undefined;
            draft.voucherFeedback = "Hiện chưa có mã giảm giá phù hợp với đơn này. Bạn có thể tiếp tục đặt với giá chưa giảm.";
          }
        }
        const selected = draft.availableVouchers.find((voucher) => voucher.code === values.voucherCode);
        if (values.voucherCode && !selected) {
          draft.missing.push("Voucher đã chọn không còn phù hợp; chọn mã khác hoặc không dùng voucher");
        } else if (selected) {
          draft.summary.push(`Voucher ${selected.code}: giảm ${selected.discountAmount.toLocaleString("vi-VN")} đ; còn ${selected.finalAmount.toLocaleString("vi-VN")} đ.`);
        }
        if ((!draft.voucherDecision && draft.availableVouchers.length) || (values.voucherCode && !selected)) {
          if (!draft.voucherDecision) {
            draft.voucherFeedback = `Có ${draft.availableVouchers.length} mã giảm giá dùng được cho đơn này. Bạn có thể chọn mã bên dưới trước khi xác nhận.`;
          }
          draft.choiceGroups.push({ label: "Voucher có thể sử dụng", multiple: false,
            options: [...draft.availableVouchers.slice(0, 10).map((voucher) => `${voucher.code} — giảm ${voucher.discountAmount.toLocaleString("vi-VN")} đ`), "Không dùng voucher"] });
        }
        if ((draft.voucherPreference && !draft.availableVouchers.length) || (values.voucherCode && !selected)) {
          try {
            draft.voucherFeedback = deps.voucherFeedback ? await deps.voucherFeedback(userId, bookingSchema.parse(values))
              : values.voucherCode ? "Mã giảm giá này chưa dùng được cho đơn hiện tại. Bạn có thể chọn mã khác hoặc không dùng mã."
                : "Hiện bạn chưa có mã giảm giá phù hợp với đơn này. Bạn có thể tiếp tục đặt với giá chưa giảm.";
          } catch {
            draft.lookupFailures.push("vouchers");
            draft.voucherFeedback = "Tạm thời chưa thể kiểm tra điều kiện mã giảm giá. Vui lòng thử lại hoặc chọn không dùng mã.";
            draft.missing.push("Kiểm tra lại điều kiện mã giảm giá");
          }
        }
      }
    } else if (canCheckVouchers && (values.voucherCode || draft.voucherPreference)) {
      draft.missing.push("Chưa thể kiểm tra voucher. Vui lòng thử lại hoặc chọn không dùng voucher");
    }
  }
  draft.summary.push(`Thời gian: ${values.orderType === "normal" ? "Đặt ngay" : values.scheduledAt ? new Date(values.scheduledAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : draft.schedulePreference || "Chưa chọn"}`);
  draft.summary.push(`Thanh toán: ${{ bank: "Chuyển khoản", wallet: "Ví Handigo", cash: "Tiền mặt" }[values.paymentMethod]}`);
  if (values.customerAttachments?.length) draft.summary.push(`Ảnh hiện trạng: ${values.customerAttachments.length} ảnh sẽ được gửi kèm đơn.`);
  draft.choiceGroups = draft.choiceGroups.slice(0, 6);
  return draft;
}

export function readyBookingArguments(draft: BookingDraft) {
  if (draft.status !== "active" || draft.missing.length || draft.rebookNeedsOptionReview) return null;
  return bookingSchema.parse(draft.values);
}
