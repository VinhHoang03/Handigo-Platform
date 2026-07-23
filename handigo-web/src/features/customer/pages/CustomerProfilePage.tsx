import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardShell } from "@/components/common/DashboardShell";
import { Skeleton, SkeletonText } from "@/components/common/Skeleton";
import { AddressBookManager } from "@/features/profile/components/AddressBookManager";
import { UserProfileSection } from "@/features/profile/components/UserProfileSection";
import { ProviderApplicationHistory } from "@/features/provider-application/components/ProviderApplicationHistory";
import { useCustomerProfileData } from "@/features/customer/hooks/useCustomerProfileData";
import { usePasswordChangeModal } from "@/features/customer/hooks/usePasswordChangeModal";
import { ProviderRegistrationBanner } from "@/features/customer/components/ProviderRegistrationBanner";
import {
  ProfileTabsNav,
  type CustomerProfileTab,
} from "@/features/customer/components/ProfileTabsNav";
import { SecurityTabSection } from "@/features/customer/components/SecurityTabSection";
import { NotificationSettingsSection } from "@/features/customer/components/NotificationSettingsSection";
import { PasswordSecurityModals } from "@/features/customer/components/PasswordSecurityModals";

const DEFAULT_AVATAR = undefined;

export default function CustomerProfilePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CustomerProfileTab>("profile");
  const passwordModal = usePasswordChangeModal();

  const {
    profile,
    providerApplication,
    isLoading,
    isSaving,
    errorMsg,
    loadProfile,
    handleSaveProfile,
    handleSaveAvatar,
    providerBannerMode,
    showProviderBanner,
    dismissProviderBanner,
  } = useCustomerProfileData();

  if (isLoading) {
    return (
      <DashboardShell role="CUSTOMER" userAvatar={DEFAULT_AVATAR} hideSidebar>
        <div
          role="status"
          aria-busy="true"
          aria-label="Đang tải hồ sơ"
          className="mx-auto w-full max-w-7xl space-y-6"
        >
          <Skeleton className="h-14 w-full" rounded="rounded-2xl" />
          <div className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 md:p-8">
            <SkeletonText lines={4} />
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!profile) {
    return (
      <DashboardShell role="CUSTOMER" userAvatar={DEFAULT_AVATAR} hideSidebar>
        <div className="rounded-xl border border-error/20 bg-error/10 p-8 text-center text-error">
          <p>{errorMsg || "Không thể mở hồ sơ."}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-error px-4 py-2 font-bold text-on-error"
            onClick={() => void loadProfile()}
          >
            Thử lại
          </button>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="CUSTOMER"
      userAvatar={profile.avatar || profile.avatarUrl || DEFAULT_AVATAR}
      hideSidebar
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {showProviderBanner && (
          <ProviderRegistrationBanner
            mode={providerBannerMode}
            application={providerApplication}
            onDismiss={dismissProviderBanner}
            onNavigateToApplication={() =>
              navigate(
                `/register-provider?applicationId=${providerApplication?._id}`,
              )
            }
            onNavigateToRegister={() => navigate("/register-provider")}
          />
        )}

        <ProfileTabsNav activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "profile" && (
          <UserProfileSection
            user={profile}
            addresses={[]}
            isSaving={isSaving}
            error={errorMsg}
            defaultAvatar={DEFAULT_AVATAR}
            onSaveProfile={handleSaveProfile}
            onSaveAvatar={handleSaveAvatar}
            addressManager={
              <AddressBookManager
                defaultRecipient={{
                  name: profile.fullName,
                  phone: profile.phone || "",
                }}
              />
            }
          />
        )}

        {activeTab === "security" && (
          <SecurityTabSection onPasswordClick={passwordModal.openConfirm} />
        )}

        {activeTab === "profile" && <NotificationSettingsSection />}

        {activeTab === "applications" && (
          <section className="rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm sm:p-6 md:p-8">
            <div className="mb-5">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Hồ sơ đăng ký Provider
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Theo dõi trạng thái, phản hồi xét duyệt và gửi lại hồ sơ bị từ
                chối.
              </p>
            </div>
            <ProviderApplicationHistory
              canEditRejected
              onEdit={(application) =>
                navigate(
                  application.status === "draft"
                    ? "/register-provider"
                    : `/register-provider?applicationId=${application._id}`,
                )
              }
            />
          </section>
        )}
      </div>

      <PasswordSecurityModals
        isConfirmOpen={passwordModal.isPwdConfirmOpen}
        isFormOpen={passwordModal.isPwdModalOpen}
        data={passwordModal.pwdData}
        error={passwordModal.pwdError}
        message={passwordModal.pwdMsg}
        isSaving={passwordModal.isUpdatingPwd}
        onCloseConfirm={passwordModal.closeConfirm}
        onConfirm={passwordModal.confirmAndOpenModal}
        onCloseForm={passwordModal.closePasswordModal}
        onFieldChange={passwordModal.updatePwdField}
        onSubmit={passwordModal.handleUpdatePassword}
      />
    </DashboardShell>
  );
}
