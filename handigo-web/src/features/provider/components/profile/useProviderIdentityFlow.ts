import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { getErrorMessage } from "@/utils/apiError";
import { providerProfileApi } from "../../api/providerProfile.api";
import type { ProviderProfileResponse, SubmitIdentityPayload } from "../../types/provider.types";
import {
  documentLast4,
  emptyIdentityForm,
  fillIdentityEmptyFields,
  optional,
  toIdentityForm,
  type IdentityForm,
} from "../../utils/providerProfilePage";

type UseProviderIdentityFlowParams = {
  profile: ProviderProfileResponse | null;
  setProfile: Dispatch<SetStateAction<ProviderProfileResponse | null>>;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  uploadingAsset: string | null;
  setUploadingAsset: Dispatch<SetStateAction<string | null>>;
};

/** CCCD/passport identity document form: modal state, uploads, submit. */
export function useProviderIdentityFlow({
  profile,
  setProfile,
  setIsSaving,
  setUploadingAsset,
}: UseProviderIdentityFlowParams) {
  const [identityForm, setIdentityForm] =
    useState<IdentityForm>(emptyIdentityForm);
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [identityError, setIdentityError] = useState("");

  function openIdentityModal() {
    setIdentityForm(toIdentityForm(profile?.provider.identityDocument));
    setIdentityError("");
    setIsIdentityModalOpen(true);
  }

  async function handleIdentityFileUpload(
    field: "frontImageUrl" | "backImageUrl" | "passportImageUrl",
    file: File,
  ) {
    setUploadingAsset(field);
    setIdentityError("");
    try {
      const documentKind =
        field === "frontImageUrl"
          ? "cccd_front"
          : field === "backImageUrl"
            ? "cccd_back"
            : "passport";
      const uploaded = await providerProfileApi.uploadImage(
        file,
        "identity",
        documentKind,
      );
      setIdentityForm((current) => ({
        ...fillIdentityEmptyFields(current, uploaded.ocrSuggestion),
        [field]: uploaded.url,
      }));
    } catch (uploadError) {
      setIdentityError(
        getErrorMessage(
          uploadError,
          "Không thể upload ảnh giấy tờ. Vui lòng thử lại.",
        ),
      );
    } finally {
      setUploadingAsset(null);
    }
  }

  async function handleIdentitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdentityError("");

    if (!identityForm.documentNumber.trim()) {
      setIdentityError("Vui lòng nhập số giấy tờ.");
      return;
    }

    if (!identityForm.fullName.trim()) {
      setIdentityError("Vui lòng nhập họ tên trên giấy tờ.");
      return;
    }

    if (identityForm.type === "cccd" && !identityForm.frontImageUrl) {
      setIdentityError("Vui lòng upload ảnh mặt trước CCCD.");
      return;
    }

    if (identityForm.type === "passport" && !identityForm.passportImageUrl) {
      setIdentityError("Vui lòng upload ảnh hộ chiếu.");
      return;
    }

    if (!identityForm.consentAccepted) {
      setIdentityError("Vui lòng xác nhận đồng ý xử lý dữ liệu giấy tờ.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: SubmitIdentityPayload = {
        type: identityForm.type,
        documentNumber: optional(identityForm.documentNumber),
        numberLast4: documentLast4(identityForm.documentNumber),
        fullName: optional(identityForm.fullName),
        issuedPlace: optional(identityForm.issuedPlace),
        issuedAt: optional(identityForm.issuedAt),
        expiresAt: optional(identityForm.expiresAt),
        frontImageUrl:
          identityForm.type === "cccd"
            ? optional(identityForm.frontImageUrl)
            : undefined,
        backImageUrl:
          identityForm.type === "cccd"
            ? optional(identityForm.backImageUrl)
            : undefined,
        passportImageUrl:
          identityForm.type === "passport"
            ? optional(identityForm.passportImageUrl)
            : undefined,
        consentAccepted: identityForm.consentAccepted,
      };
      const nextProfile = await providerProfileApi.submitIdentity(payload);

      setProfile(nextProfile);
      setIdentityForm(emptyIdentityForm);
      setIsIdentityModalOpen(false);
    } catch (submitError) {
      setIdentityError(
        getErrorMessage(
          submitError,
          "Không thể gửi giấy tờ xác thực. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return {
    identityForm,
    setIdentityForm,
    isIdentityModalOpen,
    setIsIdentityModalOpen,
    identityError,
    openIdentityModal,
    handleIdentityFileUpload,
    handleIdentitySubmit,
  };
}
