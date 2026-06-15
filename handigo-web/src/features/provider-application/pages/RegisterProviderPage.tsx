import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { useProviderApplication } from '../hooks/useProviderApplication';
import type { ProviderApplicationPayload } from '../types/providerApplication.types';

const initial: ProviderApplicationPayload = { description: '', experienceYears: 0, serviceCategoryIds: [], workingAreas: [] };
export default function RegisterProviderPage() {
  const navigate = useNavigate();
  const { categories, loading, submitting, error, submit } = useProviderApplication();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial);
  const [area, setArea] = useState('');
  const [success, setSuccess] = useState('');
  const toggleCategory = (id: string) => setForm((value) => ({ ...value, serviceCategoryIds: value.serviceCategoryIds.includes(id) ? value.serviceCategoryIds.filter((item) => item !== id) : [...value.serviceCategoryIds, id] }));
  const addArea = () => {
    const value = area.trim();
    if (value && !form.workingAreas.includes(value)) setForm({ ...form, workingAreas: [...form.workingAreas, value] });
    setArea('');
  };
  const next = () => {
    if (step === 1 && !form.serviceCategoryIds.length) return;
    if (step === 2 && !form.workingAreas.length) return;
    setStep((value) => Math.min(value + 1, 3));
  };
  const send = async () => {
    await submit(form);
    setSuccess('Hồ sơ đã được gửi và đang chờ quản trị viên xét duyệt.');
    window.setTimeout(() => navigate('/customer/profile'), 1500);
  };
  return (
    <DashboardShell role="CUSTOMER">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6"><h1 className="text-headline-lg font-bold">Đăng ký trở thành thợ</h1><p className="text-on-surface-variant">Hoàn thành 3 bước để gửi hồ sơ chuyên môn.</p></div>
        <div className="mb-6 grid grid-cols-3 gap-2">{[1,2,3].map((value) => <div key={value} className={`h-2 rounded-full ${value <= step ? 'bg-primary' : 'bg-surface-container-high'}`} />)}</div>
        <AsyncState loading={loading} error={error}>
          <div className="glass-card rounded-3xl p-6 md:p-8">
            {step === 1 && <div className="space-y-6"><div><h2 className="text-headline-md font-bold">Lĩnh vực và kinh nghiệm</h2><p className="text-on-surface-variant">Chọn ít nhất một lĩnh vực bạn có thể cung cấp.</p></div><div className="grid gap-3 sm:grid-cols-2">{categories.map((category) => <label key={category._id} className={`cursor-pointer rounded-2xl border p-4 ${form.serviceCategoryIds.includes(category._id) ? 'border-primary bg-primary/5' : 'border-outline-variant'}`}><input type="checkbox" className="mr-3" checked={form.serviceCategoryIds.includes(category._id)} onChange={() => toggleCategory(category._id)} />{category.name}</label>)}</div><label className="block"><span className="mb-2 block font-semibold">Số năm kinh nghiệm</span><input type="number" min={0} max={60} value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })} className="w-full rounded-2xl border border-outline-variant p-3" /></label></div>}
            {step === 2 && <div className="space-y-6"><div><h2 className="text-headline-md font-bold">Khu vực hoạt động</h2><p className="text-on-surface-variant">Nhập quận, huyện hoặc khu vực bạn nhận việc.</p></div><div className="flex gap-2"><input value={area} onChange={(e) => setArea(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArea(); } }} className="flex-1 rounded-2xl border border-outline-variant p-3" placeholder="Ví dụ: Quận 1" /><button onClick={addArea} className="rounded-2xl bg-primary px-5 text-on-primary">Thêm</button></div><div className="flex flex-wrap gap-2">{form.workingAreas.map((item) => <button key={item} onClick={() => setForm({ ...form, workingAreas: form.workingAreas.filter((value) => value !== item) })} className="rounded-full bg-primary/10 px-4 py-2 text-primary">{item} ×</button>)}</div></div>}
            {step === 3 && <div className="space-y-6"><div><h2 className="text-headline-md font-bold">Giới thiệu chuyên môn</h2><p className="text-on-surface-variant">Mô tả kinh nghiệm, thế mạnh và cách bạn phục vụ khách hàng.</p></div><textarea rows={7} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-2xl border border-outline-variant p-4" placeholder="Tôi có kinh nghiệm..." /><div className="rounded-2xl bg-surface-container-low p-4 text-sm"><p><b>Kinh nghiệm:</b> {form.experienceYears} năm</p><p><b>Lĩnh vực:</b> {form.serviceCategoryIds.length}</p><p><b>Khu vực:</b> {form.workingAreas.join(', ')}</p></div></div>}
            {(error || success) && <p className={`mt-5 rounded-xl p-3 ${success ? 'bg-emerald-100 text-emerald-700' : 'bg-error/10 text-error'}`}>{success || error}</p>}
            <div className="mt-8 flex justify-between"><button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="rounded-xl bg-surface-container-high px-6 py-3">{step === 1 ? 'Hủy' : 'Quay lại'}</button>{step < 3 ? <button onClick={next} className="rounded-xl bg-primary px-7 py-3 font-bold text-on-primary">Tiếp tục</button> : <button onClick={send} disabled={submitting || !form.description.trim()} className="rounded-xl bg-primary px-7 py-3 font-bold text-on-primary disabled:opacity-50">{submitting ? 'Đang gửi...' : 'Gửi hồ sơ'}</button>}</div>
          </div>
        </AsyncState>
      </div>
    </DashboardShell>
  );
}
