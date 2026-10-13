import { CheckCircle2, CircleX, Clock, RotateCcw } from "lucide-react";
import type { BookingResultState } from '../utils/bookingResultState';

const results: Record<BookingResultState, { title: string; description: string }> = {
  booked: { title: 'Đặt lịch thành công!', description: 'Đơn của bạn đã được tạo. Bạn thanh toán tiền mặt trực tiếp cho chuyên gia sau khi sử dụng dịch vụ.' },
  paid: { title: 'Thanh toán thành công!', description: 'Khoản thanh toán đã được xác minh. Bạn có thể tiếp tục theo dõi tiến độ đơn dịch vụ.' },
  cancelled: { title: 'Đã hủy thanh toán', description: 'Đơn hàng vẫn được giữ. Bạn có thể mở đơn để thanh toán lại hoặc chọn phương thức khác.' },
  failed: { title: 'Thanh toán chưa thành công', description: 'Giao dịch đã thất bại hoặc hết hạn. Bạn có thể mở đơn hàng để kiểm tra và thanh toán lại.' },
  pending: { title: 'Đơn đang chờ thanh toán', description: 'Đơn đã được tạo, nhưng hệ thống chưa xác minh khoản thanh toán thành công.' },
  refunded: { title: 'Giao dịch đã hoàn tiền', description: 'Bạn có thể xem thông tin hoàn tiền trong chi tiết đơn hàng.' },
  order_cancelled: { title: 'Đơn hàng đã hủy', description: 'Đơn này đã được hủy. Xem chi tiết đơn để kiểm tra giao dịch và thông tin hoàn tiền.' },
  error: { title: 'Chưa thể xác minh thanh toán', description: 'Bạn có thể kiểm tra lại kết quả hoặc mở chi tiết đơn hàng.' },
};

export const BookingSuccessHero = ({ result = 'booked', description }: { result?: BookingResultState; description?: string }) => {
  const successful = result === 'paid' || result === 'booked';
  const Icon = successful ? CheckCircle2 : result === 'pending' ? Clock : result === 'refunded' ? RotateCcw : CircleX;
  const tone = successful ? 'bg-success-container text-on-success-container' : result === 'pending' || result === 'refunded'
    ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-error-container text-on-error-container';
  return (
  <div className="flex flex-col items-center gap-3 text-center mb-4 w-full max-w-4xl">
    <div className={`inline-flex shrink-0 items-center justify-center w-24 h-24 rounded-full shadow-sm ${tone}`}>
      <Icon aria-hidden="true" size={48} />
    </div>
    <div>
    <h1 className="font-headline-xl text-2xl font-bold leading-tight text-on-surface mb-1">{results[result].title}</h1>
    <p className="font-body-lg text-sm leading-6 text-on-surface-variant">
      {description ?? results[result].description}
    </p>
    </div>
  </div>
);
};
