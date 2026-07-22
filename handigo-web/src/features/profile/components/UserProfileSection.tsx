import type { ReactNode } from "react";
import { Pencil, Save, X } from "lucide-react";
import type {
  UserAddress,
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";
import { useUserProfileForm } from "@/features/profile/hooks/useUserProfileForm";
import { ProfileAvatarPanel } from "./ProfileAvatarPanel";
import { ProfileFieldsGroup } from "./ProfileFieldsGroup";
import { SavedAddressesPanel } from "./SavedAddressesPanel";

const DEFAULT_AVATAR = undefined;

interface UserProfileSectionProps {
  user: UserProfileData;
  addresses?: UserAddress[];
  isSaving?: boolean;
  isAddressLoading?: boolean;
  isAddressSaving?: boolean;
  error?: string;
  addressError?: string;
  defaultAvatar?: string;
  showAvatar?: boolean;
  highlightPhone?: boolean;
  showProfile?: boolean;
  showAddresses?: boolean;
  addressManager?: ReactNode;
  onSaveProfile: (payload: UserProfileFormValue) => Promise<void> | void;
  onSaveAvatar?: (url: string) => Promise<void> | void;
  onAddAddress?: () => void;
  onEditAddress?: (address: UserAddress) => void;
  onDeleteAddress?: (address: UserAddress) => Promise<void> | void;
}

export function UserProfileSection({
  user,
  addresses = [],
  isSaving,
  isAddressLoading,
  isAddressSaving,
  error,
  addressError,
  defaultAvatar = DEFAULT_AVATAR,
  showAvatar = true,
  highlightPhone,
  showProfile = true,
  showAddresses = true,
  addressManager,
  onSaveProfile,
  onSaveAvatar,
  onAddAddress,
  onEditAddress,
  onDeleteAddress,
}: UserProfileSectionProps) {
  const {
    isEditing,
    isEmailVisible,
    setIsEmailVisible,
    profileForm,
    localProfileError,
    fieldErrors,
    startEditing,
    cancelEditing,
    updateField,
    handleProfileSubmit,
    handleAvatarSave,
    handleDeleteAddress,
  } = useUserProfileForm({ user, showAvatar, onSaveProfile, onSaveAvatar, onDeleteAddress });

  const avatarSrc = isEditing
    ? profileForm.avatar || user.avatar || user.avatarUrl || defaultAvatar
    : user.avatar || user.avatarUrl || defaultAvatar;

  return (
    <section className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-headline-md text-headline-md text-on-surface">
          {showProfile ? "Thông tin cá nhân" : "Địa chỉ đã lưu"}
        </h3>
        {showProfile && !isEditing && (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            onClick={startEditing}
          >
            <Pencil size={16} />
            Chỉnh sửa hồ sơ
          </button>
        )}
      </div>

      {(error || localProfileError) && (
        <div className="mb-5 rounded-lg bg-error/10 p-3 text-sm font-medium text-error">
          {localProfileError || error}
        </div>
      )}

      <div
        className={
          showProfile && showAddresses
            ? "grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
            : "grid grid-cols-1 gap-7"
        }
      >
        {showProfile && (
          <form onSubmit={handleProfileSubmit} className="min-w-0 space-y-5">
            {showAvatar && (
              <ProfileAvatarPanel
                avatarSrc={avatarSrc}
                fullName={user.fullName}
                isEmailVerified={user.isEmailVerified}
                disabled={isSaving}
                onSave={handleAvatarSave}
              />
            )}

            <ProfileFieldsGroup
              isEditing={isEditing}
              user={user}
              profileForm={profileForm}
              fieldErrors={fieldErrors}
              highlightPhone={highlightPhone}
              isEmailVisible={isEmailVisible}
              onToggleEmailVisible={() => setIsEmailVisible((visible) => !visible)}
              onFieldChange={updateField}
            />

            {isEditing && (
              <div className="flex flex-col justify-end gap-3 border-t border-outline-variant/20 pt-5 sm:flex-row">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSaving}
                  onClick={cancelEditing}
                >
                  <X size={17} />
                  Hủy thay đổi
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  <Save size={17} />
                  {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            )}
          </form>
        )}

        {showAddresses &&
          (addressManager || (
            <SavedAddressesPanel
              addresses={addresses}
              isLoading={isAddressLoading}
              isSaving={isAddressSaving}
              error={addressError}
              onAddAddress={onAddAddress}
              onEditAddress={onEditAddress}
              onDeleteAddress={
                onDeleteAddress
                  ? (item) => {
                      void handleDeleteAddress(item);
                    }
                  : undefined
              }
            />
          ))}
      </div>
    </section>
  );
}
