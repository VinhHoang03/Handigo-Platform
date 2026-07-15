import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { Modal } from '@/components/common/Modal';
import { systemConfigApi } from '../api/systemConfig.api';
import type {
  SystemConfig,
  SystemConfigPayload,
  SystemConfigQuery,
  SystemConfigType,
  UpdateSystemConfigPayload,
} from '../types/systemConfig.types';

type ConfigGroupKey = 'operation' | 'booking' | 'payment' | 'display' | 'notification';

type ConfigDefinition = {
  key: string;
  label: string;
  group: ConfigGroupKey;
  type: SystemConfigType;
  defaultValue: unknown;
  description: string;
  unit?: string;
  isPublic: boolean;
  effect: string;
  isEffective: boolean;
};

type ConfigItem = ConfigDefinition & {
  currentValue: unknown;
  existing: SystemConfig | null;
};

type ConfigFormState = {
  value: string;
  isPublic: boolean;
};

type PendingSave = {
  item: ConfigItem;
  payload: SystemConfigPayload;
};

const groupOptions: Array<{ key: ConfigGroupKey | 'all'; label: string; icon: string }> = [
  { key: 'all', label: 'Tất cả cấu hình', icon: 'dashboard' },
  { key: 'operation', label: 'Vận hành', icon: 'admin_panel_settings' },
  { key: 'booking', label: 'Đơn hàng', icon: 'assignment' },
  { key: 'payment', label: 'Thanh toán và ví', icon: 'account_balance_wallet' },
  { key: 'display', label: 'Hiển thị công khai', icon: 'public' },
  { key: 'notification', label: 'Thông báo', icon: 'notifications' },
];

const configDefinitions: ConfigDefinition[] = [
  {
    key: 'PLATFORM_FEE_PERCENT',
    label: 'Phí nền tảng',
    group: 'payment',
    type: 'NUMBER',
    defaultValue: 15,
    unit: '%',
    isPublic: false,
    description: 'Tỷ lệ phí nền tảng áp dụng khi tạo đơn dịch vụ giá cố định.',
    effect: 'Có hiệu lực khi khách tạo đơn mới. Đơn đã tạo trước đó giữ snapshot phí cũ.',
    isEffective: true,
  },
  {
    key: 'PROVIDER_MINIMUM_WALLET_BALANCE',
    label: 'Số dư tối thiểu để nhận đơn',
    group: 'payment',
    type: 'NUMBER',
    defaultValue: 100_000,
    unit: 'VNĐ',
    isPublic: false,
    description: 'Số dư ví tối thiểu provider phải duy trì để được điều phối và nhận đơn mới.',
    effect: 'Có hiệu lực khi hệ thống chọn provider và khi provider xác nhận nhận đơn.',
    isEffective: true,
  },
  {
    key: 'QUOTATION_SERVICE_DEPOSIT_AMOUNT',
    label: 'Tiền cọc dịch vụ báo giá',
    group: 'payment',
    type: 'NUMBER',
    defaultValue: 0,
    unit: 'VNĐ',
    isPublic: false,
    description: 'Số tiền cọc khách cần thanh toán trước với dịch vụ linh hoạt cần báo giá.',
    effect: 'Có hiệu lực khi khách tạo đơn báo giá mới. Nếu chưa lưu cấu hình này, hệ thống dùng tiền cọc đang cấu hình ở dịch vụ.',
    isEffective: true,
  },
  {
    key: 'MATCHING_PROVIDER_TIMEOUT_SECONDS',
    label: 'Thời gian chờ provider nhận đơn',
    group: 'booking',
    type: 'NUMBER',
    defaultValue: 60,
    unit: 'giây',
    isPublic: false,
    description: 'Số giây hệ thống chờ provider phản hồi trước khi thử provider tiếp theo.',
    effect: 'Có hiệu lực với các lượt gán provider mới sau khi lưu.',
    isEffective: true,
  },
  {
    key: 'MAX_MATCHING_ATTEMPTS',
    label: 'Số lần thử tìm provider tối đa',
    group: 'booking',
    type: 'NUMBER',
    defaultValue: 5,
    unit: 'lần',
    isPublic: false,
    description: 'Số provider tối đa hệ thống sẽ thử trước khi hủy đơn vì không tìm được provider phù hợp.',
    effect: 'Có hiệu lực với các lượt matching mới sau khi lưu.',
    isEffective: true,
  },
  {
    key: 'MAX_PROVIDER_RADIUS_KM',
    label: 'Bán kính tìm provider tối đa',
    group: 'booking',
    type: 'NUMBER',
    defaultValue: 20,
    unit: 'km',
    isPublic: false,
    description: 'Bán kính tối đa quanh địa chỉ khách hàng để tìm provider đang online và phù hợp dịch vụ.',
    effect: 'Có hiệu lực với các lượt tìm provider mới sau khi lưu.',
    isEffective: true,
  },
  {
    key: 'MIN_WITHDRAW_AMOUNT',
    label: 'Số tiền rút tối thiểu',
    group: 'payment',
    type: 'NUMBER',
    defaultValue: 0,
    unit: 'VNĐ',
    isPublic: false,
    description: 'Số tiền tối thiểu provider được phép tạo trong một yêu cầu rút tiền.',
    effect: 'Có hiệu lực khi provider tạo yêu cầu rút tiền mới.',
    isEffective: true,
  },
  {
    key: 'MAX_WITHDRAW_AMOUNT',
    label: 'Số tiền rút tối đa',
    group: 'payment',
    type: 'NUMBER',
    defaultValue: 50_000_000,
    unit: 'VNĐ',
    isPublic: false,
    description: 'Số tiền tối đa provider được phép tạo trong một yêu cầu rút tiền.',
    effect: 'Có hiệu lực khi provider tạo yêu cầu rút tiền mới. Đặt 0 nếu muốn bỏ giới hạn tối đa.',
    isEffective: true,
  },
  {
    key: 'HOTLINE_PHONE',
    label: 'Số hotline',
    group: 'display',
    type: 'STRING',
    defaultValue: '19001234',
    isPublic: true,
    description: 'Số điện thoại hỗ trợ hiển thị cho khách hàng.',
    effect: 'Có thể đọc qua API cấu hình công khai để frontend/mobile hiển thị.',
    isEffective: false,
  },
  {
    key: 'SUPPORT_EMAIL',
    label: 'Email hỗ trợ',
    group: 'display',
    type: 'STRING',
    defaultValue: 'support@handigo.vn',
    isPublic: true,
    description: 'Email hỗ trợ hiển thị trong các kênh chăm sóc khách hàng.',
    effect: 'Có thể đọc qua API cấu hình công khai để frontend/mobile hiển thị.',
    isEffective: false,
  },
  {
    key: 'MAINTENANCE_MODE',
    label: 'Chế độ bảo trì',
    group: 'operation',
    type: 'BOOLEAN',
    defaultValue: false,
    isPublic: false,
    description: 'Bật khi cần hạn chế một số chức năng trong thời gian bảo trì.',
    effect: 'Chưa nối vào middleware chặn chức năng. Cần bổ sung logic backend nếu muốn dùng.',
    isEffective: false,
  },
  {
    key: 'NOTIFICATION_DEFAULT_DATA',
    label: 'Dữ liệu mặc định cho thông báo',
    group: 'notification',
    type: 'JSON',
    defaultValue: { screen: 'notifications' },
    isPublic: false,
    description: 'JSON mặc định dùng khi gửi thông báo hệ thống.',
    effect: 'Chưa nối vào luồng gửi thông báo. Cần bổ sung logic backend nếu muốn dùng.',
    isEffective: false,
  },
];

const typeOptions: Record<SystemConfigType, { label: string; icon: string }> = {
  STRING: { label: 'Chuỗi', icon: 'text_fields' },
  NUMBER: { label: 'Số', icon: 'tag' },
  BOOLEAN: { label: 'Bật/Tắt', icon: 'toggle_on' },
  JSON: { label: 'JSON', icon: 'data_object' },
};

const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const money = new Intl.NumberFormat('vi-VN');

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
};

const stringifyValue = (value: unknown, type: SystemConfigType) => {
  if (type === 'JSON') return JSON.stringify(value ?? {}, null, 2);
  if (type === 'BOOLEAN') return value ? 'true' : 'false';
  return value == null ? '' : String(value);
};

const parseValue = (type: SystemConfigType, value: string) => {
  if (type === 'STRING') return value;
  if (type === 'BOOLEAN') return value === 'true';
  if (type === 'NUMBER') {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      throw new Error('Giá trị số phải lớn hơn hoặc bằng 0.');
    }
    return numberValue;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Giá trị JSON không hợp lệ.');
  }
};

const formatValue = (value: unknown, type: SystemConfigType, unit?: string) => {
  if (type === 'BOOLEAN') return value ? 'Bật' : 'Tắt';
  if (type === 'JSON') return JSON.stringify(value, null, 2);
  if (type === 'NUMBER') {
    const numberValue = Number(value);
    const formatted = Number.isFinite(numberValue) ? money.format(numberValue) : String(value ?? '');
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return String(value ?? '');
};

const mergeConfigItems = (configs: SystemConfig[]) => {
  const configByKey = new Map(configs.map((config) => [config.key, config]));

  return configDefinitions.map((definition) => {
    const existing = configByKey.get(definition.key) || null;
    return {
      ...definition,
      currentValue: existing ? existing.value : definition.defaultValue,
      existing,
    };
  });
};

export default function AdminSystemConfigsPage() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeGroup, setActiveGroup] = useState<ConfigGroupKey | 'all'>('all');
  const [editing, setEditing] = useState<ConfigItem | null>(null);
  const [form, setForm] = useState<ConfigFormState>({ value: '', isPublic: false });
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query: SystemConfigQuery = {};
      const configs = await systemConfigApi.list(query);
      setItems(mergeConfigItems(configs));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleItems = useMemo(
    () => (activeGroup === 'all' ? items : items.filter((item) => item.group === activeGroup)),
    [activeGroup, items],
  );

  const stats = useMemo(() => {
    const configuredCount = items.filter((item) => item.existing).length;
    const effectiveCount = items.filter((item) => item.isEffective).length;
    const publicCount = items.filter((item) => item.isPublic).length;
    return { configuredCount, effectiveCount, publicCount };
  }, [items]);

  const openEdit = (item: ConfigItem) => {
    setEditing(item);
    setForm({
      value: stringifyValue(item.currentValue, item.type),
      isPublic: item.existing ? item.existing.isPublic : item.isPublic,
    });
    setPendingSave(null);
    setError('');
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    setError('');
    setNotice('');
    try {
      const payload: SystemConfigPayload = {
        key: editing.key,
        value: parseValue(editing.type, form.value),
        type: editing.type,
        description: editing.description,
        isPublic: form.isPublic,
      };
      setPendingSave({ item: editing, payload });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const confirmSave = async () => {
    if (!pendingSave) return;

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { item, payload } = pendingSave;
      if (item.existing) {
        const updatePayload: UpdateSystemConfigPayload = {
          value: payload.value,
          type: payload.type,
          description: payload.description,
          isPublic: payload.isPublic,
        };
        await systemConfigApi.update(item.key, updatePayload);
      } else {
        await systemConfigApi.create(payload);
      }

      setNotice(`Đã lưu cấu hình "${item.label}".`);
      setEditing(null);
      setPendingSave(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-6">
        <header className="flex flex-col gap-3">
          <h1 className="text-headline-lg font-bold text-on-background">Cấu hình hệ thống</h1>
          <p className="max-w-3xl text-on-surface-variant">
            Chọn cấu hình có sẵn và chỉnh giá trị. Admin không cần nhập key thủ công; các cấu hình có nhãn “Đã nối logic” sẽ ảnh hưởng trực tiếp tới nghiệp vụ khi tạo dữ liệu mới.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon="settings" label="Đã thiết lập" value={stats.configuredCount} />
          <Stat icon="bolt" label="Đã nối logic" value={stats.effectiveCount} />
          <Stat icon="public" label="Công khai" value={stats.publicCount} />
        </div>

        {(notice || error) && (
          <div className={`rounded-xl px-4 py-3 ${error ? 'bg-error/10 text-error' : 'bg-emerald-100 text-emerald-700'}`}>
            {error || notice}
          </div>
        )}

        <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm">
          <AsyncState loading={loading} error={error} empty={false} onRetry={load}>
            <div className="grid min-w-0 gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
              <GroupSidebar activeGroup={activeGroup} items={items} onChange={setActiveGroup} />
              <ConfigList items={visibleItems} onEdit={openEdit} />
            </div>
          </AsyncState>
        </section>
      </div>

      <ConfigModal
        item={editing}
        form={form}
        busy={busy}
        onChange={setForm}
        onClose={() => {
          setEditing(null);
          setPendingSave(null);
        }}
        onSubmit={save}
      />

      <SaveConfirmModal
        pendingSave={pendingSave}
        busy={busy}
        onCancel={() => setPendingSave(null)}
        onConfirm={confirmSave}
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
        <p className="text-headline-md font-bold">{value}</p>
      </div>
    </div>
  );
}

function GroupSidebar({
  activeGroup,
  items,
  onChange,
}: {
  activeGroup: ConfigGroupKey | 'all';
  items: ConfigItem[];
  onChange: (group: ConfigGroupKey | 'all') => void;
}) {
  return (
    <aside className="space-y-2">
      {groupOptions.map((group) => {
        const count = group.key === 'all' ? items.length : items.filter((item) => item.group === group.key).length;
        return (
          <button
            key={group.key}
            type="button"
            onClick={() => onChange(group.key)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold ${
              activeGroup === group.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
              <span className="truncate">{group.label}</span>
            </span>
            <span>{count}</span>
          </button>
        );
      })}
    </aside>
  );
}

function ConfigList({ items, onEdit }: { items: ConfigItem[]; onEdit: (item: ConfigItem) => void }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant p-8 text-center text-on-surface-variant">
        Chưa có cấu hình trong nhóm này.
      </div>
    );
  }

  return (
    <div className="divide-y divide-outline-variant/20 overflow-hidden rounded-lg border border-outline-variant/20">
      {items.map((item) => (
        <article
          key={item.key}
          className="grid min-w-0 gap-4 bg-surface-container-lowest p-4 hover:bg-surface-container-low lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)_auto] lg:items-center"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-on-surface">{item.label}</h2>
              <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-xs text-on-surface-variant">
                {item.key}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${item.isEffective ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {item.isEffective ? 'Đã nối logic' : 'Chưa nối logic'}
              </span>
            </div>
            <p className="mt-1 text-sm leading-5 text-on-surface-variant">{item.description}</p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">Hiệu lực: {item.effect}</p>
          </div>

          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                <span className="material-symbols-outlined text-[16px]">{typeOptions[item.type].icon}</span>
                {typeOptions[item.type].label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${item.existing ? 'bg-primary-fixed text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                {item.existing ? 'Đã lưu' : 'Mặc định'}
              </span>
            </div>
            <code className="block max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface">
              {formatValue(item.currentValue, item.type, item.unit)}
            </code>
            {item.existing && (
              <p className="text-xs text-on-surface-variant">
                Cập nhật: {dateTime.format(new Date(item.existing.updatedAt))}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onEdit(item)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Sửa
          </button>
        </article>
      ))}
    </div>
  );
}

function ConfigModal({
  item,
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  item: ConfigItem | null;
  form: ConfigFormState;
  busy: boolean;
  onChange: (form: ConfigFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}) {
  if (!item) return null;

  return (
    <Modal open={Boolean(item)} title={`Sửa ${item.label}`} onClose={onClose} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
          <p className="text-sm text-on-surface-variant">Key hệ thống</p>
          <p className="mt-1 font-mono font-semibold text-on-surface">{item.key}</p>
          <p className="mt-2 text-sm text-on-surface-variant">{item.effect}</p>
        </div>

        <ValueField item={item} form={form} onChange={onChange} />

        <label className="flex items-center justify-between gap-4 rounded-lg bg-surface-container-low p-3">
          <span>
            <span className="block font-semibold">Công khai cho client</span>
            <span className="text-sm text-on-surface-variant">
              Chỉ bật cho dữ liệu hiển thị công khai, không dùng cho cấu hình nghiệp vụ nội bộ.
            </span>
          </span>
          <input
            type="checkbox"
            checked={form.isPublic}
            onChange={(event) => onChange({ ...form, isPublic: event.target.checked })}
            className="h-5 w-5 accent-primary"
          />
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">
            Hủy
          </button>
          <button type="submit" disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
            {busy ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ValueField({
  item,
  form,
  onChange,
}: {
  item: ConfigItem;
  form: ConfigFormState;
  onChange: (form: ConfigFormState) => void;
}) {
  if (item.type === 'BOOLEAN') {
    return (
      <div>
        <span className="mb-2 block text-sm font-semibold">Giá trị</span>
        <button
          type="button"
          onClick={() => onChange({ ...form, value: form.value === 'true' ? 'false' : 'true' })}
          className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
            form.value === 'true'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-outline-variant bg-surface text-on-surface-variant'
          }`}
        >
          <span>
            <span className="block font-semibold">{form.value === 'true' ? 'Đang bật' : 'Đang tắt'}</span>
            <span className="text-sm">Bấm để chuyển trạng thái bật/tắt.</span>
          </span>
          <span className="material-symbols-outlined text-[28px]">
            {form.value === 'true' ? 'toggle_on' : 'toggle_off'}
          </span>
        </button>
      </div>
    );
  }

  if (item.type === 'JSON') {
    return (
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Giá trị JSON</span>
        <textarea
          required
          rows={8}
          value={form.value}
          onChange={(event) => onChange({ ...form, value: event.target.value })}
          className="w-full rounded-xl border border-outline-variant bg-surface p-3 font-mono text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">
        Giá trị{item.unit ? ` (${item.unit})` : ''}
      </span>
      <input
        type={item.type === 'NUMBER' ? 'number' : 'text'}
        min={item.type === 'NUMBER' ? 0 : undefined}
        required
        value={form.value}
        onChange={(event) => onChange({ ...form, value: event.target.value })}
        className="w-full rounded-xl border border-outline-variant bg-surface p-3 text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
      />
      {item.type === 'NUMBER' && form.value && (
        <p className="mt-1 text-xs text-on-surface-variant">
          Giá trị hiển thị: {formatValue(Number(form.value), item.type, item.unit)}
        </p>
      )}
    </label>
  );
}

function SaveConfirmModal({
  pendingSave,
  busy,
  onCancel,
  onConfirm,
}: {
  pendingSave: PendingSave | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!pendingSave) return null;

  const { item, payload } = pendingSave;

  return (
    <Modal open={Boolean(pendingSave)} title="Xác nhận lưu cấu hình" onClose={onCancel} size="md">
      <div className="space-y-4">
        <p className="text-on-surface-variant">
          Cấu hình này sẽ áp dụng cho dữ liệu phát sinh sau khi lưu. Kiểm tra lại giá trị trước khi xác nhận.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <CompareBlock label="Giá trị hiện tại" value={formatValue(item.currentValue, item.type, item.unit)} />
          <CompareBlock label="Giá trị mới" value={formatValue(payload.value, item.type, item.unit)} />
        </div>

        <div className="rounded-lg bg-surface-container-low p-3 text-sm">
          <p><span className="font-semibold">Cấu hình:</span> {item.label}</p>
          <p><span className="font-semibold">Key:</span> <span className="font-mono">{item.key}</span></p>
          <p><span className="font-semibold">Hiệu lực:</span> {item.effect}</p>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl bg-surface-container-high px-5 py-2.5">
            Kiểm tra lại
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-50">
            {busy ? 'Đang lưu...' : 'Xác nhận lưu'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CompareBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-outline-variant/30 p-3">
      <p className="mb-2 text-sm font-semibold text-on-surface">{label}</p>
      <code className="block max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-container-low px-3 py-2 text-sm text-on-surface">
        {value}
      </code>
    </div>
  );
}
