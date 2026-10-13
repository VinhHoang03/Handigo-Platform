import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { Address } from "../models/address.model";
import User from "../models/user.model";
import { createAddress, updateAddress, getUserAddresses } from "./address.service";
import { geocodeSavedAddress } from "./reverseGeocoding.service";
import { createAddressSchema } from "../validations/address.validator";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { idSchema } from "../ai/tools/implementations/booking.schemas";

// Tọa độ và mã hành chính chỉ lấy từ hệ thống, không nhận từ LLM.
const addressFields = createAddressSchema.pick({ recipientName: true, recipientPhone: true,
  fullAddress: true, province: true, ward: true, note: true, isDefault: true });
export const agentAddressSchema = addressFields.partial().extend({
  addressId: idSchema.optional(), useForBooking: z.boolean().default(true),
}).strict().refine((args) => !args.addressId || Object.keys(args).some((key) => !["addressId", "useForBooking"].includes(key)),
  { message: "Vui lòng cung cấp thông tin địa chỉ cần sửa." });
export type AgentAddressArguments = z.infer<typeof agentAddressSchema>;
const normalize = (value: string) => value.trim().toLocaleLowerCase("vi-VN").replace(/\s+/g, " ");

export const AgentAddressService = {
  async preview(userId: string, args: AgentAddressArguments) {
    const [addresses, user] = await Promise.all([getUserAddresses(userId), User.findById(userId).select("fullName phone").lean()]);
    const current = args.addressId ? addresses.find((item) => String(item._id) === args.addressId) : undefined;
    if (args.addressId && !current) throw new AppError("Không tìm thấy địa chỉ thuộc tài khoản của bạn.", 404);
    const { addressId: _addressId, useForBooking: _useForBooking, ...changes } = args;
    let payload = addressFields.parse({
      recipientName: current?.recipientName || user?.fullName || "",
      recipientPhone: current?.recipientPhone || user?.phone || "",
      ...(current ? { fullAddress: current.fullAddress, province: current.province, ward: current.ward,
        note: current.note, isDefault: current.isDefault } : { isDefault: false }),
      ...changes,
    });
    const duplicate = addresses.find((item) => ["fullAddress", "province", "ward"].every((key) =>
      normalize(item[key as "fullAddress" | "province" | "ward"]) === normalize(payload[key as "fullAddress" | "province" | "ward"])));
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
      ? { latitude: current.latitude!, longitude: current.longitude! } : await geocodeSavedAddress(payload);
    const coordinates = resolved ? { latitude: resolved.latitude, longitude: resolved.longitude } : {};
    return { title: current ? "Sửa địa chỉ trong sổ địa chỉ" : existing ? "Dùng địa chỉ đã có" : "Thêm địa chỉ vào sổ địa chỉ",
      address: `${payload.fullAddress}, ${payload.ward}, ${payload.province}`,
      previousAddress: current ? `${current.fullAddress}, ${current.ward}, ${current.province}` : undefined,
      recipientName: payload.recipientName, recipientPhone: payload.recipientPhone,
      defaultAddress: payload.isDefault ? "Có" : "Không", addressNote: payload.note,
      note: args.useForBooking ? "Sau xác nhận, dùng địa chỉ này cho bản nháp đang đặt. Chưa tạo đơn hoặc thanh toán."
        : "Sau xác nhận, lưu thông tin vào sổ địa chỉ của bạn.",
      payload, coordinates, addressVersion: current?.updatedAt.toISOString(),
      existingId: existing ? String(existing._id) : undefined,
    };
  },
  async save(userId: string, args: AgentAddressArguments, confirmed: unknown) {
    const preview = await this.preview(userId, args);
    if (!isDeepStrictEqual(JSON.parse(JSON.stringify(preview)), confirmed)) throw new ActionPreconditionError();
    const payload = { ...preview.payload, ...preview.coordinates };
    const address = preview.existingId
      ? await Address.findOne({ _id: preview.existingId, userId })
      : args.addressId ? await updateAddress(args.addressId, userId, payload, preview.addressVersion)
        : await createAddress(userId, payload);
    if (!address) throw new ActionPreconditionError();
    return { addressId: String(address._id), fullAddress: address.fullAddress, ward: address.ward, province: address.province,
      reused: Boolean(preview.existingId), message: preview.existingId ? "Đã chọn địa chỉ có sẵn." : "Đã lưu địa chỉ vào sổ địa chỉ." };
  },
};
