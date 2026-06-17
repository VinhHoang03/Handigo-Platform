import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookingShell } from '../components/BookingComponents';
import { mapImage, providerAvatar } from '../data/bookingMockData';
import { bookingApi } from '../../../api/booking';
import type { Order } from '../../../types/booking';

const BookingDetailPage = () => {
  const { bookingId: id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrder = async () => {
      if (!id) {
        setApiError('Mã đơn hàng không hợp lệ.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await bookingApi.getOrderById(id);
        if (!data) {
          setApiError('Không tìm thấy thông tin đơn hàng.');
        } else {
          setOrder(data);
          setApiError(null);
        }
      } catch (err: unknown) {
        console.error('Error fetching order:', err);
        setApiError('Đã có lỗi xảy ra khi tải thông tin đơn hàng.');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id]);

  if (loading) {
    return (
      <BookingShell>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-sm">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-on-surface-variant animate-pulse font-medium">Đang tải thông tin đơn hàng...</p>
        </div>
      </BookingShell>
    );
  }

  if (apiError || !order) {
    return (
      <BookingShell>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-md">
          <span className="material-symbols-outlined text-6xl text-red-400 mb-sm">error_outline</span>
          <h2 className="font-headline-md text-headline-md">{apiError || 'Không tìm thấy đơn hàng'}</h2>
          <p className="text-on-surface-variant mb-md max-w-xs">{apiError ? 'Vui lòng kiểm tra lại đường dẫn hoặc quay lại danh sách.' : 'Đơn hàng này không tồn tại hoặc bạn không có quyền xem.'}</p>
          <Link to="/customer/bookings" className="bg-primary text-on-primary px-lg py-2 rounded-full font-bold transition-all active:scale-95 shadow-lg shadow-primary/20">
            Quay lại danh sách
          </Link>
        </div>
      </BookingShell>
    );
  }

  const timeline = [
    {
      icon: 'check',
      title: 'Đã tạo đơn hàng',
      description: 'Yêu cầu dịch vụ đã được gửi thành công.',
      time: new Date(order.createdAt).toLocaleString('vi-VN'),
      state: 'done',
    },
    {
      icon: 'search',
      title: 'Đang tìm chuyên gia',
      description: order.providerId ? 'Đã tìm thấy chuyên gia thực hiện.' : 'Hệ thống đang điều phối chuyên gia phù hợp.',
      time: order.providerId ? '' : 'Đang tìm kiếm...',
      state: order.providerId ? 'done' : 'active',
    },
    {
      icon: 'person',
      title: 'Xác nhận & Thực hiện',
      description: order.status === 'accepted' || order.status === 'in_progress' || order.status === 'completed'
        ? 'Chuyên gia đã chấp nhận và đang thực hiện.'
        : 'Đợi chuyên gia di chuyển và xác nhận.',
      time: '',
      state: (order.status === 'accepted' || order.status === 'in_progress' || order.status === 'completed') ? 'done' : order.providerId ? 'active' : 'pending',
    },
    {
      icon: 'verified',
      title: 'Hoàn thành',
      description: order.status === 'completed' ? 'Dịch vụ đã hoàn tất thành công.' : 'Dự kiến hoàn tất sau khi thực hiện.',
      time: order.status === 'completed' ? new Date(order.updatedAt).toLocaleString('vi-VN') : '',
      state: order.status === 'completed' ? 'done' : order.status === 'in_progress' ? 'active' : 'pending',
    },
  ];

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'created': return 'Chờ xử lý';
      case 'accepted': return 'Đã xác nhận';
      case 'in_progress': return 'Đang thực hiện';
      case 'completed': return 'Đã hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'wallet': return 'Ví HandiGo';
      case 'bank': return 'Chuyển khoản';
      case 'cash': return 'Tiền mặt';
      default: return method;
    }
  };

  return (
    <BookingShell>
      <div className="flex items-center gap-sm mb-lg">
        <Link to="/customer/bookings" className="material-symbols-outlined text-primary p-2 hover:bg-primary/10 rounded-full transition-all active:scale-90">
          arrow_back
        </Link>
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Chi tiết đơn hàng</h1>
          <nav className="flex items-center gap-xs text-label-sm text-on-surface-variant font-label-sm uppercase tracking-wider">
            <Link to="/customer/bookings" className="hover:text-primary">Lịch sử</Link>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className="text-primary font-bold">#{order.orderCode}</span>
          </nav>
        </div>
      </div>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        <div className="lg:col-span-8 flex flex-col gap-lg">
          {/* Main Info Card */}
          <section className="glass-card rounded-3xl p-lg shadow-sm border border-outline-variant/30">
            <div className="flex flex-col md:flex-row md:justify-between items-start gap-md mb-lg">
              <div className="flex gap-md items-center">
                <img
                  className="w-20 h-20 rounded-2xl object-cover shadow-sm bg-surface-container"
                  src={order.serviceId?.image || 'https://via.placeholder.com/150'}
                  alt={order.serviceId?.name}
                />
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface leading-tight">{order.serviceId?.name}</h2>
                  <div className="flex flex-wrap gap-xs mt-1">
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">category</span>
                      {order.serviceId?.serviceType === 'fixed_price' ? 'Giá cố định' : 'Báo giá sau'}
                    </span>
                    <span className="bg-surface-container text-on-surface-variant px-3 py-1 rounded-full font-label-sm text-label-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {order.scheduledAt ? new Date(order.scheduledAt).toLocaleString('vi-VN') : 'Sớm nhất'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col md:items-end w-full md:w-auto">
                <div className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 shadow-sm ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-primary/10 text-primary'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${order.status === 'completed' ? 'bg-emerald-600' : order.status === 'cancelled' ? 'bg-red-600' : 'bg-primary animate-pulse'}`} />
                  {getStatusLabel(order.status)}
                </div>
                <p className="text-on-surface-variant text-label-sm mt-2 font-label-sm">Khởi tạo: {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-lg pt-lg border-t border-outline-variant/30">
              <div className="space-y-sm">
                <div className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">location_on</span>
                  <div>
                    <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase">Địa điểm thực hiện</h4>
                    <p className="font-medium text-on-surface mt-1">
                      {order.addressId?.label}: {order.addressId?.detailAddress}, {order.addressId?.ward}, {order.addressId?.district}, {order.addressId?.province}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-sm">
                <div className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">payments</span>
                  <div>
                    <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase">Thanh toán</h4>
                    <p className="font-medium text-on-surface mt-1">
                      {getPaymentMethodLabel(order.paymentMethod)} -
                      <span className={order.paymentStatus === 'paid' ? 'text-emerald-600 ml-1' : 'text-primary ml-1'}>
                        {order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Problem Description Section */}
            {(order.problemDescription || (order.customerAttachments && order.customerAttachments.length > 0)) && (
              <div className="mt-lg pt-lg border-t border-outline-variant/30">
                <h4 className="text-label-sm font-label-sm text-on-surface-variant uppercase mb-md">Mô tả vấn đề & Hình ảnh hiện trạng</h4>
                {order.problemDescription && (
                  <p className="bg-surface-container-low p-md rounded-2xl text-on-surface mb-md">
                    {order.problemDescription}
                  </p>
                )}
                {order.customerAttachments && order.customerAttachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-md mt-md">
                    {order.customerAttachments.map((url, idx) => (
                      <div key={idx} className="aspect-square rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30">
                        <img src={url} className="w-full h-full object-cover" alt={`Attachment ${idx + 1}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Timeline Section */}
          <section className="glass-card rounded-3xl p-lg shadow-sm">
            <h2 className="font-headline-md text-headline-md mb-lg flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary">analytics</span>
              Theo dõi tiến độ
            </h2>
            <div className="relative pl-4">
              {timeline.map((step, index) => {
                const isDone = step.state === 'done';
                const isActive = step.state === 'active';
                const isLast = index === timeline.length - 1;

                return (
                  <div key={step.title} className={`flex gap-lg pb-md last:pb-0 ${step.state === 'pending' ? 'opacity-40' : ''}`}>
                    <div className="flex flex-col items-center relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0 transition-all ${isDone
                          ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-110'
                          : isActive
                            ? 'bg-white text-primary border-4 border-primary shadow-lg scale-125'
                            : 'bg-surface-container-highest text-on-surface-variant'
                          }`}
                      >
                        <span className={`material-symbols-outlined text-[20px] ${isActive ? 'animate-pulse font-bold' : ''}`}>{step.icon}</span>
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 absolute top-10 bottom-0 ${isDone ? 'bg-primary' : 'bg-surface-container-highest border-r-2 border-dashed border-outline-variant/30'}`} />
                      )}
                    </div>
                    <div className="flex-grow pt-1.5">
                      <div className="flex justify-between items-start">
                        <h3 className={`font-bold transition-all ${isActive ? 'text-primary text-headline-sm' : 'text-on-surface font-headline-sm'}`}>
                          {step.title}
                        </h3>
                        {step.time && <span className="text-label-sm font-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{step.time}</span>}
                      </div>
                      <p className={`text-label-md mt-1 mb-base ${isActive ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                        {step.description}
                      </p>
                      {isActive && (
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-md mt-2 flex items-center gap-md">
                          <div className="w-1.5 h-12 bg-primary rounded-full animate-pulse" />
                          <p className="text-body-md text-on-surface">Đang xử lý tại bước này. Vui lòng chờ trong giây lát.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-lg">
          {/* Provider Info Card */}
          <section className="glass-card rounded-3xl p-lg shadow-sm border-t-4 border-t-primary">
            <h3 className="font-label-sm text-label-sm text-on-surface-variant mb-lg uppercase tracking-wider font-bold">Chuyên gia thực hiện</h3>
            {order.providerId ? (
              <div className="space-y-lg">
                <div className="flex items-center gap-md">
                  <div className="relative shrink-0">
                    <img
                      className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-primary/10"
                      src={order.providerId.avatar || providerAvatar}
                      alt={order.providerId.name}
                    />
                    <span className="absolute -bottom-1 -right-1 bg-emerald-500 w-4 h-4 rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <h4 className="font-headline-sm text-headline-sm text-on-surface line-clamp-1">{order.providerId.name || 'Chuyên gia'}</h4>
                    <div className="flex items-center gap-1 text-tertiary">
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-bold text-label-md">4.9</span>
                      <span className="text-on-surface-variant text-label-sm font-normal ml-1">({order.providerId.completedOrders || 32} đơn)</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-sm">
                  <button className="flex flex-col items-center gap-1 py-3 bg-primary/5 text-primary rounded-2xl font-bold hover:bg-primary/10 transition-all">
                    <span className="material-symbols-outlined">chat</span>
                    <span className="text-xs">Chat ngay</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 py-3 bg-emerald-50 text-emerald-600 rounded-2xl font-bold hover:bg-emerald-100 transition-all">
                    <span className="material-symbols-outlined">call</span>
                    <span className="text-xs">Gọi điện</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-md text-center">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-sm">
                  <span className="material-symbols-outlined animate-spin">search</span>
                </div>
                <p className="text-on-surface-variant text-sm px-md">Bác thợ phù hợp nhất đang được điều phối đến bạn.</p>
              </div>
            )}
          </section>

          {/* Pricing Card */}
          <section className="glass-card rounded-3xl p-lg shadow-sm">
            <h3 className="font-headline-sm text-headline-sm mb-lg">Tóm tắt thanh toán</h3>
            <div className="space-y-sm">
              <div className="flex justify-between text-body-md">
                <span className="text-on-surface-variant">Chi phí dịch vụ</span>
                <span className="text-on-surface font-medium">{order.pricing.bookingAmount.toLocaleString()}đ</span>
              </div>
              <div className="flex justify-between text-body-md">
                <span className="text-on-surface-variant">Phí di chuyển</span>
                <span className="text-on-surface font-medium">0đ</span>
              </div>
              <div className="border-t border-outline-variant/30 pt-sm mt-base flex justify-between items-center">
                <span className="font-bold text-on-surface">Tổng cộng</span>
                <span className="font-headline-md text-headline-md text-primary">
                  {order.pricing.totalPaidAmount.toLocaleString()}đ
                </span>
              </div>
            </div>
            {order.status === 'created' && (
              <button
                className="w-full mt-lg py-3 border-2 border-red-100 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                onClick={() => alert('Chức năng hủy đơn đang được xử lý.')}
              >
                <span className="material-symbols-outlined">close</span>
                Hủy yêu cầu
              </button>
            )}
          </section>

          {/* Location View */}
          <section className="glass-card rounded-3xl overflow-hidden shadow-sm h-52 relative group">
            <img className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-500" src={mapImage} alt="Map view" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            <div className="absolute top-4 left-4 bg-white shadow-xl px-3 py-1 rounded-full flex items-center gap-2 border border-primary/10">
              <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface">Điểm đến</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full scale-[2.5] animate-pulse" />
                <div className="w-10 h-10 bg-primary text-white rounded-full border-4 border-white shadow-2xl flex items-center justify-center relative z-10">
                  <span className="material-symbols-outlined text-[20px]">home</span>
                </div>
              </div>
            </div>
          </section>

          <button className="flex items-center justify-center gap-2 text-on-surface-variant hover:text-primary transition-colors py-2 group">
            <span className="material-symbols-outlined text-sm">flag</span>
            <span className="text-label-sm font-label-sm border-b border-transparent group-hover:border-primary">Báo cáo vấn đề đơn hàng</span>
          </button>
        </aside>
      </main>
    </BookingShell>
  );
};

export default BookingDetailPage;
