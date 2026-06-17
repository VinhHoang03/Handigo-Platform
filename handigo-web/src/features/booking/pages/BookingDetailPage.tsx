import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookingShell } from '../components/BookingComponents';
import { providerAvatar } from '../data/bookingMockData';
import { bookingApi } from '../../../api/booking';
import { Modal } from '../../../components/common/Modal';
import type { Order, OrderQuotation } from '../../../types/booking';

type PendingAction = {
  type: 'confirmQuotation' | 'rejectQuotation' | 'cancelOrder';
  reason: string;
  error?: string;
};

const BookingDetailPage = () => {
  const { bookingId: id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [quotation, setQuotation] = useState<OrderQuotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const loadData = useCallback(async () => {
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

        try {
          const quo = await bookingApi.getQuotation(id);
          if (quo && quo.quotation) {
            setQuotation(quo);
          } else {
            setQuotation(null);
          }
        } catch (e) {
          console.error('No quotation found yet or error:', e);
          setQuotation(null);
        }
        setApiError(null);
      }
    } catch (err: unknown) {
      console.error('Error fetching order:', err);
      setApiError('Đã có lỗi xảy ra khi tải thông tin đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const handleConfirmQuotation = () => {
    if (!quotation) return;
    setPendingAction({ type: 'confirmQuotation', reason: '' });
  };

  const handleRejectQuotation = () => {
    if (!quotation) return;
    setPendingAction({ type: 'rejectQuotation', reason: '' });
  };

  const handleCancelOrder = () => {
    if (!order || order.status !== 'created') return;
    setPendingAction({ type: 'cancelOrder', reason: '' });
  };

  const closeActionDialog = () => {
    if (!busy) setPendingAction(null);
  };

  const updateActionReason = (reason: string) => {
    setPendingAction((current) => (current ? { ...current, reason, error: undefined } : current));
  };

  const executePendingAction = async () => {
    if (!pendingAction) return;

    const reason = pendingAction.reason.trim();
    if (pendingAction.type !== 'confirmQuotation' && !reason) {
      setPendingAction({ ...pendingAction, error: 'Vui lòng nhập lý do.' });
      return;
    }

    try {
      setBusy(true);
      if (pendingAction.type === 'confirmQuotation') {
        if (!quotation) return;
        await bookingApi.confirmQuotation(quotation.quotation._id);
      } else if (pendingAction.type === 'rejectQuotation') {
        if (!quotation) return;
        await bookingApi.rejectQuotation(quotation.quotation._id, reason);
      } else if (pendingAction.type === 'cancelOrder') {
        if (!order) return;
        await bookingApi.cancelOrder(order._id, reason);
      }

      setPendingAction(null);
      await loadData();
    } catch {
      setPendingAction((current) => (
        current ? { ...current, error: 'Không thể thực hiện thao tác. Vui lòng thử lại.' } : current
      ));
    } finally {
      setBusy(false);
    }
  };

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

  const formatCurrency = (amount?: number | null) => `${(amount ?? 0).toLocaleString('vi-VN')}đ`;

  const getQuotationStatusLabel = (status: OrderQuotation['quotation']['status']) => {
    switch (status) {
      case 'pending': return 'Chờ xác nhận';
      case 'approved': return 'Đã đồng ý';
      case 'rejected': return 'Đã từ chối';
      case 'expired': return 'Đã hết hạn';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  const getQuotationStatusClass = (status: OrderQuotation['quotation']['status']) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-700';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'expired': return 'bg-slate-100 text-slate-700';
      default: return 'bg-amber-100 text-amber-700 animate-pulse';
    }
  };

  const actionDialogConfig = pendingAction
    ? {
      confirmQuotation: {
        title: 'Xác nhận báo giá',
        message: 'Bạn có chắc chắn muốn đồng ý báo giá này?',
        confirmLabel: 'Đồng ý',
        tone: 'primary',
        requiresReason: false,
      },
      rejectQuotation: {
        title: 'Từ chối báo giá',
        message: 'Nhập lý do từ chối để chuyển phản hồi cho chuyên gia.',
        confirmLabel: 'Từ chối',
        tone: 'danger',
        requiresReason: true,
      },
      cancelOrder: {
        title: 'Hủy yêu cầu',
        message: 'Nhập lý do hủy yêu cầu. Thao tác này sẽ cập nhật trạng thái đơn hàng thành đã hủy.',
        confirmLabel: 'Hủy yêu cầu',
        tone: 'danger',
        requiresReason: true,
      },
    }[pendingAction.type]
    : null;

  // Helper to handle provider name/avatar potentially using different property names
  const getProviderInfo = () => {
    if (!order.providerId) return null;
    const p = order.providerId as { fullName?: string; name?: string; avatar?: string; completedOrders?: number };
    return {
      name: p.fullName || p.name || 'Chuyên gia',
      avatar: p.avatar || providerAvatar,
      completedOrders: p.completedOrders ?? 0,
    };
  };

  const providerInfo = getProviderInfo();

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
                      {order.addressId?.label || 'Địa chỉ'}: {order.addressId?.detailAddress}, {order.addressId?.ward}, {order.addressId?.district}, {order.addressId?.province}
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

            {/* Repair Quotation Section */}
            {(order.serviceId?.serviceType !== 'fixed_price' || order.inspectionRequired || order.hasAdditionalQuotation) && (
              <div className="mt-lg pt-lg border-t-4 border-primary/20 w-full overflow-hidden">
                {quotation ? (
                  <>
                    <div className="flex items-center justify-between mb-lg">
                      <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-2">
                        <span className="material-symbols-outlined">request_quote</span>
                        Báo giá sửa chữa
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getQuotationStatusClass(quotation.quotation.status)}`}>
                        {getQuotationStatusLabel(quotation.quotation.status)}
                      </span>
                    </div>

                    <div className="grid gap-sm mb-lg sm:grid-cols-2">
                      {quotation.quotation.quotationCode && (
                        <div className="rounded-2xl bg-surface-container-low p-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Mã báo giá</p>
                          <p className="mt-1 font-semibold text-on-surface">{quotation.quotation.quotationCode}</p>
                        </div>
                      )}
                      {quotation.quotation.createdAt && (
                        <div className="rounded-2xl bg-surface-container-low p-sm">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Thời gian gửi</p>
                          <p className="mt-1 font-semibold text-on-surface">
                            {new Date(quotation.quotation.createdAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-sm mb-lg">
                      {quotation.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-surface-container-low p-md rounded-2xl">
                          <div className="flex-1 min-w-0 mr-md">
                            <p className="font-bold text-on-surface truncate">{item.title}</p>
                            <p className="text-sm text-on-surface-variant">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
                            {item.description && (
                              <p className="mt-1 text-xs text-on-surface-variant line-clamp-2">{item.description}</p>
                            )}
                          </div>
                          <p className="font-headline-sm text-primary shrink-0">{formatCurrency(item.totalPrice)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-md p-lg bg-primary/5 rounded-3xl border border-primary/10 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        {typeof quotation.quotation.subtotalAmount === 'number' && (
                          <p className="text-sm text-on-surface-variant">
                            Tạm tính: <span className="font-semibold text-on-surface">{formatCurrency(quotation.quotation.subtotalAmount)}</span>
                          </p>
                        )}
                        {!!quotation.quotation.discountAmount && (
                          <p className="text-sm text-emerald-700">
                            Giảm giá: -{formatCurrency(quotation.quotation.discountAmount)}
                          </p>
                        )}
                        <p className="text-label-sm text-on-surface-variant font-bold uppercase">Tổng chi phí dự kiến</p>
                        <p className="text-headline-lg font-black text-primary leading-none mt-1">
                          {formatCurrency(quotation.quotation.finalAmount)}
                        </p>
                      </div>
                      {quotation.quotation.status === 'pending' && (
                        <div className="flex flex-col gap-sm sm:flex-row">
                          <button
                            disabled={busy}
                            onClick={handleRejectQuotation}
                            className="px-6 py-3 border-2 border-red-200 text-red-600 rounded-2xl font-bold hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
                          >
                            Từ chối
                          </button>
                          <button
                            disabled={busy}
                            onClick={handleConfirmQuotation}
                            className="px-8 py-3 bg-primary text-on-primary rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            Đồng ý báo giá
                          </button>
                        </div>
                      )}
                    </div>

                    {quotation.quotation.inspectionNote && (
                      <div className="mt-md p-md bg-surface-container rounded-2xl border border-outline-variant/30 italic text-on-surface-variant text-sm">
                        <strong>Ghi chú khảo sát:</strong> {quotation.quotation.inspectionNote}
                      </div>
                    )}
                    {quotation.quotation.recommendation && (
                      <div className="mt-md p-md bg-surface-container rounded-2xl border border-outline-variant/30 text-on-surface-variant text-sm">
                        <strong>Đề xuất xử lý:</strong> {quotation.quotation.recommendation}
                      </div>
                    )}
                    {quotation.quotation.status === 'rejected' && quotation.quotation.rejectionReason && (
                      <div className="mt-md p-md bg-red-50 rounded-2xl border border-red-100 text-red-700 text-sm">
                        <strong>Lý do từ chối:</strong> {quotation.quotation.rejectionReason}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-xl text-center bg-surface-container-low rounded-3xl border border-dashed border-outline-variant/50 w-full px-4">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-md">
                      <span className="material-symbols-outlined text-3xl animate-bounce">request_quote</span>
                    </div>
                    <h3 className="font-headline-sm text-on-surface mb-xs">Đang chờ chuyên gia báo giá</h3>
                    <p className="text-on-surface-variant max-w-md mx-auto text-sm leading-relaxed">
                      {order.status === 'created'
                        ? 'Sau khi chuyên gia nhận đơn, họ sẽ đến khảo sát và gửi báo giá cho bạn.'
                        : 'Chuyên gia đang kiểm tra và lập báo giá chi tiết. Bạn sẽ nhận được thông báo khi có báo giá.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="lg:col-span-4 flex flex-col gap-lg">
          {/* Provider Info Card */}
          <section className="glass-card rounded-3xl p-lg shadow-sm border-t-4 border-t-primary">
            <h3 className="font-label-sm text-label-sm text-on-surface-variant mb-lg uppercase tracking-wider font-bold">Chuyên gia thực hiện</h3>
            {providerInfo ? (
              <div className="space-y-lg">
                <div className="flex items-center gap-md">
                  <div className="relative shrink-0">
                    <img
                      className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-primary/10"
                      src={providerInfo.avatar}
                      alt={providerInfo.name}
                    />
                    <span className="absolute -bottom-1 -right-1 bg-emerald-500 w-4 h-4 rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <h4 className="font-headline-sm text-headline-sm text-on-surface line-clamp-1">{providerInfo.name}</h4>
                    <div className="flex items-center gap-1 text-tertiary">
                      <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-bold text-label-md">4.9</span>
                      <span className="text-on-surface-variant text-label-sm font-normal ml-1">({providerInfo.completedOrders} đơn)</span>
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

          {/* Timeline Section - Moved here */}
          <section className="glass-card rounded-3xl p-lg shadow-sm">
            <h3 className="font-label-sm text-label-sm text-on-surface-variant mb-lg uppercase tracking-wider font-bold">Theo dõi tiến độ</h3>
            <div className="relative pl-4">
              {timeline.map((step, index) => {
                const isDone = step.state === 'done';
                const isActive = step.state === 'active';
                const isLast = index === timeline.length - 1;

                return (
                  <div key={step.title} className={`flex gap-md pb-md last:pb-0 ${step.state === 'pending' ? 'opacity-40' : ''}`}>
                    <div className="flex flex-col items-center relative">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 transition-all ${isDone
                          ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 scale-100'
                          : isActive
                            ? 'bg-white text-primary border-4 border-primary shadow-lg scale-110'
                            : 'bg-surface-container-highest text-on-surface-variant'
                          }`}
                      >
                        <span className={`material-symbols-outlined text-[16px] ${isActive ? 'animate-pulse font-bold' : ''}`}>{step.icon}</span>
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 absolute top-8 bottom-0 ${isDone ? 'bg-primary' : 'bg-surface-container-highest border-r-2 border-dashed border-outline-variant/30'}`} />
                      )}
                    </div>
                    <div className="flex-grow pt-1">
                      <div className="flex flex-col">
                        <h4 className={`font-bold text-xs transition-all ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                          {step.title}
                        </h4>
                        {step.time && <span className="text-[10px] text-on-surface-variant mt-0.5">{step.time}</span>}
                      </div>
                      <p className={`text-[10px] mt-1 leading-tight ${isActive ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {order.status === 'created' && (
            <button
              disabled={busy}
              className="w-full py-3 border-2 border-red-100 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCancelOrder}
            >
              {busy ? (
                <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-sm">close</span>
              )}
              Hủy yêu cầu
            </button>
          )}

          <button className="flex items-center justify-center gap-2 text-on-surface-variant hover:text-primary transition-colors py-2 group">
            <span className="material-symbols-outlined text-sm">flag</span>
            <span className="text-label-sm font-label-sm border-b border-transparent group-hover:border-primary">Báo cáo vấn đề đơn hàng</span>
          </button>
        </aside>
      </main>

      {pendingAction && actionDialogConfig && (
        <Modal
          open
          title={actionDialogConfig.title}
          onClose={closeActionDialog}
          size="sm"
          closeOnEsc={!busy}
          closeOnOverlayClick={!busy}
        >
          <div className="space-y-md">
            <p className="text-body-md text-on-surface-variant">{actionDialogConfig.message}</p>

            {actionDialogConfig.requiresReason && (
              <label className="block">
                <span className="mb-2 block text-label-sm font-bold uppercase text-on-surface-variant">
                  Lý do
                </span>
                <textarea
                  value={pendingAction.reason}
                  onChange={(event) => updateActionReason(event.target.value)}
                  disabled={busy}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  placeholder="Nhập lý do..."
                />
              </label>
            )}

            {pendingAction.error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {pendingAction.error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-sm pt-sm sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={closeActionDialog}
                className="rounded-2xl bg-surface-container-high px-5 py-3 font-bold text-on-surface transition hover:bg-surface-container-highest disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={executePendingAction}
                className={`rounded-2xl px-5 py-3 font-bold text-white transition disabled:opacity-50 ${actionDialogConfig.tone === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-primary hover:bg-primary/90'
                  }`}
              >
                {busy ? 'Đang xử lý...' : actionDialogConfig.confirmLabel}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </BookingShell>
  );
};

export default BookingDetailPage;
