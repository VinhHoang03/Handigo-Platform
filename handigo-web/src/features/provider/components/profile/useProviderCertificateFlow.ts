import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { getErrorMessage } from "@/utils/apiError";
import { providerProfileApi } from "../../api/providerProfile.api";
import type {
  ProviderCertificate,
  ProviderProfileResponse,
} from "../../types/provider.types";
import {
  emptyCertificateForm,
  optional,
  toCertificateForm,
  type CertificateForm,
} from "../../utils/providerProfilePage";

type UseProviderCertificateFlowParams = {
  setProfile: Dispatch<SetStateAction<ProviderProfileResponse | null>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  setUploadingAsset: Dispatch<SetStateAction<string | null>>;
};

/** Certificate CRUD: create/edit form state, upload, visibility, delete. */
export function useProviderCertificateFlow({
  setProfile,
  setIsSaving,
  setUploadingAsset,
}: UseProviderCertificateFlowParams) {
  const [certificateForm, setCertificateForm] =
    useState<CertificateForm>(emptyCertificateForm);
  const [isCertificateFormOpen, setIsCertificateFormOpen] = useState(false);
  const [certificateError, setCertificateError] = useState("");

  function openCreateCertificateForm() {
    setCertificateForm(emptyCertificateForm);
    setCertificateError("");
    setIsCertificateFormOpen(true);
  }

  function openEditCertificateForm(certificate: ProviderCertificate) {
    setCertificateForm(toCertificateForm(certificate));
    setCertificateError("");
    setIsCertificateFormOpen(true);
  }

  function closeCertificateForm() {
    setCertificateForm(emptyCertificateForm);
    setCertificateError("");
    setIsCertificateFormOpen(false);
  }

  async function handleCertificateFileUpload(file: File) {
    setUploadingAsset("certificate");
    setCertificateError("");
    try {
      const uploaded = await providerProfileApi.uploadImage(
        file,
        "certificate",
      );
      setCertificateForm((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, uploaded.url],
      }));
    } catch (uploadError) {
      setCertificateError(
        getErrorMessage(
          uploadError,
          "Không thể upload chứng chỉ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setUploadingAsset(null);
    }
  }

  async function handleCertificateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCertificateError("");

    if (!certificateForm.title.trim()) {
      setCertificateError("Vui lòng nhập tên chứng chỉ.");
      return;
    }

    if (certificateForm.imageUrls.length === 0) {
      setCertificateError(
        "Vui lòng upload ít nhất một ảnh hoặc tài liệu chứng chỉ.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: certificateForm.title.trim(),
        issuer: optional(certificateForm.issuer),
        issuedAt: optional(certificateForm.issuedAt),
        expiresAt: optional(certificateForm.expiresAt),
        imageUrls: certificateForm.imageUrls,
        description: optional(certificateForm.description),
        isPublic: certificateForm.isPublic,
      };

      const nextProfile = certificateForm.id
        ? await providerProfileApi.updateCertificate(
            certificateForm.id,
            payload,
          )
        : await providerProfileApi.createCertificate(payload);

      setProfile(nextProfile);
      setCertificateForm(emptyCertificateForm);
      setIsCertificateFormOpen(false);
    } catch (submitError) {
      setCertificateError(
        getErrorMessage(submitError, "Không thể lưu chứng chỉ. Vui lòng thử lại."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCertificate(certificateId: string) {
    const confirmed = window.confirm("Xóa chứng chỉ này?");
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const nextProfile =
        await providerProfileApi.deleteCertificate(certificateId);
      setProfile(nextProfile);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCertificateVisibility(certificate: ProviderCertificate) {
    setIsSaving(true);
    try {
      const nextProfile = await providerProfileApi.updateCertificate(
        certificate.id,
        { isPublic: !certificate.isPublic },
      );
      setProfile(nextProfile);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    certificateForm,
    setCertificateForm,
    isCertificateFormOpen,
    certificateError,
    openCreateCertificateForm,
    openEditCertificateForm,
    closeCertificateForm,
    handleCertificateFileUpload,
    handleCertificateSubmit,
    handleDeleteCertificate,
    handleCertificateVisibility,
  };
}
