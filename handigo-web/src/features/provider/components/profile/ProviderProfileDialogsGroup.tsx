import type { FormEvent } from "react";
import { ServiceAdditionApplicationDialog } from "@/features/provider-application/components/ServiceAdditionApplicationDialog";
import type { ProviderApplication } from "@/features/provider-application/types/providerApplication.types";
import {
  ProfessionalProfileDialog,
} from "../ProviderProfileDialogs";
import {
  ProviderIdentityDialog,
  ProviderPasswordConfirmDialog,
  ProviderPasswordUpdateDialog,
} from "../ProviderProfileSecurityDialogs";
import type {
  IdentityForm,
  PasswordForm,
  ProfessionalForm,
} from "../../utils/providerProfilePage";

export function ProviderProfileDialogsGroup({
  isEditingProfessional,
  professionalForm,
  error,
  isSaving,
  onProfessionalBioChange,
  onProfessionalClose,
  onProfessionalSubmit,
  isServiceApplicationOpen,
  currentServiceIds,
  editingServiceApplication,
  onServiceApplicationClose,
  onServiceApplicationSubmitted,
  isIdentityModalOpen,
  identityForm,
  identityError,
  uploadingAsset,
  onIdentityChange,
  onIdentityUpload,
  onIdentityClose,
  onIdentitySubmit,
  isPwdConfirmOpen,
  onPwdConfirmClose,
  onPwdConfirmAccept,
  isPwdModalOpen,
  pwdData,
  pwdError,
  pwdMsg,
  isUpdatingPwd,
  onPwdFieldChange,
  onPwdModalClose,
  onPwdSubmit,
}: {
  isEditingProfessional: boolean;
  professionalForm: ProfessionalForm;
  error?: string | null;
  isSaving: boolean;
  onProfessionalBioChange: (bio: string) => void;
  onProfessionalClose: () => void;
  onProfessionalSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isServiceApplicationOpen: boolean;
  currentServiceIds: string[];
  editingServiceApplication: ProviderApplication | null;
  onServiceApplicationClose: () => void;
  onServiceApplicationSubmitted: () => void;
  isIdentityModalOpen: boolean;
  identityForm: IdentityForm;
  identityError: string;
  uploadingAsset: string | null;
  onIdentityChange: (form: IdentityForm) => void;
  onIdentityUpload: (
    field: "frontImageUrl" | "backImageUrl" | "passportImageUrl",
    file: File,
  ) => void;
  onIdentityClose: () => void;
  onIdentitySubmit: (event: FormEvent<HTMLFormElement>) => void;
  isPwdConfirmOpen: boolean;
  onPwdConfirmClose: () => void;
  onPwdConfirmAccept: () => void;
  isPwdModalOpen: boolean;
  pwdData: PasswordForm;
  pwdError: string;
  pwdMsg: string;
  isUpdatingPwd: boolean;
  onPwdFieldChange: (field: keyof PasswordForm, value: string) => void;
  onPwdModalClose: () => void;
  onPwdSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <ProfessionalProfileDialog
        open={isEditingProfessional}
        bio={professionalForm.bio}
        error={error || undefined}
        saving={isSaving}
        onBioChange={onProfessionalBioChange}
        onClose={onProfessionalClose}
        onSubmit={onProfessionalSubmit}
      />

      {isServiceApplicationOpen && (
        <ServiceAdditionApplicationDialog
          open
          currentServiceIds={currentServiceIds}
          application={editingServiceApplication}
          onClose={onServiceApplicationClose}
          onSubmitted={onServiceApplicationSubmitted}
        />
      )}


      <ProviderIdentityDialog
        open={isIdentityModalOpen}
        form={identityForm}
        error={identityError}
        isSaving={isSaving}
        uploadingAsset={uploadingAsset}
        onChange={onIdentityChange}
        onUpload={onIdentityUpload}
        onClose={onIdentityClose}
        onSubmit={onIdentitySubmit}
      />

      <ProviderPasswordConfirmDialog
        open={isPwdConfirmOpen}
        onClose={onPwdConfirmClose}
        onConfirm={onPwdConfirmAccept}
      />

      <ProviderPasswordUpdateDialog
        open={isPwdModalOpen}
        data={pwdData}
        error={pwdError}
        message={pwdMsg}
        isSaving={isUpdatingPwd}
        onChange={onPwdFieldChange}
        onClose={onPwdModalClose}
        onSubmit={onPwdSubmit}
      />
    </>
  );
}
