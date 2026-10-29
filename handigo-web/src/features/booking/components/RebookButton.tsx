import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import { getCategoryId } from '@/features/customer-service/utils/serviceDisplay';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { getErrorMessage } from '@/utils/apiError';
import { bookingApi } from '../api/booking.api';
import { canRebook, prepareRebooking, type PreparedRebooking } from '../utils/rebooking';
import { assertNoPendingRebooking } from '../utils/submitQuickRebooking';
import { QuickRebookingPanel } from './QuickRebookingPanel';
import { useBookingStore } from '../hooks/useBookingStore';
import { getQuickRebookingReturn, quickRebookingReturnPath, restoreQuickRebookingDraft } from '../utils/quickRebookingReturn';
import { PENDING_ORDER_ID_KEY, clearPendingBooking, recoverPendingBooking } from './pendingBookingRecovery';

export function RebookButton({ orderId, status, restoreOnly = false }: { orderId: string; status?: string; restoreOnly?: boolean }) {
  const navigate = useNavigate();
  const sessionRevision = useAuthStore(state => state.sessionRevision);
  const [openedSession, setOpenedSession] = useState(sessionRevision);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<PreparedRebooking | null>(null);
  const request = useRef(0);
  const submitting = useRef(false);
  useEffect(() => () => { request.current++; }, []);

  const onBusyChange = (value: boolean) => {
    if (openedSession !== useAuthStore.getState().sessionRevision) return;
    submitting.current = value; setBusy(value);
  };
  const close = () => {
    if (submitting.current && openedSession === sessionRevision) return;
    request.current++; setOpen(false); setLoading(false); setPrepared(null);
  };
  const load = useCallback(async () => {
    if (submitting.current && openedSession === sessionRevision) return;
    submitting.current = false; setBusy(false);
    const revision = ++request.current;
    const session = useAuthStore.getState().sessionRevision;
    setOpenedSession(session); setOpen(true); setLoading(true); setError(''); setPrepared(null);
    try {
      const saved = getQuickRebookingReturn(orderId);
      if (saved) {
        const pendingId = sessionStorage.getItem(PENDING_ORDER_ID_KEY);
        if (pendingId) {
          const recovery = await recoverPendingBooking(pendingId);
          if (revision !== request.current || session !== useAuthStore.getState().sessionRevision) return;
          if (recovery.paidOrder) {
            clearPendingBooking(); useBookingStore.getState().reset(); setOpen(false);
            navigate('/customer/bookings/success', { state: { order: recovery.paidOrder } });
            return;
          }
          // Giữ dấu quay về đến khi tải lại dịch vụ thành công để nút Thử lại vẫn phục hồi đúng nháp.
          clearPendingBooking(true);
        }
      }
      assertNoPendingRebooking();
      const order = await bookingApi.getOrderById(orderId);
      if (!canRebook(order.status)) throw new Error('Đơn này vẫn đang được xử lý. Vui lòng theo dõi trong trang chi tiết đơn.');
      if (!order.serviceId?._id) throw new Error('Dịch vụ cũ không còn khả dụng. Vui lòng chọn dịch vụ khác.');
      const [service, options, addresses, categories] = await Promise.all([
        serviceCatalogApi.serviceById(order.serviceId._id), serviceCatalogApi.options(order.serviceId._id),
        bookingApi.getAddresses(), serviceCatalogApi.categories(),
      ]);
      if (!categories.some(category => category._id === getCategoryId(service))) {
        throw new Error('Danh mục dịch vụ này đã ngừng hoạt động. Vui lòng chọn dịch vụ khác.');
      }
      const draft = prepareRebooking(order, service, options, addresses);
      if (revision !== request.current || session !== useAuthStore.getState().sessionRevision) return;
      const next = { order, draft, service, options: options.filter(option => option.isActive), addresses, session };
      if (saved) {
        next.draft = restoreQuickRebookingDraft(next, saved);
        clearPendingBooking();
      }
      setPrepared({ ...next, restoredAfterPayment: Boolean(saved) });
    } catch (cause) {
      if (revision === request.current) setError(getErrorMessage(cause, 'Không thể chuẩn bị đơn đặt lại. Vui lòng thử lại.'));
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [openedSession, orderId, sessionRevision, navigate]);

  useEffect(() => {
    const resume = () => {
      if (!getQuickRebookingReturn(orderId)) return;
      if (restoreOnly) void load();
      else if (canRebook(status)) navigate(quickRebookingReturnPath(orderId), { replace: true });
    };
    const timer = window.setTimeout(resume, 0);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && getQuickRebookingReturn(orderId)) {
        submitting.current = false;
        resume();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => { window.clearTimeout(timer); window.removeEventListener('pageshow', onPageShow); };
  }, [load, navigate, orderId, status, restoreOnly]);
  if (!restoreOnly && !canRebook(status)) return null;
  return <>
    {!restoreOnly && <button type="button" disabled={busy && openedSession === sessionRevision} onClick={() => void load()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/40 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5 disabled:opacity-50">
      <RotateCcw size={16} aria-hidden="true" />Đặt lại
    </button>}
    <Modal open={open && openedSession === sessionRevision} title="Đặt lại nhanh" onClose={close} size="sm" closeOnEsc={!busy} closeOnOverlayClick={!busy}>
      {loading && <p role="status">Đang kiểm tra dịch vụ và thông tin lần đặt trước...</p>}
      {error && <div role="alert" className="space-y-3 text-sm"><p className="text-error">{error}</p>
        <div className="flex flex-wrap gap-4"><button type="button" onClick={() => void load()} className="font-bold text-primary">Thử lại</button>
          <button type="button" onClick={() => navigate('/customer/bookings/new/payment')} className="font-bold text-primary">Kiểm tra bản đang soạn</button>
          <button type="button" onClick={() => { close(); navigate('/customer/services'); }} className="font-bold text-primary">Xem dịch vụ khác</button></div>
      </div>}
      {open && openedSession === sessionRevision && prepared && !error && <QuickRebookingPanel prepared={prepared} onBusyChange={onBusyChange} />}
    </Modal>
  </>;
}
