import { z } from "zod";
import { Address } from "../models/address.model";
import { deleteAddress, setDefaultAddress } from "./address.service";
import { AppError } from "../utils/appError";
import { ActionPreconditionError } from "../utils/actionPreconditionError";
import { idSchema } from "../ai/tools/implementations/booking.schemas";
import type { AgentSession } from "../ai/agent/agent-state";

const expectedSchema = z.object({ addressId: idSchema, addressVersion: z.string().datetime() });
const result = (addressId: string, deleting: boolean) => ({ addressId, path: "/customer/profile",
  message: deleting ? "Đã xóa địa chỉ khỏi sổ; không thay đổi địa chỉ của các đơn đã tạo." : "Đã đặt địa chỉ mặc định; không đổi địa chỉ bản nháp hoặc đơn đã tạo." });
export const AgentAddressBookService = {
  async preview(userId: string, addressId: string, deleting: boolean, session?: AgentSession) {
    if (deleting && session?.bookingDraft && ["active", "paused"].includes(session.bookingDraft.status)
      && session.bookingDraft.values.addressId === addressId) throw new AppError("Địa chỉ đang dùng trong bản nháp. Hãy chọn địa chỉ khác hoặc bỏ bản nháp trước khi xóa.", 409);
    const address = await Address.findOne({ _id: addressId, userId, isDeleted: { $ne: true } }).lean();
    if (!address) throw new AppError("Không tìm thấy địa chỉ thuộc tài khoản của bạn.", 404);
    if (!deleting && address.isDefault) throw new AppError("Địa chỉ này đã là địa chỉ mặc định.", 409);
    return { title: deleting ? "Xóa địa chỉ đã lưu" : "Đặt địa chỉ mặc định", addressId, addressVersion: address.updatedAt.toISOString(),
      address: [address.fullAddress, address.ward, address.province].filter(Boolean).join(", "),
      recipientName: address.recipientName, recipientPhone: address.recipientPhone,
      note: deleting ? "Xóa khỏi sổ địa chỉ; không xóa đơn hoặc thay đổi địa chỉ trên đơn đã tạo. Xóa địa chỉ mặc định không tự chọn mục khác."
        : "Chỉ đổi mặc định trong sổ; giữ địa chỉ khách đã chọn trong bản nháp và đơn đã tạo." };
  },
  async apply(userId: string, addressId: string, deleting: boolean, expected: unknown, session?: AgentSession) {
    const preview = expectedSchema.parse(expected);
    if (preview.addressId !== addressId) throw new ActionPreconditionError();
    await this.preview(userId, addressId, deleting, session);
    if (deleting) await deleteAddress(addressId, userId, preview.addressVersion);
    else await setDefaultAddress(userId, addressId, preview.addressVersion);
    return result(addressId, deleting);
  },
  async reconcile(userId: string, addressId: string, deleting: boolean, startedAt?: string) {
    if (!Number.isFinite(Date.parse(startedAt ?? ""))) return null;
    const address = await Address.findOne({ _id: addressId, userId }).lean();
    if (!address) return null;
    const timestamp = deleting ? address.deletedAt : address.updatedAt;
    return (deleting ? address.isDeleted : !address.isDeleted && address.isDefault)
      && timestamp && timestamp.getTime() >= Date.parse(startedAt!) ? result(addressId, deleting) : null;
  },
};
