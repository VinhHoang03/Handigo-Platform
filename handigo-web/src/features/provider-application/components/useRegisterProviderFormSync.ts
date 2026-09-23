import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { User } from "@/features/auth/types/auth.types";
import type { useProviderApplication } from "../hooks/useProviderApplication";
import type { ProviderApplicationPayload } from "../types/providerApplication.types";
import { applicationToForm, hasUploadedAsset } from "./registerProviderPageHelpers";

/**
 * Đồng bộ 3 hiệu ứng phụ của trang đăng ký thợ: điều hướng khi hồ sơ đã được
 * duyệt, nạp lại form khi hồ sơ tải xong, và tự lưu nháp khi form thay đổi.
 * Tách khỏi component trang để giữ file chính dưới 200 dòng — hành vi giữ
 * nguyên 100% so với bản gốc.
 */
export function useRegisterProviderFormSync({
  user,
  navigate,
  providerApplication,
  applicationId,
  isDirectProvider,
  step,
  form,
  setForm,
}: {
  user?: User | null;
  navigate: NavigateFunction;
  providerApplication: ReturnType<typeof useProviderApplication>;
  applicationId: string | null;
  isDirectProvider: boolean;
  step: 1 | 2 | 3;
  form: ProviderApplicationPayload;
  setForm: Dispatch<SetStateAction<ProviderApplicationPayload>>;
}) {
  const hydratedApplicationIdRef = useRef<string | null>(null);
  const didHydrateRef = useRef(false);
  const saveDraft = providerApplication.saveDraft;

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
  }, [providerApplication.application, providerApplication.loading, setForm]);

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
}
