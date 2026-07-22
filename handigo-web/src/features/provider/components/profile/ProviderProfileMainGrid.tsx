import type { FormEvent, RefObject } from "react";
import { UserProfileSection } from "@/features/profile/components/UserProfileSection";
import type {
  UserProfileData,
  UserProfileFormValue,
} from "@/features/profile/types/profile.types";
import { ProviderApplicationHistory } from "@/features/provider-application/components/ProviderApplicationHistory";
import type { ProviderApplication } from "@/features/provider-application/types/providerApplication.types";
import { ProviderFeedbackSection } from "../ProviderFeedbackSection";
import {
  ProfessionalSummarySection,
  ProviderCertificatesSection,
} from "../ProviderProfileSections";
import {
  AccountFunctionsPanel,
  PerformanceStats,
  ProfileSection,
  ProviderHero,
  ServiceAreaPanel,
  VerificationPanel,
} from "../ProviderProfileComponents";
import type {
  ProviderCertificate,
  ProviderProfile,
  PerformanceStat,
  ServiceArea,
  VerificationItem,
} from "../../types/provider.types";
import type { CertificateForm } from "../../utils/providerProfilePage";

type VerificationActionItem = VerificationItem & { onClick?: () => void };

export function ProviderProfileMainGrid({
  profileView,
  isSaving,
  onAvatarSave,
  performanceStats,
  userProfileSectionRef,
  userProfileData,
  error,
  phoneHighlighted,
  onSaveUserProfile,
  onEditProfessional,
  onRequestServiceAddition,
  certificates,
  isCertificateFormOpen,
  certificateForm,
  certificateError,
  isUploadingCertificate,
  onCertificateFormChange,
  onCertificateUpload,
  onCertificateSubmit,
  onCertificateCancelForm,
  onCertificateOpenCreate,
  onCertificateEdit,
  onCertificateToggleVisibility,
  onCertificateDelete,
  canReceiveJobs,
  verificationItems,
  onPasswordClick,
  serviceArea,
  onEditServiceArea,
  applicationHistoryKey,
  onEditApplication,
}: {
  profileView: ProviderProfile;
  isSaving: boolean;
  onAvatarSave: (url: string) => Promise<void> | void;
  performanceStats: PerformanceStat[];
  userProfileSectionRef: RefObject<HTMLDivElement | null>;
  userProfileData: UserProfileData;
  error?: string | null;
  phoneHighlighted: boolean;
  onSaveUserProfile: (payload: UserProfileFormValue) => Promise<void>;
  onEditProfessional: () => void;
  onRequestServiceAddition: () => void;
  certificates: ProviderCertificate[];
  isCertificateFormOpen: boolean;
  certificateForm: CertificateForm;
  certificateError?: string;
  isUploadingCertificate: boolean;
  onCertificateFormChange: (form: CertificateForm) => void;
  onCertificateUpload: (file: File) => void;
  onCertificateSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCertificateCancelForm: () => void;
  onCertificateOpenCreate: () => void;
  onCertificateEdit: (certificate: ProviderCertificate) => void;
  onCertificateToggleVisibility: (certificate: ProviderCertificate) => void;
  onCertificateDelete: (certificateId: string) => void;
  canReceiveJobs: boolean;
  verificationItems: VerificationActionItem[];
  onPasswordClick: () => void;
  serviceArea: ServiceArea;
  onEditServiceArea: () => void;
  applicationHistoryKey: number;
  onEditApplication: (application: ProviderApplication) => void;
}) {
  return (
    <div className="grid grid-cols-12 items-start gap-gutter">
      <div className="col-span-12">
        <ProviderHero
          profile={profileView}
          isSaving={isSaving}
          onAvatarSave={onAvatarSave}
        />
      </div>

      <div className="col-span-12">
        <PerformanceStats stats={performanceStats} />
      </div>

      <div className="col-span-12 flex min-w-0 flex-col gap-gutter xl:col-span-7">
        <div ref={userProfileSectionRef} className="[&>section]:!p-6">
          <UserProfileSection
            user={userProfileData}
            isSaving={isSaving}
            error={error || undefined}
            showAvatar={false}
            showAddresses={false}
            highlightPhone={phoneHighlighted}
            onSaveProfile={onSaveUserProfile}
          />
        </div>

        <ProfessionalSummarySection
          bio={profileView.bio}
          experience={profileView.experience}
          skills={profileView.skills}
          onEdit={onEditProfessional}
          onRequestServiceAddition={onRequestServiceAddition}
        />

        <ProviderCertificatesSection
          certificates={certificates}
          isFormOpen={isCertificateFormOpen}
          form={certificateForm}
          error={certificateError}
          isSaving={isSaving}
          isUploading={isUploadingCertificate}
          onFormChange={onCertificateFormChange}
          onUpload={onCertificateUpload}
          onSubmit={onCertificateSubmit}
          onCancelForm={onCertificateCancelForm}
          onOpenCreate={onCertificateOpenCreate}
          onEditCertificate={onCertificateEdit}
          onToggleVisibility={onCertificateToggleVisibility}
          onDeleteCertificate={onCertificateDelete}
        />

        <ProviderFeedbackSection enabled={canReceiveJobs} />
      </div>

      <div className="col-span-12 flex min-w-0 flex-col gap-gutter xl:col-span-5">
        <VerificationPanel items={verificationItems} />
        <AccountFunctionsPanel onPasswordClick={onPasswordClick} />
        <ServiceAreaPanel area={serviceArea} onEdit={onEditServiceArea} />

        <ProfileSection title="Lịch sử đơn/hồ sơ">
          <ProviderApplicationHistory
            key={applicationHistoryKey}
            canEditRejected
            compact
            hideLastUpdated
            canEditApplication={(application) =>
              application.applicationType === "service_addition"
            }
            onEdit={(application) => {
              if (application.applicationType === "service_addition") {
                onEditApplication(application);
              }
            }}
          />
        </ProfileSection>
      </div>
    </div>
  );
}
