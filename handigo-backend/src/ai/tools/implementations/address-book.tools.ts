import { z } from "zod";
import type { AgentTool } from "../tool.interface";
import { idSchema } from "./booking.schemas";
import { AgentAddressBookService as book } from "../../../services/agentAddressBook.service";

const schema = z.object({ addressId: idSchema }).strict();
function addressTool(deleting: boolean): AgentTool<z.infer<typeof schema>> {
  return { name: deleting ? "delete_saved_address" : "set_default_address",
    description: deleting ? "Xóa đúng địa chỉ thuộc khách khỏi sổ sau xác nhận. Lấy ID từ get_addresses, hỏi lại nếu trùng tên. Không xóa địa chỉ đang dùng trong bản nháp; không thay đổi đơn đã tạo."
      : "Đặt đúng địa chỉ thuộc khách làm mặc định sau xác nhận. Lấy ID từ get_addresses; không tự đổi địa chỉ đã chọn trong bản nháp hoặc đơn đã tạo.",
    inputSchema: schema, roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
    preview: (ctx, args) => book.preview(ctx.user.id, args.addressId, deleting, ctx.session),
    execute: async (ctx, args) => {
      const result = await book.apply(ctx.user.id, args.addressId, deleting, ctx.confirmedPreview, ctx.session);
      if (ctx.bookingAddressLookup) ctx.bookingAddressLookup.value = undefined;
      return result;
    },
    reconcile: (ctx, args) => book.reconcile(ctx.user.id, args.addressId, deleting, ctx.actionCreatedAt),
    reply: (value) => ({ state: "COMPLETED", message: (value as { message: string }).message }),
  };
}
export const deleteSavedAddressTool = addressTool(true);
export const setDefaultAddressTool = addressTool(false);
