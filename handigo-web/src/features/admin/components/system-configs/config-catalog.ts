import type { SystemConfigType } from "../../types/systemConfig.types";
import type { ConfigDefinition, ConfigGroupKey } from "./config-types";

export const groupOptions: Array<{
  key: ConfigGroupKey | "all";
  label: string;
  icon: string;
}> = [
  { key: "all", label: "Tất cả cấu hình", icon: "dashboard" },
  { key: "operation", label: "Vận hành", icon: "admin_panel_settings" },
  { key: "booking", label: "Đơn hàng", icon: "assignment" },
  { key: "payment", label: "Thanh toán và ví", icon: "account_balance_wallet" },
  { key: "display", label: "Hiển thị công khai", icon: "public" },
  { key: "notification", label: "Thông báo", icon: "notifications" },
];

export const configDefinitions: ConfigDefinition[] = [
  {
    key: "PLATFORM_FEE_PERCENT",
    label: "Phí nền tảng",
    group: "payment",
    type: "NUMBER",
    defaultValue: 15,
    unit: "%",
    isPublic: false,
    description: "Tỷ lệ phí nền tảng áp dụng khi tạo đơn dịch vụ giá cố định.",
    effect:
      "Có hiệu lực khi khách tạo đơn mới. Đơn đã tạo trước đó giữ snapshot phí cũ.",
    isEffective: true,
  },
  {
    key: "PROVIDER_MINIMUM_WALLET_BALANCE",
    label: "Số dư tối thiểu để nhận đơn",
    group: "payment",
    type: "NUMBER",
    defaultValue: 100_000,
    unit: "VNĐ",
    isPublic: false,
    description:
      "Số dư ví tối thiểu provider phải duy trì để được điều phối và nhận đơn mới.",
    effect:
      "Có hiệu lực khi hệ thống chọn provider và khi provider xác nhận nhận đơn.",
    isEffective: true,
  },
  {
    key: "QUOTATION_SERVICE_DEPOSIT_AMOUNT",
    label: "Tiền cọc dịch vụ báo giá",
    group: "payment",
    type: "NUMBER",
    defaultValue: 0,
    unit: "VNĐ",
    isPublic: false,
    description:
      "Số tiền cọc khách cần thanh toán trước với dịch vụ linh hoạt cần báo giá.",
    effect:
      "Có hiệu lực khi khách tạo đơn báo giá mới. Nếu chưa lưu cấu hình này, hệ thống dùng tiền cọc đang cấu hình ở dịch vụ.",
    isEffective: true,
  },
  {
    key: "MATCHING_PROVIDER_TIMEOUT_SECONDS",
    label: "Thời gian chờ provider nhận đơn",
    group: "booking",
    type: "NUMBER",
    defaultValue: 60,
    unit: "giây",
    isPublic: false,
    description:
      "Số giây hệ thống chờ nhóm provider hiện tại phản hồi trước khi mở nhóm tiếp theo.",
    effect: "Có hiệu lực với các nhóm phân phối mới sau khi lưu.",
    isEffective: true,
  },
  {
    key: "MATCHING_BATCH_SIZE",
    label: "Số provider nhận đơn cùng lúc",
    group: "booking",
    type: "NUMBER",
    defaultValue: 3,
    unit: "provider",
    isPublic: false,
    description:
      "Số provider phù hợp nhận cùng một lượt đề nghị; người xác nhận hợp lệ đầu tiên sẽ được nhận đơn.",
    effect: "Nên đặt từ 3 đến 5 để cân bằng tốc độ, công bằng và số lượng thông báo.",
    isEffective: true,
  },
  {
    key: "MAX_MATCHING_ATTEMPTS",
    label: "Số lần thử tìm provider tối đa",
    group: "booking",
    type: "NUMBER",
    defaultValue: 5,
    unit: "lần",
    isPublic: false,
    description:
      "Tổng số provider tối đa hệ thống sẽ mời qua tất cả các nhóm trước khi hủy đơn.",
    effect: "Có hiệu lực với các lượt matching mới sau khi lưu.",
    isEffective: true,
  },
  {
    key: "MAX_PROVIDER_RADIUS_KM",
    label: "Bán kính tìm provider tối đa",
    group: "booking",
    type: "NUMBER",
    defaultValue: 20,
    unit: "km",
    isPublic: false,
    description:
      "Bán kính tối đa quanh địa chỉ khách hàng để tìm provider đang online và phù hợp dịch vụ.",
    effect: "Có hiệu lực với các lượt tìm provider mới sau khi lưu.",
    isEffective: true,
  },
  {
    key: "MIN_WITHDRAW_AMOUNT",
    label: "Số tiền rút tối thiểu",
    group: "payment",
    type: "NUMBER",
    defaultValue: 0,
    unit: "VNĐ",
    isPublic: false,
    description:
      "Số tiền tối thiểu provider được phép tạo trong một yêu cầu rút tiền.",
    effect: "Có hiệu lực khi provider tạo yêu cầu rút tiền mới.",
    isEffective: true,
  },
  {
    key: "MAX_WITHDRAW_AMOUNT",
    label: "Số tiền rút tối đa",
    group: "payment",
    type: "NUMBER",
    defaultValue: 50_000_000,
    unit: "VNĐ",
    isPublic: false,
    description:
      "Số tiền tối đa provider được phép tạo trong một yêu cầu rút tiền.",
    effect:
      "Có hiệu lực khi provider tạo yêu cầu rút tiền mới. Đặt 0 nếu muốn bỏ giới hạn tối đa.",
    isEffective: true,
  },
  {
    key: "HOTLINE_PHONE",
    label: "Số hotline",
    group: "display",
    type: "STRING",
    defaultValue: "19001234",
    isPublic: true,
    description: "Số điện thoại hỗ trợ hiển thị cho khách hàng.",
    effect:
      "Có thể đọc qua API cấu hình công khai để frontend/mobile hiển thị.",
    isEffective: false,
  },
  {
    key: "SUPPORT_EMAIL",
    label: "Email hỗ trợ",
    group: "display",
    type: "STRING",
    defaultValue: "support@handigo.vn",
    isPublic: true,
    description: "Email hỗ trợ hiển thị trong các kênh chăm sóc khách hàng.",
    effect:
      "Có thể đọc qua API cấu hình công khai để frontend/mobile hiển thị.",
    isEffective: false,
  },
  {
    key: "MAINTENANCE_MODE",
    label: "Chế độ bảo trì",
    group: "operation",
    type: "BOOLEAN",
    defaultValue: false,
    isPublic: false,
    description:
      "Bật khi cần hạn chế một số chức năng trong thời gian bảo trì.",
    effect:
      "Chưa nối vào middleware chặn chức năng. Cần bổ sung logic backend nếu muốn dùng.",
    isEffective: false,
  },
  {
    key: "NOTIFICATION_DEFAULT_DATA",
    label: "Dữ liệu mặc định cho thông báo",
    group: "notification",
    type: "JSON",
    defaultValue: { screen: "notifications" },
    isPublic: false,
    description: "JSON mặc định dùng khi gửi thông báo hệ thống.",
    effect:
      "Chưa nối vào luồng gửi thông báo. Cần bổ sung logic backend nếu muốn dùng.",
    isEffective: false,
  },
];

export const typeOptions: Record<SystemConfigType, { label: string; icon: string }> = {
  STRING: { label: "Chuỗi", icon: "text_fields" },
  NUMBER: { label: "Số", icon: "tag" },
  BOOLEAN: { label: "Bật/Tắt", icon: "toggle_on" },
  JSON: { label: "JSON", icon: "data_object" },
};
