import { useEffect, useState } from 'react';
import { serviceCatalogApi } from '@/features/customer-service/api/serviceCatalog.api';
import type { Service, ServiceOption } from '@/types/booking';
import { bookingPolicyFields, defaultBookingPolicy } from './booking-policy';

const inputClass = 'w-full rounded-lg border border-outline-variant bg-surface p-2 text-on-surface';

export function BookingPolicyFields({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const policy = { ...defaultBookingPolicy, ...JSON.parse(value) } as typeof defaultBookingPolicy;
  const update = (change: Partial<typeof policy>) => onChange(JSON.stringify({ ...policy, ...change }, null, 2));
  const [services, setServices] = useState<Service[]>([]);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      const items: Service[] = [];
      for (let page = 1; ; page++) {
        const data = await serviceCatalogApi.services({ page, limit: 100 });
        items.push(...data.items);
        if (data.items.length < 100) break;
      }
      if (active) setServices(items);
    };
    load().catch(() => { if (active) setError('Không tải được danh mục. Vui lòng đóng và mở lại.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!serviceId) return;
    let active = true;
    serviceCatalogApi.options(serviceId).then((data) => { if (active) setOptions(data); })
      .catch(() => { if (active) setError('Không tải được tùy chọn dịch vụ.'); });
    return () => { active = false; };
  }, [serviceId]);
  const serviceRule = policy.services[serviceId];
  return <div className="space-y-5">
    <p className="text-sm text-on-surface-variant">Giá và thời lượng mới áp dụng cho đơn mới. Giờ làm việc theo múi giờ Việt Nam; 480 = 08:00, 1200 = 20:00. Chưa cấu hình ca riêng thì dùng ca mặc định.</p>
    <div className="grid gap-3 sm:grid-cols-2">{bookingPolicyFields.map(([key, label, min, max]) => <label key={key} className="text-sm">{label}<input className={inputClass} type="number" required min={min} max={max} step={key.endsWith('Percent') ? '0.1' : '1'} value={policy[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} /></label>)}</div>
    <div className="space-y-3 border-t border-outline-variant pt-4">
      <p className="font-semibold">Thời lượng theo dịch vụ và tùy chọn</p>
      {error && <p role="alert" className="text-error">{error}</p>}
      <select aria-label="Dịch vụ cần cấu hình" className={inputClass} value={serviceId} onChange={(event) => { setServiceId(event.target.value); setOptions([]); }}>
        <option value="">Chọn dịch vụ ({services.length})</option>
        {services.map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}
      </select>
      {serviceId && <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Thời lượng công việc (phút)<input className={inputClass} type="number" required min={1} max={1440} value={serviceRule?.durationMinutes ?? policy.defaultDurationMinutes} onChange={(event) => update({ services: { ...policy.services, [serviceId]: { ...serviceRule, durationMinutes: Number(event.target.value) } } })} /></label>
          <label className="text-sm">Thời lượng khảo sát (phút)<input className={inputClass} type="number" required min={1} max={1440} value={serviceRule?.inspectionMinutes ?? policy.inspectionDurationMinutes} onChange={(event) => update({ services: { ...policy.services, [serviceId]: { durationMinutes: serviceRule?.durationMinutes ?? policy.defaultDurationMinutes, inspectionMinutes: Number(event.target.value) } } })} /></label>
        </div>
        <p className="text-xs">Tùy chọn thay thế: lấy thời lượng lớn nhất trong các gói đã chọn. Tùy chọn bổ sung: cộng theo số lượng. Dịch vụ báo giá dùng thời lượng khảo sát.</p>
        {options.map((option) => {
          const rule = policy.options[option._id];
          return <div key={option._id} className="grid gap-2 sm:grid-cols-3">
            <span className="text-sm">{option.name}</span>
            <select aria-label={`Cách tính thời lượng ${option.name}`} className={inputClass} value={rule?.mode ?? ''} onChange={(event) => {
              const next = { ...policy.options };
              if (!event.target.value) delete next[option._id];
              else next[option._id] = { minutes: rule?.minutes ?? 30, mode: event.target.value as 'replace' | 'add' };
              update({ options: next });
            }}><option value="">Không điều chỉnh</option><option value="replace">Thay thế thời lượng chính</option><option value="add">Cộng thêm thời lượng</option></select>
            {rule && <input aria-label={`Số phút ${option.name}`} className={inputClass} type="number" required min={1} max={1440} value={rule.minutes} onChange={(event) => update({ options: { ...policy.options, [option._id]: { ...rule, minutes: Number(event.target.value) } } })} />}
          </div>;
        })}
      </>}
    </div>
    <details><summary className="cursor-pointer font-semibold">Ca và ngày nghỉ riêng của thợ</summary>
      <p className="my-2 text-sm">Cấu hình theo mã hồ sơ thợ. weekly: 0 là Chủ nhật, 1–6 là Thứ hai–Thứ bảy; start/end là phút từ 00:00. Ngày không có ca được xem là nghỉ. absences dùng thời gian ISO có múi giờ. Ví dụ: {'{"MÃ_THỢ":{"weekly":{"1":[{"start":480,"end":1200}]},"absences":[]}}'}</p>
      <CalendarJson value={policy.providerCalendars} onChange={(providerCalendars) => update({ providerCalendars })} />
    </details>
  </div>;
}

function CalendarJson({ value, onChange }: { value: typeof defaultBookingPolicy.providerCalendars; onChange: (value: typeof defaultBookingPolicy.providerCalendars) => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  return <textarea aria-label="Ca và ngày nghỉ riêng của thợ" rows={8} className={inputClass} value={text} onChange={(event) => {
    setText(event.target.value);
    try { const parsed = JSON.parse(event.target.value); event.target.setCustomValidity(''); onChange(parsed); }
    catch { event.target.setCustomValidity('Vui lòng nhập JSON hợp lệ.'); }
  }} />;
}
