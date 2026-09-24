import { useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { DashboardShell } from "@/components/common/DashboardShell";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useProviderAvailabilityStore } from "../store/providerAvailability.store";
import {
  buildVerificationItems,
  toUserProfileData,
} from "../utils/providerProfilePage";
import { useProviderProfileData } from "../components/profile/useProviderProfileData";
import { useProviderIdentityFlow } from "../components/profile/useProviderIdentityFlow";
import { useProviderCertificateFlow } from "../components/profile/useProviderCertificateFlow";
import { useProviderServiceAreaFlow } from "../components/profile/useProviderServiceAreaFlow";
import { useProviderPasswordFlow } from "../components/profile/useProviderPasswordFlow";
import { useProviderProfileUiState } from "../components/profile/useProviderProfileUiState";
import { ProviderProfilePageSkeleton } from "../components/profile/ProviderProfilePageSkeleton";
import { ProviderProfileMainGrid } from "../components/profile/ProviderProfileMainGrid";
import { ProviderProfileDialogsGroup } from "../components/profile/ProviderProfileDialogsGroup";

function ProviderProfileContent() {
  const onboardingStatus = useAuthStore(
    (state) => state.user?.providerOnboardingStatus,
  );
  const canReceiveJobs = !onboardingStatus || onboardingStatus === "APPROVED";
  const storedAvailabilityStatus = useProviderAvailabilityStore(
    (state) => state.availabilityStatus,
  );
  const availabilityStatus = canReceiveJobs
    ? storedAvailabilityStatus
    : "offline";
  const userProfileSectionRef = useRef<HTMLDivElement>(null);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);

  const data = useProviderProfileData(availabilityStatus);
  const identity = useProviderIdentityFlow({
    profile: data.profile,
    setProfile: data.setProfile,
    setIsSaving: data.setIsSaving,
    uploadingAsset,
    setUploadingAsset,
  });
  const certificate = useProviderCertificateFlow({
    setProfile: data.setProfile,
    setIsSaving: data.setIsSaving,
    setUploadingAsset,
  });
  const serviceAreaFlow = useProviderServiceAreaFlow({
    profile: data.profile,
    setProfile: data.setProfile,
    setIsSaving: data.setIsSaving,
  });
  const password = useProviderPasswordFlow();
  const ui = useProviderProfileUiState({
    profile: data.profile,
    userProfileSectionRef,
  });

  if (data.isLoading) {
    return (
      <DashboardShell role="PROVIDER">
        <ProviderProfilePageSkeleton />
      </DashboardShell>
    );
  }

  if (data.error || !data.profile || !data.profileView) {
    return (
      <DashboardShell role="PROVIDER">
        <div className="rounded-xl border border-error/20 bg-error/10 p-8 text-center text-error">
          <p>{data.error || "Không thể mở hồ sơ provider."}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-error px-4 py-2 font-bold text-on-error"
            onClick={() => void data.loadProfile()}
          >
            Thử lại
          </button>
        </div>
      </DashboardShell>
    );
  }

  const verificationItems = buildVerificationItems(
    data.profile,
    ui.handlePhoneVerificationClick,
    identity.openIdentityModal,
  );

  return (
    <DashboardShell role="PROVIDER">
      <ProviderProfileMainGrid
        profileView={data.profileView}
        isSaving={data.isSaving}
        onAvatarSave={data.handleAvatarSave}
        performanceStats={data.performanceStats}
        userProfileSectionRef={userProfileSectionRef}
        userProfileData={toUserProfileData(data.profile)}
        error={data.error}
        phoneHighlighted={ui.phoneHighlighted}
        onSaveUserProfile={data.handleUserProfileSave}
        onEditProfessional={data.openProfessionalEdit}
        onRequestServiceAddition={() => ui.openServiceApplication()}
        certificates={data.profile.provider.certificates}
        isCertificateFormOpen={certificate.isCertificateFormOpen}
        certificateForm={certificate.certificateForm}
        certificateError={certificate.certificateError}
        isUploadingCertificate={uploadingAsset === "certificate"}
        onCertificateFormChange={certificate.setCertificateForm}
        onCertificateUpload={(file) =>
          void certificate.handleCertificateFileUpload(file)
        }
        onCertificateSubmit={certificate.handleCertificateSubmit}
        onCertificateCancelForm={certificate.closeCertificateForm}
        onCertificateOpenCreate={certificate.openCreateCertificateForm}
        onCertificateEdit={certificate.openEditCertificateForm}
        onCertificateToggleVisibility={(item) =>
          void certificate.handleCertificateVisibility(item)
        }
        onCertificateDelete={(certificateId) =>
          void certificate.handleDeleteCertificate(certificateId)
        }
        canReceiveJobs={canReceiveJobs}
        verificationItems={verificationItems}
        onPasswordClick={() => password.setIsPwdConfirmOpen(true)}
        serviceArea={data.serviceArea}
        onEditServiceArea={serviceAreaFlow.openServiceAreaEdit}
        applicationHistoryKey={ui.applicationHistoryKey}
        onEditApplication={ui.openServiceApplication}
      />

      <ProviderProfileDialogsGroup
        isEditingProfessional={data.isEditingProfessional}
        professionalForm={data.professionalForm}
        error={data.error}
        isSaving={data.isSaving}
        onProfessionalBioChange={(bio) =>
          data.setProfessionalForm((current) => ({ ...current, bio }))
        }
        onProfessionalClose={() => data.setIsEditingProfessional(false)}
        onProfessionalSubmit={data.handleProfessionalSubmit}
        isServiceApplicationOpen={ui.isServiceApplicationOpen}
        currentServiceIds={data.profile.provider.serviceIds}
        editingServiceApplication={ui.editingServiceApplication}
        onServiceApplicationClose={ui.closeServiceApplication}
        onServiceApplicationSubmitted={ui.bumpApplicationHistoryKey}
        isServiceAreaModalOpen={serviceAreaFlow.isServiceAreaModalOpen}
        workingAreasForm={serviceAreaFlow.workingAreasForm}
        serviceAreaError={serviceAreaFlow.serviceAreaError}
        onServiceAreaChange={serviceAreaFlow.setWorkingAreasForm}
        onServiceAreaClose={() =>
          serviceAreaFlow.setIsServiceAreaModalOpen(false)
        }
        onServiceAreaSave={() => void serviceAreaFlow.handleServiceAreaSave()}
        isIdentityModalOpen={identity.isIdentityModalOpen}
        identityForm={identity.identityForm}
        identityError={identity.identityError}
        uploadingAsset={uploadingAsset}
        onIdentityChange={identity.setIdentityForm}
        onIdentityUpload={(field, file) =>
          void identity.handleIdentityFileUpload(field, file)
        }
        onIdentityClose={() => identity.setIsIdentityModalOpen(false)}
        onIdentitySubmit={identity.handleIdentitySubmit}
        isPwdConfirmOpen={password.isPwdConfirmOpen}
        onPwdConfirmClose={() => password.setIsPwdConfirmOpen(false)}
        onPwdConfirmAccept={() => {
          password.setIsPwdConfirmOpen(false);
          password.setIsPwdModalOpen(true);
        }}
        isPwdModalOpen={password.isPwdModalOpen}
        pwdData={password.pwdData}
        pwdError={password.pwdError}
        pwdMsg={password.pwdMsg}
        isUpdatingPwd={password.isUpdatingPwd}
        onPwdFieldChange={password.handlePasswordFieldChange}
        onPwdModalClose={password.closePasswordModal}
        onPwdSubmit={password.handleUpdatePassword}
      />
    </DashboardShell>
  );
}

export default function ProviderProfilePage() {
  const onboardingStatus = useAuthStore(
    (state) => state.user?.providerOnboardingStatus,
  );

  if (
    onboardingStatus &&
    onboardingStatus !== "APPROVED" &&
    onboardingStatus !== "PENDING_REVIEW"
  ) {
    return <Navigate to="/register-provider" replace />;
  }

  return <ProviderProfileContent />;
}
