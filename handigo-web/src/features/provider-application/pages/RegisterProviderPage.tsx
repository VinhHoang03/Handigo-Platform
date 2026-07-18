import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { CategorySelectionStep } from "../components/CategorySelectionStep";
import { ProviderApplicationStepper } from "../components/ProviderApplicationStepper";
import { ProviderDescriptionStep } from "../components/ProviderDescriptionStep";
import { WorkingAreasStep } from "../components/WorkingAreasStep";
import { useProviderApplication } from "../hooks/useProviderApplication";
import type {
  ProviderApplication,
  ProviderApplicationPayload,
  Service,
} from "../types/providerApplication.types";
import { hasProviderApplicationDateErrors } from "../utils/providerApplicationValidation";
import { useAuthStore } from "@/features/auth/store/auth.store";

const initial: ProviderApplicationPayload = {
  description: "",
  experienceYears: 2,
  serviceIds: [],
  workingAreas: [],
  identityDocument: {
    type: "cccd",
    documentNumber: "",
    fullName: "",
    issuedPlace: "",
    frontImageUrl: "",
    backImageUrl: "",
    passportImageUrl: "",
    dateOfBirth: "",
    gender: undefined,
    nationality: "",
    placeOfOrigin: "",
    placeOfResidence: "",
  },
  certificates: [],
};

const hasRequiredIdentityImage = (form: ProviderApplicationPayload) =>
  form.identityDocument.type === "cccd"
    ? Boolean(form.identityDocument.frontImageUrl)
    : Boolean(form.identityDocument.passportImageUrl);

const serviceId = (service: string | Service) =>
  typeof service === "string" ? service : service._id;

const applicationToForm = (
  application: ProviderApplication,
): ProviderApplicationPayload => ({
  description: application.description || "",
  experienceYears: application.experienceYears || 0,
  serviceIds: (application.serviceIds || []).map(serviceId).filter(Boolean),
  workingAreas: application.workingAreas || [],
  identityDocument: {
    type: application.identityDocument?.type || "cccd",
    documentNumber: application.identityDocument?.documentNumber || "",
    fullName: application.identityDocument?.fullName || "",
    issuedPlace: application.identityDocument?.issuedPlace || "",
    issuedAt: application.identityDocument?.issuedAt?.slice(0, 10) || "",
    expiresAt: application.identityDocument?.expiresAt?.slice(0, 10) || "",
    frontImageUrl: application.identityDocument?.frontImageUrl || "",
    backImageUrl: application.identityDocument?.backImageUrl || "",
    passportImageUrl: application.identityDocument?.passportImageUrl || "",
    dateOfBirth: application.identityDocument?.dateOfBirth?.slice(0, 10) || "",
    gender: application.identityDocument?.gender,
    nationality: application.identityDocument?.nationality || "",
    placeOfOrigin: application.identityDocument?.placeOfOrigin || "",
    placeOfResidence: application.identityDocument?.placeOfResidence || "",
  },
  certificates: (application.certificates || []).map((certificate) => ({
    title: certificate.title || "",
    certificateNumber: certificate.certificateNumber || "",
    issuer: certificate.issuer || "",
    issuedAt: certificate.issuedAt?.slice(0, 10) || "",
    expiresAt: certificate.expiresAt?.slice(0, 10) || "",
    imageUrls: certificate.imageUrls || [],
  })),
});

const hasUploadedAsset = (form: ProviderApplicationPayload) =>
  Boolean(
    form.identityDocument.frontImageUrl ||
    form.identityDocument.backImageUrl ||
    form.identityDocument.passportImageUrl ||
    form.certificates.some((certificate) => certificate.imageUrls.length),
  );

export default function RegisterProviderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get("applicationId");
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isDirectProvider = user?.role.toUpperCase() === "PROVIDER";
  const providerApplication = useProviderApplication(applicationId);
  const saveDraft = providerApplication.saveDraft;
  const [step, setStep] = useState<1 | 2 | 3>(
    isDirectProvider ? user?.providerOnboardingStep || 1 : 1,
  );
  const [form, setForm] = useState(initial);
  const [success, setSuccess] = useState("");
  const hydratedApplicationIdRef = useRef<string | null>(null);
  const didHydrateRef = useRef(false);

  useEffect(() => {
    if (user?.providerOnboardingStatus === "APPROVED") {
      navigate("/provider", { replace: true });
    }
  }, [navigate, user?.providerOnboardingStatus]);

  useEffect(() => {
    const application = providerApplication.application;
    if (!application || hydratedApplicationIdRef.current === application._id) {
      if (!providerApplication.loading) didHydrateRef.current = true;
      return;
    }

    setForm(applicationToForm(application));
    hydratedApplicationIdRef.current = application._id;
    didHydrateRef.current = true;
  }, [providerApplication.application, providerApplication.loading]);

  useEffect(() => {
    if (
      applicationId ||
      !didHydrateRef.current ||
      providerApplication.application?.status === "pending" ||
      providerApplication.application?.status === "resubmitted" ||
      providerApplication.application?.status === "rejected" ||
      (!isDirectProvider && (step !== 3 || !hasUploadedAsset(form)))
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveDraft({ ...form, onboardingStep: step }).catch(() => {
        // The hook exposes the draft error for rendering.
      });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [
    applicationId,
    form,
    isDirectProvider,
    providerApplication.application?.status,
    saveDraft,
    step,
  ]);

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
          <div className="glass-card rounded-3xl p-6 md:p-8">
            {step === 1 && (
              <CategorySelectionStep
                categories={providerApplication.categories}
                selectedIds={form.serviceIds}
                experienceYears={form.experienceYears}
                onToggle={toggleService}
                onExperienceChange={(experienceYears) =>
                  setForm({ ...form, experienceYears })
                }
              />
            )}
            {step === 2 && (
              <WorkingAreasStep
                areas={form.workingAreas}
                onAdd={addArea}
                onRemove={(value) =>
                  setForm({
                    ...form,
                    workingAreas: form.workingAreas.filter(
                      (item) => item !== value,
                    ),
                  })
                }
              />
            )}
            {step === 3 && (
              <ProviderDescriptionStep
                form={form}
                categories={providerApplication.categories}
                onChange={setForm}
                onUploadAsset={providerApplication.uploadImage}
              />
            )}

            {providerApplication.savingDraft && step === 3 && (
              <p className="mt-5 rounded-2xl bg-surface-container-low p-3 text-sm text-on-surface-variant">
                Đang lưu ảnh và hồ sơ xác thực...
              </p>
            )}

            {(providerApplication.submitError ||
              providerApplication.draftError ||
              success) && (
              <p
                className={`mt-5 rounded-2xl p-3 ${
                  success
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-error/10 text-error"
                }`}
              >
                {success ||
                  providerApplication.submitError ||
                  providerApplication.draftError}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  step === 1 ? navigate(-1) : setStep((step - 1) as 1 | 2)
                }
                className="btn-secondary"
              >
                <ArrowLeft size={18} /> {step === 1 ? "Hủy" : "Quay lại"}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => setStep((step + 1) as 2 | 3)}
                  className="btn-primary"
                >
                  Tiếp tục <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={send}
                  disabled={providerApplication.submitting || !canSubmit}
                  className="btn-primary"
                >
                  <Send size={18} />{" "}
                  {providerApplication.submitting ? "Đang gửi..." : "Gửi hồ sơ"}
                </button>
              )}
            </div>
          </div>
        </AsyncState>
      </div>
    </DashboardShell>
  );
}
