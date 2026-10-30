import { Banknote, Bug, LifeBuoy, Mail, MessageSquare, UserCog, Wrench } from "lucide-react";
export const supportCategories = [
  {
    icon: UserCog,
    title: 'Tài khoản',
    text: 'Bảo mật, thông tin cá nhân và cài đặt ứng dụng.',
  },
  {
    icon: Banknote,
    title: 'Thanh toán',
    text: 'Hóa đơn, hoàn tiền và phương thức thanh toán.',
  },
  {
    icon: Wrench,
    title: 'Dịch vụ',
    text: 'Chất lượng dịch vụ, lịch hẹn và phản hồi thợ.',
  },
  {
    icon: Bug,
    title: 'Lỗi kỹ thuật',
    text: 'Sự cố ứng dụng hoặc lỗi trong quá trình đặt lịch.',
  },
];

/* `faqs` (3 câu) đã chuyển sang `support-faq.ts` và mở rộng thành 16 câu theo
   đúng 4 nhóm của `supportCategories`, để ô tìm kiếm trên trang Hỗ trợ có nội
   dung thật để lọc. */

export const supportChannels = [
  {
    icon: LifeBuoy,
    title: 'Tổng đài hỗ trợ',
    value: '1900 1234',
    text: 'Phục vụ hằng ngày từ 7:00 đến 22:00.',
    href: 'tel:19001234',
  },
  {
    icon: Mail,
    title: 'Email chăm sóc khách hàng',
    value: 'support@handigo.vn',
    text: 'Phù hợp cho yêu cầu cần mô tả chi tiết hoặc gửi kèm hình ảnh.',
    href: 'mailto:support@handigo.vn',
  },
  {
    icon: MessageSquare,
    title: 'Hỗ trợ trong ứng dụng',
    value: 'Trò chuyện với Handigo',
    text: 'Theo dõi và phản hồi trực tiếp theo từng yêu cầu đã gửi.',
  },
];

export {
  SUPPORT_STATUS_LABELS as TICKET_STATUS_LABELS,
  SUPPORT_CATEGORY_LABELS as TICKET_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS as TICKET_PRIORITY_LABELS,
} from "@/features/case-management/components/supportLabels.constants";

export { ticketDate, TICKET_PRIORITY_CLASSES, TICKET_PRIORITY_FALLBACK } from "@/features/case-management/components/supportLabels.constants";
