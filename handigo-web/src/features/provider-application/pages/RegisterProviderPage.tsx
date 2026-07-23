import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { ProviderApplicationStepper } from "../components/ProviderApplicationStepper";
import { RegisterProviderStepPanel } from "../components/RegisterProviderStepPanel";
import { useProviderApplication } from "../hooks/useProviderApplication";
import { hasProviderApplicationDateErrors } from "../utils/providerApplicationValidation";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  hasRequiredIdentityImage,
  initialProviderApplicationForm,
} from "../components/registerProviderPageHelpers";
import { useRegisterProviderFormSync } from "../components/useRegisterProviderFormSync";

export default function RegisterProviderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get("applicationId");
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isDirectProvider = user?.role.toUpperCase() === "PROVIDER";
  const providerApplication = useProviderApplication(applicationId);
  const [step, setStep] = useState<1 | 2 | 3>(
    isDirectProvider ? user?.providerOnboardingStep || 1 : 1,
  );
  const [form, setForm] = useState(initialProviderApplicationForm);
  const [success, setSuccess] = useState("");

  useRegisterProviderFormSync({
    user,
    navigate,
    providerApplication,
    applicationId,
    isDirectProvider,
    step,
    form,
    setForm,
  });

  const toggleService = (id: string) =>
    setForm((value) => ({
      ...value,
      serviceIds: value.serviceIds.includes(id)
        ? value.serviceIds.filter((item) => item !== id)
        : [...value.serviceIds, id],
    }));

  const addArea = (area: string) => {
    const value = area.trim();
    if (value && !form.workingAreas.includes(value)) {
      setForm((current) => ({
        ...current,
        workingAreas: [...current.workingAreas, value],
      }));
    }
  };

  const removeArea = (value: string) =>
    setForm((current) => ({
      ...current,
      workingAreas: current.workingAreas.filter((item) => item !== value),
    }));

  const canContinue =
    step === 1
      ? providerApplication.categories.some(
          (category) => (category.services || []).length > 0,
        ) && form.serviceIds.length > 0
      : form.workingAreas.length > 0;

  const canSubmit =
    Boolean(form.description.trim()) &&
    Boolean(form.identityDocument.documentNumber.trim()) &&
    Boolean(form.identityDocument.fullName.trim()) &&
    hasRequiredIdentityImage(form) &&
    !hasProviderApplicationDateErrors(form);

  const send = async () => {
    try {
      await providerApplication.submit(form);
      setSuccess(
        applicationId
          ? "Hồ sơ đã được gửi lại và đang chờ quản trị viên xét duyệt."
          : "Hồ sơ đã được gửi và đang chờ quản trị viên xét duyệt.",
      );
      if (isDirectProvider && user) {
        setUser({
          ...user,
          providerOnboardingStatus: "PENDING_REVIEW",
          providerOnboardingStep: 3,
        });
        navigate("/provider/profile", { replace: true });
      } else {
        window.setTimeout(() => navigate("/customer/profile"), 1500);
      }
    } catch {
      // The hook exposes the request error for rendering.
    }
  };

  const isWaitingForReview =
    user?.providerOnboardingStatus === "PENDING_REVIEW" ||
    providerApplication.application?.status === "pending" ||
    providerApplication.application?.status === "resubmitted";

  if (isDirectProvider && isWaitingForReview) {
    return <Navigate to="/provider/profile" replace />;
  }

  return (
    <DashboardShell role="CUSTOMER">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Đăng ký thợ
          </p>
          <h1 className="mt-2 text-headline-lg font-bold">
            Trở thành thợ dịch vụ
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Hoàn thành 3 bước để gửi hồ sơ chuyên môn.
          </p>
        </div>

        <ProviderApplicationStepper step={step} />

        {providerApplication.application?.status === "rejected" && (
          <section className="rounded-2xl border border-error/20 bg-error-container/30 p-4 text-on-error-container">
            <h2 className="font-bold">Nội dung cần chỉnh sửa</h2>
            <p className="mt-2">
              <b>Lý do:</b> {providerApplication.application.rejectionReason}
            </p>
            <p className="mt-1">
              <b>Ghi chú của quản trị viên:</b>{" "}
              {providerApplication.application.rejectionNotes ||
                "Chưa cập nhật"}
            </p>
          </section>
        )}

        <AsyncState
          loading={providerApplication.loading}
          error={providerApplication.loadError}
          onRetry={providerApplication.loadCategories}
        >
          <RegisterProviderStepPanel
            step={step}
            form={form}
            categories={providerApplication.categories}
            onFormChange={setForm}
            onToggleService={toggleService}
            onExperienceChange={(experienceYears) =>
              setForm({ ...form, experienceYears })
            }
            onAddArea={addArea}
            onRemoveArea={removeArea}
            onUploadAsset={providerApplication.uploadImage}
            savingDraft={providerApplication.savingDraft}
            submitError={providerApplication.submitError}
            draftError={providerApplication.draftError}
            success={success}
            canContinue={canContinue}
            canSubmit={canSubmit}
            submitting={providerApplication.submitting}
            onBack={() =>
              step === 1 ? navigate(-1) : setStep((step - 1) as 1 | 2)
            }
            onNext={() => setStep((step + 1) as 2 | 3)}
            onSubmit={() => void send()}
          />
        </AsyncState>
      </div>
    </DashboardShell>
  );
}
