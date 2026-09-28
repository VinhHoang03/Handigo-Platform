import { z } from "zod";
import { ToolRegistry } from "../../ai/tools/tool-registry";
import { createUpdateBookingDraftTool } from "../../ai/tools/implementations/update-booking-draft.tool";
import { bookingSchema, idSchema } from "../../ai/tools/implementations/booking.schemas";
import type { BookingDraftDependencies, DraftService, DraftAddress } from "../../ai/agent/booking-draft";

export const bookingFixtureIds = { service: "111111111111111111111111", other: "222222222222222222222222",
  small: "333333333333333333333333", large: "444444444444444444444444", single: "555555555555555555555555",
  home: "666666666666666666666666", office: "777777777777777777777777", order: "888888888888888888888888" };
const ids = bookingFixtureIds;
export function bookingFixture() {
  const services: DraftService[] = [
    { id: ids.service, name: "Vệ sinh nhà", serviceType: "fixed_price", requiresOptionSelection: true, options: [
      { _id: ids.small, name: "Nhà dưới 50 m²", price: 200000, optionType: "area_size", allowsQuantity: false, selectionGroup: "Diện tích", selectionMode: "single" },
      { _id: ids.large, name: "Nhà từ 50 đến 100 m²", price: 350000, optionType: "area_size", allowsQuantity: false, selectionGroup: "Diện tích", selectionMode: "single" },
    ] },
    { id: ids.other, name: "Vệ sinh máy lạnh", serviceType: "fixed_price", requiresOptionSelection: true, options: [
      { _id: ids.single, name: "Máy treo tường", price: 150000, optionType: "other", allowsQuantity: true, selectionMode: "multiple" },
    ] },
  ];
  const addresses: DraftAddress[] = [
    { id: ids.home, fullAddress: "10 Đường Mẫu", ward: "Phường Mẫu", province: "TP. Hồ Chí Minh", isDefault: true },
    { id: ids.office, fullAddress: "20 Đường Mẫu", ward: "Phường Mẫu", province: "TP. Hồ Chí Minh", isDefault: false },
  ];
  const deps: BookingDraftDependencies = {
    search: async (query) => services.filter((service) => service.name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi"))),
    service: async (id) => { const service = services.find((item) => item.id === id); if (!service) throw new Error("Không có dịch vụ thử nghiệm."); return service; },
    addresses: async () => addresses,
  };
  let writes = 0;
  const registry = new ToolRegistry().register(createUpdateBookingDraftTool(deps))
    .register({ name: "search_services", description: "Tìm dịch vụ theo từ khóa.", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
      inputSchema: z.object({ search: z.string() }), execute: (_ctx, args) => deps.search(args.search) })
    .register({ name: "get_service", description: "Lấy dịch vụ và tùy chọn cùng địa chỉ đã lưu.", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
      inputSchema: z.object({ serviceId: idSchema }), execute: async (_ctx, args) => ({ ...await deps.service(args.serviceId), addresses }) })
    .register({ name: "get_addresses", description: "Đọc địa chỉ đã lưu.", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
      inputSchema: z.object({}), execute: async () => addresses })
    .register({ name: "get_service_catalog", description: "Xem danh mục dịch vụ.", roles: ["CUSTOMER"], mutates: false, requiresConfirmation: false,
      inputSchema: z.object({}), execute: async () => ({ total: services.length, services }) })
    .register({ name: "create_booking", description: "Tạo đơn sau xác nhận.", roles: ["CUSTOMER"], mutates: true, requiresConfirmation: true,
      inputSchema: bookingSchema,
      preview: async (_ctx, args) => ({ ...args, title: "Đặt dịch vụ thử nghiệm", amount: 200000, addressVersion: "phiên-bản-thử" }),
      execute: async () => { writes += 1; return { orderId: ids.order }; },
    });
  return { deps, services, addresses, registry, writes: () => writes };
}
