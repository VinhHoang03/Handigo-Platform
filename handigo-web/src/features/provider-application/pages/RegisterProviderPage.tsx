import { useState } from 'react';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { CategorySelectionStep } from '../components/CategorySelectionStep';
import { ProviderApplicationStepper } from '../components/ProviderApplicationStepper';
import { ProviderDescriptionStep } from '../components/ProviderDescriptionStep';
import { WorkingAreasStep } from '../components/WorkingAreasStep';
import { useProviderApplication } from '../hooks/useProviderApplication';
import type { ProviderApplicationPayload } from '../types/providerApplication.types';

const initial: ProviderApplicationPayload = {
  description: '',
  experienceYears: 2,
  serviceIds: [],
  workingAreas: [],
};

export default function RegisterProviderPage() {
  const navigate = useNavigate();
  const providerApplication = useProviderApplication();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initial);
  const [success, setSuccess] = useState('');

  const toggleService = (id: string) => setForm((value) => ({
    ...value,
    serviceIds: value.serviceIds.includes(id)
      ? value.serviceIds.filter((item) => item !== id)
      : [...value.serviceIds, id],
  }));

  const addArea = (area: string) => {
    const value = area.trim();
    if (value && !form.workingAreas.includes(value)) {
      setForm((current) => ({ ...current, workingAreas: [...current.workingAreas, value] }));
    }
  };

  const canContinue = step === 1
    ? providerApplication.categories.some((category) => (category.services || []).length > 0) && form.serviceIds.length > 0
    : form.workingAreas.length > 0;

  const send = async () => {
    try {
      await providerApplication.submit(form);
      setSuccess('Hồ sơ đã được gửi và đang chờ quản trị viên xét duyệt.');
      window.setTimeout(() => navigate('/customer/profile'), 1500);
    } catch {
      // The hook exposes the request error for rendering.
    }
  };

  return (
    <DashboardShell role="CUSTOMER">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Đăng ký thợ</p>
          <h1 className="mt-2 text-headline-lg font-bold">Trở thành thợ dịch vụ</h1>
          <p className="mt-1 text-on-surface-variant">
            Hoàn thành 3 bước để gửi hồ sơ chuyên môn.
          </p>
        </div>

        <ProviderApplicationStepper step={step} />

        <AsyncState
          loading={providerApplication.loading}
          error={providerApplication.loadError}
          onRetry={providerApplication.loadCategories}
        >
          <div className="glass-card rounded-3xl p-6 md:p-8">
            {step === 1 && (
              <CategorySelectionStep
                categories={providerApplication.categories}
                selectedIds={form.serviceIds}
                experienceYears={form.experienceYears}
                onToggle={toggleService}
                onExperienceChange={(experienceYears) => setForm({ ...form, experienceYears })}
              />
            )}
            {step === 2 && (
              <WorkingAreasStep
                areas={form.workingAreas}
                onAdd={addArea}
                onRemove={(value) => setForm({
                  ...form,
                  workingAreas: form.workingAreas.filter((item) => item !== value),
                })}
              />
            )}
            {step === 3 && (
              <ProviderDescriptionStep
                form={form}
                categories={providerApplication.categories}
                onChange={(description) => setForm({ ...form, description })}
              />
            )}

            {(providerApplication.submitError || success) && (
              <p className={`mt-5 rounded-2xl p-3 ${success ? 'bg-emerald-100 text-emerald-700' : 'bg-error/10 text-error'}`}>
                {success || providerApplication.submitError}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
                className="btn-secondary"
              >
                <ArrowLeft size={18} /> {step === 1 ? 'Hủy' : 'Quay lại'}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setStep(step + 1)}
                  className="btn-primary"
                >
                  Tiếp tục <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={send}
                  disabled={providerApplication.submitting || !form.description.trim()}
                  className="btn-primary"
                >
                  <Send size={18} /> {providerApplication.submitting ? 'Đang gửi...' : 'Gửi hồ sơ'}
                </button>
              )}
            </div>
          </div>
        </AsyncState>
      </div>
    </DashboardShell>
  );
}
