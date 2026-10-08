import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { User } from "@/features/auth/types/auth.types";
import type { useProviderApplication } from "../hooks/useProviderApplication";
import type { ProviderApplication, ProviderApplicationPayload } from "../types/providerApplication.types";
import { applicationToForm, initialProviderApplicationForm } from "./registerProviderPageHelpers";
import {
  clearProviderApplicationDraft,
  providerApplicationDraftKey,
  readProviderApplicationDraft,
  writeProviderApplicationDraft,
} from "../utils/providerApplicationDraftStorage";

/**
 * Đồng bộ 3 hiệu ứng phụ của trang đăng ký thợ: điều hướng khi hồ sơ đã được
 * duyệt, nạp lại form khi hồ sơ tải xong, và tự lưu nháp khi form thay đổi.
 * Giữ bản đang chỉnh sửa trong phiên và lưu nháp lên máy chủ khi được phép.
 */
export function useRegisterProviderFormSync({
  user,
  navigate,
  providerApplication,
  step,
  form,
  setForm,
  setStep,
}: {
  user?: User | null;
  navigate: NavigateFunction;
  providerApplication: ReturnType<typeof useProviderApplication>;
  step: 1 | 2 | 3;
  form: ProviderApplicationPayload;
  setForm: Dispatch<SetStateAction<ProviderApplicationPayload>>;
  setStep: Dispatch<SetStateAction<1 | 2 | 3>>;
}) {
  const [hydratedSource, setHydratedSource] = useState<{
    key: string;
    application: ProviderApplication | null;
  }>();
  const [localDraftError, setLocalDraftError] = useState("");
  const loadedApplication = providerApplication.loadedApplication;
  const sourceVersion = loadedApplication?.status === "rejected"
    ? loadedApplication.updatedAt : null;
  const draftKey = providerApplicationDraftKey(
    user?.id || user?._id || "",
    loadedApplication?.status === "rejected" ? loadedApplication._id : undefined,
  );
  const saveDraft = providerApplication.saveDraft;
  const hydrated = hydratedSource?.key === draftKey && hydratedSource.application === loadedApplication;

  useEffect(() => {
    if (user?.providerOnboardingStatus === "APPROVED") {
      navigate("/provider", { replace: true });
    }
  }, [navigate, user?.providerOnboardingStatus]);

  useEffect(() => {
    if (providerApplication.loading || providerApplication.loadError) return;
    const timer = window.setTimeout(() => {
      const editable = !loadedApplication || ["draft", "rejected"].includes(loadedApplication.status);
      const draft = editable ? readProviderApplicationDraft(draftKey, sourceVersion) : null;
      setForm(draft || (loadedApplication ? applicationToForm(loadedApplication) : initialProviderApplicationForm));
      if (draft?.onboardingStep && [1, 2, 3].includes(draft.onboardingStep)) {
        setStep(draft.onboardingStep);
      }
      setHydratedSource({ key: draftKey, application: loadedApplication });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadedApplication, providerApplication.loading, providerApplication.loadError, draftKey, sourceVersion, setForm, setStep]);

  useEffect(() => {
    if (!hydrated || providerApplication.loading || providerApplication.loadError) return;
    const status = providerApplication.application?.status;
    if (status && !["draft", "rejected"].includes(status)) {
      clearProviderApplicationDraft(draftKey);
      clearProviderApplicationDraft(providerApplicationDraftKey(user?.id || user?._id || ""));
      return;
    }
    const saved = writeProviderApplicationDraft(draftKey, {
      form: { ...form, onboardingStep: step }, sourceVersion,
    });
    const errorTimer = window.setTimeout(() => setLocalDraftError(saved ? "" :
      "Không thể lưu bản chỉnh sửa trong trình duyệt. Vui lòng giữ trang mở đến khi gửi hồ sơ."), 0);
    if (status === "rejected" || providerApplication.submitting) {
      return () => window.clearTimeout(errorTimer);
    }
    const timeout = window.setTimeout(() => {
      void saveDraft({ ...form, onboardingStep: step }).catch(() => {
        // Hook hiển thị lỗi; bản chỉnh sửa vẫn được giữ trong phiên.
      });
    }, 700);
    return () => {
      window.clearTimeout(errorTimer);
      window.clearTimeout(timeout);
    };
  }, [
    hydrated,
    draftKey,
    sourceVersion,
    user?.id,
    user?._id,
    form,
    providerApplication.loading,
    providerApplication.loadError,
    providerApplication.submitting,
    providerApplication.application?.status,
    saveDraft,
    step,
  ]);
  return { localDraftError, formReady: hydrated };
}
