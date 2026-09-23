import type { Dispatch, SetStateAction } from "react";
import {
  updateUserAvatar,
  updateUserProfile,
} from "@/features/profile/api/userProfile.api";
import type {
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";
import { getErrorMessage } from "@/utils/apiError";
import type { ProviderProfileResponse } from "../../types/provider.types";

type UseProviderProfileSaveParams = {
  profile: ProviderProfileResponse | null;
  setProfile: Dispatch<SetStateAction<ProviderProfileResponse | null>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  syncAuthUser: (nextUser: UserProfileData) => void;
};

/** Saves the shared personal-info form and the avatar, both of which patch
 * the cached provider profile and re-sync the auth store's user. */
export function useProviderProfileSave({
  profile,
  setProfile,
  setIsSaving,
  setError,
  syncAuthUser,
}: UseProviderProfileSaveParams) {
  async function handleUserProfileSave(payload: UserProfileFormValue) {
    setIsSaving(true);
    setError(null);

    try {
      const nextUser = await updateUserProfile(payload);
      setProfile((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                fullName: nextUser.fullName,
                phone: nextUser.phone || undefined,
                avatar: nextUser.avatar ?? null,
                birthday: nextUser.birthday,
                gender: nextUser.gender,
              },
            }
          : current,
      );
      syncAuthUser(nextUser);
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "Không thể cập nhật thông tin cá nhân. Vui lòng thử lại.",
        ),
      );
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarSave(url: string) {
    if (!profile) return;
    setIsSaving(true);
    setError(null);

    try {
      const nextUser = await updateUserAvatar(url);
      setProfile((current) =>
        current
          ? {
              ...current,
              user: {
                ...current.user,
                avatar: nextUser.avatar ?? null,
              },
            }
          : current,
      );
      syncAuthUser(nextUser);
    } catch (saveError) {
      setError(
        getErrorMessage(
          saveError,
          "Không thể cập nhật ảnh đại diện. Vui lòng thử lại.",
        ),
      );
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }

  return { handleUserProfileSave, handleAvatarSave };
}
