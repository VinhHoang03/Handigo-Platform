import { CircleCheckBig, FileSpreadsheet, Hammer, IdCard, LifeBuoy, PenLine } from "lucide-react";
/**
 * Nội dung tĩnh của trang chủ.
 *
 * Nguyên tắc: không tuyên bố con số nào mà không truy được về dữ liệu thật.
 * Dải "10.000+ khách hàng / 2.000+ thợ / 50.000+ công việc" trước đây là số bịa,
 * lại còn mâu thuẫn với trang Giới thiệu (50.000+ khách hàng) trên cùng một site.
 * Thay bằng cam kết định tính — thứ nói được ngay hôm nay mà vẫn đúng.
 */

/** Dải cam kết ngay dưới hero. Mô tả cơ chế có thật trong sản phẩm. */
export const commitments = [
  {
    icon: IdCard,
    title: 'Hồ sơ thợ được kiểm duyệt',
    desc: 'Giấy tờ và tay nghề duyệt xong mới được nhận việc.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Báo giá trước khi làm',
    desc: 'Bạn xem giá và đồng ý rồi thợ mới bắt đầu.',
  },
  {
    icon: LifeBuoy,
    title: 'Có người xử lý khi trục trặc',
    desc: 'Gửi yêu cầu hỗ trợ ngay trong đơn, không phải gọi vòng.',
  },
];

/** 4 bước của luồng đặt dịch vụ. Nhãn là động từ, không đánh số "Bước 1/2/3". */
export const howItWorksSteps = [
  {
    icon: PenLine,
    title: 'Mô tả việc',
    desc: 'Chọn dịch vụ, ghi rõ vấn đề và địa chỉ. Thêm ảnh nếu có.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Nhận báo giá',
    desc: 'Thợ phù hợp xem yêu cầu và gửi giá trước khi tới.',
  },
  {
    icon: Hammer,
    title: 'Thợ đến làm',
    desc: 'Theo dõi trạng thái đơn và nhắn tin trực tiếp với thợ.',
  },
  {
    icon: CircleCheckBig,
    title: 'Thanh toán & đánh giá',
    desc: 'Xong việc mới thanh toán, rồi để lại nhận xét cho người sau.',
  },
];

/** Luận điểm của khối editorial "Vì sao chọn Handigo". */
export const reasons = [
  {
    title: 'Bạn biết ai sắp bước vào nhà mình',
    desc: 'Mỗi thợ có trang hồ sơ công khai: dịch vụ nhận làm, khu vực hoạt động và nhận xét của khách trước.',
  },
  {
    title: 'Giá thống nhất trước, không phát sinh giữa chừng',
    desc: 'Báo giá nằm trong đơn. Muốn đổi thì phải sửa đơn, hai bên cùng thấy.',
  },
  {
    title: 'Mọi việc để lại dấu vết',
    desc: 'Tin nhắn, thay đổi trạng thái và thanh toán đều lưu trong đơn, có gì tranh cãi thì tra lại được.',
  },
];
