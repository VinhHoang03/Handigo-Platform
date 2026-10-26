import { useToast, useToastFeedback } from "@/components/common/Toast";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { providerApplicationApi } from "@/features/provider-application/api/providerApplication.api";
import type { ProviderApplication } from "@/features/provider-application/types/providerApplication.types";
import {
  getUserProfile,
  updateUserAvatar,
  updateUserProfile,
} from "@/features/profile/api/userProfile.api";
import { getErrorMessage } from "@/utils/apiError";
import type {
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";
import {
  getProviderBannerMode,
  getProviderBannerStorageKey,
  isValidBannerMode,
  type ProviderBannerMode,
} from "@/features/customer/utils/providerBanner.utils";

/** Tải hồ sơ khách hàng + đơn đăng ký provider, và các thao tác lưu hồ sơ/avatar. */
export function useCustomerProfileData() {
  const { addToast } = useToast();
  const sessionRevision = useAuthStore((state) => state.sessionRevision);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = useCallback(() => mounted.current
    && useAuthStore.getState().sessionRevision === sessionRevision, [sessionRevision]);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [providerApplication, setProviderApplication] =
    useState<ProviderApplication | null>(null);
  const [isProviderApplicationLoading, setIsProviderApplicationLoading] =
    useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useToastFeedback<string>("", "error");
  const [dismissedProviderBanner, setDismissedProviderBanner] =
    useState<ProviderBannerMode | null>(null);

  const syncAuthUser = useCallback((nextProfile: UserProfileData) => {
    const { user, setUser } = useAuthStore.getState();
    if (!isCurrent() || !user || nextProfile.id !== (user.id || user._id)) return;

    const nextUser = {
      ...user,
      fullName: nextProfile.fullName,
      phone: nextProfile.phone || undefined,
      avatar: nextProfile.avatar ?? null,
      birthday: nextProfile.birthday,
      gender: nextProfile.gender,
    };

    const hasChanged =
      user.fullName !== nextUser.fullName ||
      (user.phone || undefined) !== nextUser.phone ||
      (user.avatar ?? null) !== nextUser.avatar ||
      (user.birthday ?? null) !== (nextUser.birthday ?? null) ||
      (user.gender ?? null) !== (nextUser.gender ?? null);

    if (hasChanged) setUser(nextUser);
  }, [isCurrent]);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      const nextProfile = await getUserProfile();
      if (!isCurrent()) return;
      try {
        const dismissedMode = window.localStorage.getItem(
          getProviderBannerStorageKey(nextProfile.id),
        );
        setDismissedProviderBanner(
          isValidBannerMode(dismissedMode) ? dismissedMode : null,
        );
      } catch {
        setDismissedProviderBanner(null);
      }
      setProfile(nextProfile);
      syncAuthUser(nextProfile);
    } catch {
      if (isCurrent()) setErrorMsg("Không tải được hồ sơ. Vui lòng thử lại.");
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [isCurrent, setErrorMsg, syncAuthUser]);

  const loadProviderApplication = useCallback(async () => {
    try {
      const application = await providerApplicationApi.mine();
      if (isCurrent()) setProviderApplication(application);
    } catch {
      if (isCurrent()) setProviderApplication(null);
    } finally {
      if (isCurrent()) setIsProviderApplicationLoading(false);
    }
  }, [isCurrent]);

  useEffect(() => {
    // Initial remote loads are intentionally started from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
    void loadProviderApplication();
  }, [loadProfile, loadProviderApplication]);

  const handleSaveProfile = async (payload: UserProfileFormValue) => {
    if (!isCurrent()) return;
    setIsSaving(true);
    setErrorMsg("");

    try {
      const nextProfile = await updateUserProfile(payload);
      if (!isCurrent()) return;
      setProfile(nextProfile);
      syncAuthUser(nextProfile);
      addToast("Đã cập nhật hồ sơ cá nhân.", "success");
    } catch (error) {
      if (!isCurrent()) return;
      setErrorMsg(
        getErrorMessage(error, "Cập nhật hồ sơ thất bại. Vui lòng thử lại."),
      );
      throw error;
    } finally {
      if (isCurrent()) setIsSaving(false);
    }
  };

  const handleSaveAvatar = async (url: string) => {
    if (!isCurrent()) return;
    setIsSaving(true);
    setErrorMsg("");

    try {
      const nextProfile = await updateUserAvatar(url);
      if (!isCurrent()) return;
      setProfile(nextProfile);
      syncAuthUser(nextProfile);
      addToast("Đã cập nhật hồ sơ cá nhân.", "success");
    } catch (error) {
      if (!isCurrent()) return;
      setErrorMsg(
        getErrorMessage(
          error,
          "Cập nhật ảnh đại diện thất bại. Vui lòng thử lại.",
        ),
      );
      throw error;
    } finally {
      if (isCurrent()) setIsSaving(false);
    }
  };

  const canRegisterProvider =
    String(profile?.role || "").toUpperCase() === "CUSTOMER";
  const providerBannerMode = getProviderBannerMode(providerApplication);
  const showProviderBanner =
    canRegisterProvider &&
    !isProviderApplicationLoading &&
    dismissedProviderBanner !== providerBannerMode;

  const dismissProviderBanner = () => {
    if (!profile) return;
    try {
      window.localStorage.setItem(
        getProviderBannerStorageKey(profile.id),
        providerBannerMode,
      );
    } catch {
      // Trạng thái trong phiên hiện tại vẫn được cập nhật nếu bộ nhớ trình duyệt bị chặn.
    }
    setDismissedProviderBanner(providerBannerMode);
  };

  return {
    profile,
    providerApplication,
    isProviderApplicationLoading,
    isLoading,
    isSaving,
    errorMsg,
    loadProfile,
    handleSaveProfile,
    handleSaveAvatar,
    canRegisterProvider,
    providerBannerMode,
    showProviderBanner,
    dismissProviderBanner,
  };
}
