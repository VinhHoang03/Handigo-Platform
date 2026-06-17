import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { notificationApi } from '../api/notification.api';
import type {
  AppNotification,
  NotificationQuery,
  NotificationTargetRole,
  NotificationType,
} from '../types/notification.types';

type NotificationRole = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

type SendFormState = {
  targetRole: NotificationTargetRole;
  title: string;
  content: string;
};

const emptySendForm: SendFormState = {
  targetRole: 'ALL',
  title: '',
  content: '',
};

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const typeLabels: Record<NotificationType, string> = {
  ORDER: 'Đơn hàng',
  PAYMENT: 'Thanh toán',
  QUOTATION: 'Báo giá',
  WITHDRAWAL: 'Rút tiền',
  PROMOTION: 'Khuyến mãi',
  SYSTEM: 'Hệ thống',
};

const typeIcons: Record<NotificationType, string> = {
  ORDER: 'receipt_long',
  PAYMENT: 'payments',
  QUOTATION: 'request_quote',
  WITHDRAWAL: 'account_balance_wallet',
  PROMOTION: 'local_offer',
  SYSTEM: 'campaign',
};

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
};

export default function NotificationsPage({ role }: { role: NotificationRole }) {
  const [query, setQuery] = useState<NotificationQuery>({ page: 1, limit: 8, type: '', isRead: '', targetRole: '' });
  const [items, setItems] = useState<AppNotification[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState<SendFormState>(emptySendForm);

  const isAdmin = role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const listResult = isAdmin
        ? await notificationApi.adminList(query)
        : await notificationApi.list(query);
      const countResult = isAdmin
        ? { count: listResult.items.filter((item) => !item.isRead).length }
        : await notificationApi.unreadCount();
      setItems(listResult.items);
      setTotalPages(listResult.pagination.totalPages || 1);
      setUnreadCount(countResult.count);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 150);
    return () => window.clearTimeout(timer);
  }, [load]);

  const stats = useMemo(() => {
    const readOnPage = items.filter((item) => item.isRead).length;
    return [
      { icon: 'notifications', label: 'Chưa đọc', value: unreadCount },
      { icon: 'drafts', label: 'Đã đọc trên trang', value: readOnPage },
      { icon: 'inbox', label: 'Tổng trên trang', value: items.length },
    ];
  }, [items, unreadCount]);

  const refresh = async () => {
    await load();
  };

  const markOne = async (notification: AppNotification) => {
    if (notification.isRead) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await notificationApi.markAsRead(notification.id);
      setNotice('Đã đánh dấu thông báo là đã đọc.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const markAll = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await notificationApi.markAllAsRead();
      setNotice(`Đã đánh dấu ${result.modifiedCount} thông báo là đã đọc.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitSystemNotification = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await notificationApi.sendSystem({
        targetRole: sendForm.targetRole,
        title: sendForm.title.trim(),
        content: sendForm.content.trim(),
        type: 'SYSTEM',
      });
      setSendOpen(false);
      setSendForm(emptySendForm);
      setNotice(`Đã gửi thông báo hệ thống tới ${result.sentCount} người dùng.`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role={role}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-headline-lg font-bold text-on-background">Thông báo</h1>
            <p className="text-on-surface-variant">Theo dõi các cập nhật mới nhất từ hệ thống Handigo.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
              Tải lại
            </button>
            {!isAdmin && (
              <button
                type="button"
                onClick={() => void markAll()}
                disabled={busy || unreadCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-5 py-3 font-semibold text-on-surface hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">done_all</span>
                Đánh dấu tất cả
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setSendOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">campaign</span>
                Gửi thông báo
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((item) => (
            <Stat key={item.label} icon={item.icon} label={item.label} value={item.value} />
          ))}
        </div>

        {(notice || error) && (
          <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-emerald-100 text-emerald-700'}`}>
            {error || notice}
          </div>
        )}

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-title-lg font-bold text-on-surface">Danh sách thông báo</h2>
              <p className="text-sm text-on-surface-variant">Sắp xếp theo thời gian mới nhất.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isAdmin && (
                <select
                  value={query.targetRole || ''}
                  onChange={(event) => setQuery({ ...query, targetRole: event.target.value as NotificationQuery['targetRole'], page: 1 })}
                  className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Tất cả người nhận</option>
                  <option value="CUSTOMER">Khách hàng</option>
                  <option value="PROVIDER">Nhà cung cấp</option>
                </select>
              )}
              <select
                value={query.type || ''}
                onChange={(event) => setQuery({ ...query, type: event.target.value as NotificationQuery['type'], page: 1 })}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Tất cả loại</option>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={query.isRead === '' ? '' : String(query.isRead)}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery({ ...query, isRead: value === '' ? '' : value === 'true', page: 1 });
                }}
                className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="false">Chưa đọc</option>
                <option value="true">Đã đọc</option>
              </select>
            </div>
          </div>

          <AsyncState
            loading={loading}
            error={error && !items.length ? error : ''}
            empty={!items.length}
            emptyMessage="Chưa có thông báo."
            onRetry={refresh}
          >
            <NotificationList items={items} busy={busy} showRecipient={isAdmin} onMarkRead={markOne} />
          </AsyncState>
          <Pagination page={query.page || 1} totalPages={totalPages} onChange={(page) => setQuery({ ...query, page })} />
        </section>
      </div>

      <SendNotificationModal
        open={sendOpen}
        form={sendForm}
        busy={busy}
        onChange={setSendForm}
        onClose={() => setSendOpen(false)}
        onSubmit={submitSystemNotification}
      />
    </DashboardShell>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
      <span className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="text-headline-md font-bold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

function NotificationList({
  items,
  busy,
  showRecipient,
  onMarkRead,
}: {
  items: AppNotification[];
  busy: boolean;
  showRecipient?: boolean;
  onMarkRead: (notification: AppNotification) => void;
}) {
  return (
    <div className="divide-y divide-outline-variant/10">
      {items.map((item) => (
        <article key={item.id} className={`flex gap-4 py-4 ${item.isRead ? '' : 'bg-primary/5 px-3 sm:-mx-3'}`}>
          <span className={`material-symbols-outlined mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.isRead ? 'bg-surface-container-low text-on-surface-variant' : 'bg-primary/10 text-primary'}`}>
            {typeIcons[item.type]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-on-surface">{item.title}</h3>
                  <span className="inline-flex rounded-full bg-surface-container-low px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                    {typeLabels[item.type]}
                  </span>
                  {!item.isRead && (
                    <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                      Mới
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">{item.content}</p>
                {showRecipient && item.recipient && (
                  <p className="mt-2 text-sm text-on-surface-variant">
                    Người nhận:{' '}
                    <span className="font-semibold text-on-surface">
                      {item.recipient.fullName || item.recipient.email || item.recipient.id}
                    </span>
                    {item.recipient.role && ` (${item.recipient.role})`}
                  </p>
                )}
                <p className="mt-2 text-xs text-on-surface-variant">{dateTime.format(new Date(item.createdAt))}</p>
              </div>
              {!showRecipient && (
                <button
                  type="button"
                  onClick={() => onMarkRead(item)}
                  disabled={busy || item.isRead}
                  className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">done</span>
                  Đã đọc
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function SendNotificationModal({
  open,
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: SendFormState;
  busy: boolean;
  onChange: (form: SendFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <Modal open={open} title="Gửi thông báo hệ thống" onClose={onClose} size="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Người nhận</span>
          <select
            value={form.targetRole}
            onChange={(event) => onChange({ ...form, targetRole: event.target.value as NotificationTargetRole })}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="ALL">Tất cả khách hàng và nhà cung cấp</option>
            <option value="CUSTOMER">Khách hàng</option>
            <option value="PROVIDER">Nhà cung cấp</option>
          </select>
        </label>
        <FormInput label="Tiêu đề" required value={form.title} onChange={(value) => onChange({ ...form, title: value })} />
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nội dung</span>
          <textarea
            required
            rows={5}
            maxLength={2000}
            value={form.content}
            onChange={(event) => onChange({ ...form, content: event.target.value })}
            className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">Hủy</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
            {busy ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FormInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 outline-none focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}
