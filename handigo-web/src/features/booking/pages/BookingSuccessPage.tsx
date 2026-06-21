import { useEffect, useState } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { BookingShell } from '../components/BookingComponents';
import { mapImage } from '../data/bookingMockData';
import type { Order } from '../../../types/booking';
import { bookingApi } from '../../../api/booking';
import { useBookingStore } from '../hooks/useBookingStore';
import { ReliableImage } from '@/components/common/ReliableImage';

const formatAddress = (order: Order) => {
  const address = order.addressId;
  if (!address || typeof address === 'string') return '';
  const addressLine = [address.detailAddress, address.ward, address.district, address.province]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
  return [address.label?.trim(), addressLine].filter(Boolean).join(': ');
};

const BookingSuccessPage = () => {
  const location = useLocation();
  const stateOrder = location.state?.order as Order | undefined;
  const fallbackOrderId = new URLSearchParams(location.search).get('orderId') || sessionStorage.getItem('latestBookingOrderId');
  const [order, setOrder] = useState<Order | null>(stateOrder ?? null);
  const [isLoading, setIsLoading] = useState(!stateOrder && Boolean(fallbackOrderId));
  const reset = useBookingStore(state => state.reset);

  useEffect(() => {
    if (stateOrder) {
      sessionStorage.removeItem('latestBookingOrderId');
      reset();
      return;
    }

    const orderId = fallbackOrderId;

    if (!orderId) return;

    let isMounted = true;
    bookingApi.getOrderById(orderId)
      .then(data => {
        if (!isMounted) return;
        setOrder(data);
        sessionStorage.removeItem('latestBookingOrderId');
        reset();
      })
      .catch(error => {
        console.error('Failed to load paid order:', error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fallbackOrderId, reset, stateOrder]);

  if (isLoading) {
    return (
      <BookingShell>
        <main className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
            <p className="mt-4 font-body-md text-on-surface-variant">Dang tai thong tin don hang...</p>
          </div>
        </main>
      </BookingShell>
    );
  }

  if (!order) {
    return <Navigate to="/customer" replace />;
  }

  const addressText = formatAddress(order);

  return (
    <BookingShell>
      <main className="flex flex-col items-center justify-center py-lg">
        <div className="text-center mb-lg w-full max-w-2xl">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full mb-md animate-[float_4s_ease-in-out_infinite] shadow-lg shadow-emerald-200/50">
            <span className="material-symbols-outlined text-5xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
              check_circle
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">Đặt lịch thành công!</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Cảm ơn bạn đã tin tưởng HandiGo. Chuyên gia của chúng tôi sẽ sớm liên hệ với bạn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-md w-full max-w-4xl">
          <section className="md:col-span-2 glass-card rounded-3xl p-md shadow-sm">
            <div className="flex justify-between items-start mb-md">
              <div>
                <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                  Mã đơn hàng
                </span>
                <p className="font-headline-md text-headline-md text-primary">{order.orderCode}</p>
              </div>
              <div className="bg-primary/10 text-primary px-3 py-1 rounded-full font-label-sm">
                {order.status === 'created' ? 'Đang chờ xử lý' : 'Đã xác nhận'}
              </div>
            </div>

            <div className="space-y-md">
              <div className="flex gap-md">
                <ReliableImage
                  className="w-24 h-24 rounded-2xl object-cover shadow-sm"
                  src={order.serviceId.image}
                  alt={order.serviceId.name}
                />
                <div className="flex flex-col justify-center">
                  <h2 className="font-headline-md text-headline-md text-on-surface">{order.serviceId.name}</h2>
                  <p className="text-on-surface-variant flex items-center gap-xs">
                    Loại dịch vụ: {order.serviceId.serviceType === 'fixed_price' ? 'Giá cố định' : 'Báo giá sau'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md border-t border-outline-variant/30 pt-md">
                <div className="flex items-start gap-sm">
                  <div className="p-2 bg-surface-container rounded-lg text-primary">
                    <span className="material-symbols-outlined">schedule</span>
                  </div>
                  <div>
                    <p className="font-label-sm text-on-surface-variant">Thời gian</p>
                    <p className="font-label-md text-on-surface">
                      {order.scheduledAt ? new Date(order.scheduledAt).toLocaleString('vi-VN') : 'Sớm nhất có thể'}
                    </p>
                  </div>
                </div>
                {addressText && (
                  <div className="flex items-start gap-sm">
                    <div className="p-2 bg-surface-container rounded-lg text-primary">
                      <span className="material-symbols-outlined">location_on</span>
                    </div>
                    <div>
                      <p className="font-label-sm text-on-surface-variant">Địa chỉ</p>
                      <p className="font-label-md text-on-surface">{addressText}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="md:col-span-1 flex flex-col gap-md">
            <div className="glass-card rounded-3xl p-md shadow-sm flex flex-col h-full">
              <h3 className="font-headline-md text-headline-md mb-md">Tóm tắt</h3>
              <div className="space-y-sm flex-grow">
                <div className="flex justify-between text-label-md">
                  <span className="text-on-surface-variant">
                    {order.serviceId.serviceType === 'fixed_price' ? 'Phí dịch vụ' : 'Phí đặt cọc'}
                  </span>
                  <span className="text-on-surface">
                    {order.pricing.bookingAmount.toLocaleString()}đ
                  </span>
                </div>
                {order.pricing.promotionDiscountAmount > 0 && (
                  <div className="flex justify-between text-label-md">
                    <span className="text-on-surface-variant">Khuyến mãi</span>
                    <span className="text-emerald-600">-{order.pricing.promotionDiscountAmount.toLocaleString()}đ</span>
                  </div>
                )}
                {order.pricing.voucherDiscountAmount > 0 && (
                  <div className="flex justify-between text-label-md">
                    <span className="text-on-surface-variant">Voucher</span>
                    <span className="text-emerald-600">-{order.pricing.voucherDiscountAmount.toLocaleString()}đ</span>
                  </div>
                )}
                <div className="flex justify-between text-label-md">
                  <span className="text-on-surface-variant">Phương thức</span>
                  <span className="text-on-surface">
                    {order.paymentMethod === 'wallet' ? 'Ví HandiGo' : order.paymentMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt'}
                  </span>
                </div>
              </div>
              <div className="border-t border-outline-variant/30 pt-sm mt-md">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-on-surface">Tổng cộng</span>
                  <span className="font-headline-md text-headline-md text-primary">
                    {order.pricing.totalPaidAmount.toLocaleString()}đ
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col sm:flex-row gap-md mt-lg w-full max-w-4xl">
          <Link
            to={`/customer/bookings/${order._id}`}
            className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center justify-center gap-sm"
          >
            <span className="material-symbols-outlined">map</span>
            Theo dõi đơn hàng
          </Link>
          <Link
            to="/customer"
            className="flex-1 py-4 bg-surface-container-high/50 text-primary border border-outline-variant/30 rounded-2xl font-bold hover:bg-surface-container-highest/20 transition-all active:scale-95 flex items-center justify-center gap-sm"
          >
            <span className="material-symbols-outlined">home</span>
            Về trang chủ
          </Link>
        </div>

        <div className="w-full max-w-4xl mt-lg h-48 rounded-3xl overflow-hidden border border-outline-variant/30 relative shadow-sm">
          <div className="absolute inset-0 bg-slate-200 flex items-center justify-center overflow-hidden">
            <img className="w-full h-full object-cover opacity-60 grayscale" src={mapImage} alt="Bản đồ vị trí" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container/80 to-transparent" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-md py-xs rounded-full shadow-md flex items-center gap-sm">
              <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
              <span className="text-label-sm font-label-sm text-on-surface">Đang tìm chuyên gia gần nhất...</span>
            </div>
          </div>
        </div>

        <footer className="mt-auto px-md py-lg border-t border-outline-variant/20 w-full">
          <div className="container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-md">
            <div className="flex items-center gap-sm">
              <span className="font-headline-md text-headline-md font-extrabold text-primary/50">HandiGo</span>
              <span className="text-on-surface-variant text-label-sm">© 2024 Dịch vụ gia đình cao cấp</span>
            </div>
            <div className="flex gap-md text-on-surface-variant text-label-sm">
              <a className="hover:text-primary transition-colors" href="#">
                Điều khoản
              </a>
              <a className="hover:text-primary transition-colors" href="#">
                Bảo mật
              </a>
              <a className="hover:text-primary transition-colors" href="#">
                Hỗ trợ
              </a>
            </div>
          </div>
        </footer>
      </main>
    </BookingShell>
  );
};

export default BookingSuccessPage;
