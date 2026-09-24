import { useCallback, useEffect, useState } from "react";
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
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [providerApplication, setProviderApplication] =
    useState<ProviderApplication | null>(null);
  const [isProviderApplicationLoading, setIsProviderApplicationLoading] =
    useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dismissedProviderBanner, setDismissedProviderBanner] =
    useState<ProviderBannerMode | null>(null);

  const syncAuthUser = useCallback((nextProfile: UserProfileData) => {
    const { user, setUser } = useAuthStore.getState();
    if (!user) return;

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
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      const nextProfile = await getUserProfile();
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
      setErrorMsg("Không tải được hồ sơ. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  }, [syncAuthUser]);

  const loadProviderApplication = useCallback(async () => {
    try {
      setProviderApplication(await providerApplicationApi.mine());
    } catch {
      setProviderApplication(null);
    } finally {
      setIsProviderApplicationLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial remote loads are intentionally started from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
    void loadProviderApplication();
  }, [loadProfile, loadProviderApplication]);

  const handleSaveProfile = async (payload: UserProfileFormValue) => {
    setIsSaving(true);
    setErrorMsg("");

    try {
      const nextProfile = await updateUserProfile(payload);
      setProfile(nextProfile);
      syncAuthUser(nextProfile);
    } catch (error) {
      setErrorMsg(
        getErrorMessage(error, "Cập nhật hồ sơ thất bại. Vui lòng thử lại."),
      );
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAvatar = async (url: string) => {
    setIsSaving(true);
    setErrorMsg("");

    try {
      const nextProfile = await updateUserAvatar(url);
      setProfile(nextProfile);
      syncAuthUser(nextProfile);
    } catch (error) {
      setErrorMsg(
        getErrorMessage(
          error,
          "Cập nhật ảnh đại diện thất bại. Vui lòng thử lại.",
        ),
      );
      throw error;
    } finally {
      setIsSaving(false);
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
