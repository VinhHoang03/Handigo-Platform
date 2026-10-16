import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { Address } from "../models/address.model";
import User from "../models/user.model";
import { createAddress, updateAddress, getUserAddresses } from "./address.service";
import { geocodeSavedAddress } from "./reverseGeocoding.service";
import { resolveAgentAddress, normalizeAgentAdministrativeName, AGENT_AREA_LOCATION_NOTE, AGENT_AREA_PLACE_PREFIX, AGENT_UNLOCATED_NOTE } from "./agentAddressResolver.service";
import { bookingAddressLabel } from "../ai/agent/booking-draft";
import { createAddressSchema } from "../validations/address.validator";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { idSchema } from "../ai/tools/implementations/booking.schemas";
import { Types } from "mongoose";
import type { IAddress } from "../models/address.model";

// Tọa độ và mã hành chính chỉ lấy từ hệ thống, không nhận từ LLM.
const addressFields = createAddressSchema.pick({ recipientName: true, recipientPhone: true,
  fullAddress: true, province: true, ward: true, note: true, isDefault: true });
export const agentAddressSchema = addressFields.partial().extend({
  addressText: z.string().trim().min(1, "Vui lòng nhập địa chỉ cần thêm.").max(500, "Địa chỉ tối đa 500 ký tự.").optional(),
  fullAddress: z.string().trim().min(1, "Vui lòng nhập địa chỉ cần thêm.").max(500, "Địa chỉ tối đa 500 ký tự.").optional(),
  addressId: idSchema.optional(), useForBooking: z.boolean().default(true),
}).strict().refine((args) => !args.addressId || Object.keys(args).some((key) => !["addressId", "useForBooking"].includes(key)),
  { message: "Vui lòng cung cấp thông tin địa chỉ cần sửa." });
export type AgentAddressArguments = z.infer<typeof agentAddressSchema>;
export interface DraftBookingAddress {
  id: string;
  userId: string;
  preparedAt: string;
  payload: Pick<IAddress, "fullAddress" | "province" | "ward" | "provinceCode" | "wardCode" | "recipientName" | "recipientPhone"
    | "note" | "isDefault" | "latitude" | "longitude" | "placeId">;
}

export function draftAddressDocument(userId: string, addressId: string, draft?: DraftBookingAddress) {
  if (!draft || draft.id !== addressId) return undefined;
  if (draft.userId !== userId) throw new AppError("Địa chỉ không thuộc phiên đặt dịch vụ của bạn.", 403);
  return new Address({ ...draft.payload, _id: draft.id, userId,
    createdAt: new Date(draft.preparedAt), updatedAt: new Date(draft.preparedAt) });
}
const normalize = (value: string) => value.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");

export const AgentAddressService = {
  async stage(userId: string, args: AgentAddressArguments) {
    if (args.addressId || !args.useForBooking) throw new AppError("Chỉ địa chỉ mới dùng cho bản nháp được giữ tạm.", 400);
    const preview = await this.preview(userId, args);
    if (preview.existingId) return { addressId: preview.existingId, draftAddress: undefined };
    const draftAddress: DraftBookingAddress = { id: new Types.ObjectId().toString(), userId, preparedAt: new Date().toISOString(),
      payload: { ...preview.payload, ...preview.coordinates, isDefault: preview.payload.isDefault ?? false } };
    return { addressId: draftAddress.id, draftAddress };
  },
  async preview(userId: string, args: AgentAddressArguments) {
    const [addresses, user] = await Promise.all([getUserAddresses(userId), User.findById(userId).select("fullName phone").lean()]);
    const current = args.addressId ? addresses.find((item) => String(item._id) === args.addressId) : undefined;
    if (args.addressId && !current) throw new AppError("Không tìm thấy địa chỉ thuộc tài khoản của bạn.", 404);
    const { addressId: _addressId, useForBooking: _useForBooking, addressText: _addressText, ...changes } = args;
    const naturalAddress = args.addressText ?? (args.fullAddress && /[,;\n]/.test(args.fullAddress) ? args.fullAddress : undefined);
    const locationChanged = !current || args.addressText !== undefined || (["fullAddress", "ward", "province"] as const)
      .some((key) => args[key] !== undefined && normalize(args[key]!) !== normalize(current[key]))
      || current.placeId?.startsWith(AGENT_AREA_PLACE_PREFIX) && (!Number.isFinite(current.latitude) || !Number.isFinite(current.longitude));
    const location = locationChanged ? await resolveAgentAddress({
      addressText: naturalAddress, fullAddress: args.fullAddress ?? (naturalAddress ? undefined : current?.fullAddress),
      province: args.province ?? (naturalAddress ? undefined : current?.province),
      ward: args.ward ?? (naturalAddress ? undefined : current?.ward),
    }) : undefined;
    let payload = addressFields.parse({
      recipientName: current?.recipientName || user?.fullName || "",
      recipientPhone: current?.recipientPhone || user?.phone || "",
      ...(current ? { fullAddress: current.fullAddress, province: current.province, ward: current.ward,
        note: current.note, isDefault: current.isDefault } : { isDefault: false }),
      ...changes,
      ...(location ? { fullAddress: location.fullAddress, province: location.province, ward: location.ward } : {}),
    });
    const administrativeName = normalizeAgentAdministrativeName;
    const addressLine = (value: { fullAddress: string; ward: string; province: string }) => normalize(value.fullAddress
      .split(/[,;\n]/).filter((part) => ![administrativeName(value.ward), administrativeName(value.province)]
        .includes(administrativeName(part))).map((part) => part.trim()).filter(Boolean).join(", "));
    const duplicate = addresses.find((item) => ["fullAddress", "province", "ward"].every((key) =>
      key === "fullAddress" ? addressLine(item) === addressLine(payload)
        : administrativeName(item[key as "province" | "ward"]) === administrativeName(payload[key as "province" | "ward"])));
    if (current && duplicate && String(duplicate._id) !== String(current._id)) {
      throw new AppError("Địa chỉ này đã có trong sổ địa chỉ. Hãy chọn địa chỉ đó thay vì sửa thành địa chỉ trùng.", 409);
    }
    const existing = !current ? duplicate : undefined;
    if (existing) {
      if ((args.recipientName && args.recipientName !== existing.recipientName)
        || (args.recipientPhone && args.recipientPhone !== existing.recipientPhone)
        || args.isDefault === true || args.note !== undefined) {
        throw new AppError("Địa chỉ đã tồn tại. Nếu muốn đổi thông tin người nhận hoặc ghi chú, hãy yêu cầu sửa địa chỉ có sẵn.", 409);
      }
      payload = addressFields.parse({ ...payload, recipientName: existing.recipientName,
        recipientPhone: existing.recipientPhone, isDefault: existing.isDefault, note: existing.note });
    }
    const sameLocation = current && ["fullAddress", "province", "ward"].every((key) =>
      normalize(current[key as "fullAddress" | "province" | "ward"]) === normalize(payload[key as "fullAddress" | "province" | "ward"]));
    const resolved = existing ? undefined : sameLocation && Number.isFinite(current.latitude) && Number.isFinite(current.longitude)
      ? { latitude: current.latitude!, longitude: current.longitude!, placeId: current.placeId } : location ?? await geocodeSavedAddress(payload);
    const coordinates: { latitude?: number; longitude?: number; placeId?: string } = resolved ? { latitude: resolved.latitude, longitude: resolved.longitude,
      ...(resolved.placeId ? { placeId: resolved.placeId } : {}) } : {};
    const approximate = (existing?.placeId ?? resolved?.placeId)?.startsWith(AGENT_AREA_PLACE_PREFIX);
    const located = existing ? Number.isFinite(existing.latitude) && Number.isFinite(existing.longitude)
      : Number.isFinite(resolved?.latitude) && Number.isFinite(resolved?.longitude);
    const addressLabel = (address: { fullAddress: string; ward: string; province: string }) => bookingAddressLabel({ ...address, id: "", isDefault: false });
    return { title: current ? "Sửa địa chỉ trong sổ địa chỉ" : existing ? "Dùng địa chỉ đã có" : "Thêm địa chỉ vào sổ địa chỉ",
      address: addressLabel(payload),
      previousAddress: current ? addressLabel(current) : undefined,
      recipientName: payload.recipientName, recipientPhone: payload.recipientPhone,
      defaultAddress: payload.isDefault ? "Có" : "Không", addressNote: payload.note,
      note: [args.useForBooking ? "Sau xác nhận, dùng địa chỉ này cho bản nháp đang đặt. Chưa tạo đơn hoặc thanh toán."
        : "Sau xác nhận, lưu thông tin vào sổ địa chỉ của bạn.", approximate ? located ? AGENT_AREA_LOCATION_NOTE : AGENT_UNLOCATED_NOTE : ""].filter(Boolean).join(" "),
      payload: { ...payload, ...(location ? { provinceCode: location.provinceCode, wardCode: location.wardCode }
        : current?.provinceCode && current.wardCode ? { provinceCode: current.provinceCode, wardCode: current.wardCode } : {}) },
      coordinates, addressVersion: current?.updatedAt.toISOString(),
      existingId: existing ? String(existing._id) : undefined,
    };
  },
  async save(userId: string, args: AgentAddressArguments, confirmed: unknown) {
    const preview = await this.preview(userId, args);
    if (!isDeepStrictEqual(JSON.parse(JSON.stringify(preview)), confirmed)) throw new ActionPreconditionError();
    const payload = { ...preview.payload, ...preview.coordinates };
    const options = { allowUnlocated: !Number.isFinite(payload.latitude) && !Number.isFinite(payload.longitude)
      && payload.placeId?.startsWith(AGENT_AREA_PLACE_PREFIX) };
    const address = preview.existingId
      ? await Address.findOne({ _id: preview.existingId, userId })
      : args.addressId ? await updateAddress(args.addressId, userId, payload, preview.addressVersion, options)
        : await createAddress(userId, payload, options);
    if (!address) throw new ActionPreconditionError();
    return { addressId: String(address._id), fullAddress: address.fullAddress, ward: address.ward, province: address.province,
      reused: Boolean(preview.existingId), message: preview.existingId ? "Đã chọn địa chỉ có sẵn." : "Đã lưu địa chỉ vào sổ địa chỉ." };
  },
};
