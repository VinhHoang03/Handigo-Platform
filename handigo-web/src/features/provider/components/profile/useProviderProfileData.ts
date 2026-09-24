import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { UserProfileData } from "@/features/profile/types/profile.types";
import { getErrorMessage } from "@/utils/apiError";
import { providerProfileApi } from "../../api/providerProfile.api";
import type {
  ProviderProfile,
  ProviderProfileResponse,
} from "../../types/provider.types";
import {
  buildPerformanceStats,
  buildProviderProfileView,
  buildServiceArea,
  emptyProfessionalForm,
  optional,
  toProfessionalForm,
  toUserProfileData,
  type ProfessionalForm,
} from "../../utils/providerProfilePage";
import { useProviderProfileSave } from "./useProviderProfileSave";

/**
 * Core provider profile state: fetch/save the profile, keep the auth store's
 * cached user in sync, and expose the derived view models used across the
 * page (hero, performance stats, service area).
 */
export function useProviderProfileData(availabilityStatus: string) {
  const [profile, setProfile] = useState<ProviderProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfessional, setIsEditingProfessional] = useState(false);
  const [professionalForm, setProfessionalForm] = useState<ProfessionalForm>(
    emptyProfessionalForm,
  );

  const syncAuthUser = useCallback((nextUser: UserProfileData) => {
    const { user, setUser } = useAuthStore.getState();
    if (!user) return;

    const syncedUser = {
      ...user,
      fullName: nextUser.fullName,
      phone: nextUser.phone || undefined,
      avatar: nextUser.avatar ?? null,
      birthday: nextUser.birthday,
      gender: nextUser.gender,
    };

    const hasChanged =
      user.fullName !== syncedUser.fullName ||
      (user.phone || undefined) !== syncedUser.phone ||
      (user.avatar ?? null) !== syncedUser.avatar ||
      (user.birthday ?? null) !== (syncedUser.birthday ?? null) ||
      (user.gender ?? null) !== (syncedUser.gender ?? null);

    if (hasChanged) setUser(syncedUser);
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await providerProfileApi.getProfile();
      setProfile(nextProfile);
      setProfessionalForm(toProfessionalForm(nextProfile));
      syncAuthUser(toUserProfileData(nextProfile));
    } catch {
      setError("Không thể tải hồ sơ provider.");
    } finally {
      setIsLoading(false);
    }
  }, [syncAuthUser]);

  useEffect(() => {
    // Initial remote loads are intentionally started from this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  const profileView = useMemo<ProviderProfile | null>(
    () => buildProviderProfileView(profile),
    [profile],
  );

  const performanceStats = useMemo(
    () => buildPerformanceStats(profile, availabilityStatus),
    [availabilityStatus, profile],
  );

  const serviceArea = useMemo(() => buildServiceArea(profile), [profile]);

  const { handleUserProfileSave, handleAvatarSave } = useProviderProfileSave({
    profile,
    setProfile,
    setIsSaving,
    setError,
    syncAuthUser,
  });

  async function handleProfessionalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setError(null);
    try {
      const nextProfile = await providerProfileApi.updateProfile({
        bio: optional(professionalForm.bio),
      });

      setProfile(nextProfile);
      setProfessionalForm(toProfessionalForm(nextProfile));
      setIsEditingProfessional(false);
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "Không thể cập nhật hồ sơ nghề nghiệp. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openProfessionalEdit() {
    if (profile) setProfessionalForm(toProfessionalForm(profile));
    setIsEditingProfessional(true);
  }

  return {
    profile,
    setProfile,
    isLoading,
    error,
    setError,
    isSaving,
    setIsSaving,
    professionalForm,
    setProfessionalForm,
    isEditingProfessional,
    setIsEditingProfessional,
    loadProfile,
    profileView,
    performanceStats,
    serviceArea,
    handleUserProfileSave,
    handleAvatarSave,
    handleProfessionalSubmit,
    openProfessionalEdit,
  };
}
