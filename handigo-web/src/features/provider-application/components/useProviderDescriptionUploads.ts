import { useState, type Dispatch, type SetStateAction } from "react";
import { getErrorMessage } from "@/utils/apiError";
import type {
  OcrDocumentKind,
  ProviderApplicationAssetUpload,
  ProviderApplicationPayload,
} from "../types/providerApplication.types";
import {
  fillCertificateEmptyFields,
  fillIdentityEmptyFields,
} from "./providerDescriptionStepHelpers";

type UploadPurpose = "identity" | "certificate";

/**
 * Gom trạng thái + logic tải giấy tờ/chứng chỉ lên và tự điền OCR cho
 * bước "Giới thiệu và hồ sơ xác thực". Tách khỏi component để giữ file
 * chính dưới 200 dòng, hành vi giữ nguyên 100% so với bản gốc.
 */
export function useProviderDescriptionUploads(
  onChange: Dispatch<SetStateAction<ProviderApplicationPayload>>,
  onUploadAsset: (
    file: File,
    purpose: UploadPurpose,
    documentKind: OcrDocumentKind,
  ) => Promise<ProviderApplicationAssetUpload>,
) {
  const [uploadingKey, setUploadingKey] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [ocrMessages, setOcrMessages] = useState<Record<string, string>>({});

  const uploadIdentity = async (
    key: string,
    kind: Exclude<OcrDocumentKind, "certificate">,
    file: File,
  ) => {
    try {
      setUploadError("");
      setUploadingKey(key);
      const uploaded = await onUploadAsset(file, "identity", kind);
      onChange((current) => {
        const nextIdentity = fillIdentityEmptyFields(
          current.identityDocument,
          uploaded.ocrSuggestion,
        );
        if (kind === "cccd_front") nextIdentity.frontImageUrl = uploaded.url;
        if (kind === "cccd_back") nextIdentity.backImageUrl = uploaded.url;
        if (kind === "passport") nextIdentity.passportImageUrl = uploaded.url;
        return { ...current, identityDocument: nextIdentity };
      });
      const warning = uploaded.ocrSuggestion?.warnings.join(" ");
      setOcrMessages((current) => ({
        ...current,
        [key]:
          warning ||
          "OCR hoàn tất. Bạn có thể kiểm tra và chỉnh sửa thông tin.",
      }));
    } catch (error) {
      setUploadError(getErrorMessage(error, "Không thể tải giấy tờ lên."));
    } finally {
      setUploadingKey("");
    }
  };

  const uploadCertificate = async (index: number, file: File) => {
    const key = `certificate-${index}`;
    try {
      setUploadError("");
      setUploadingKey(key);
      const uploaded = await onUploadAsset(file, "certificate", "certificate");
      onChange((current) => ({
        ...current,
        certificates: current.certificates.map((certificate, currentIndex) => {
          if (currentIndex !== index) return certificate;
          const filled = fillCertificateEmptyFields(
            certificate,
            uploaded.ocrSuggestion,
          );
          return { ...filled, imageUrls: [...filled.imageUrls, uploaded.url] };
        }),
      }));
      const warning = uploaded.ocrSuggestion?.warnings.join(" ");
      setOcrMessages((current) => ({
        ...current,
        [key]:
          warning ||
          "OCR hoàn tất. Bạn có thể kiểm tra và chỉnh sửa thông tin.",
      }));
    } catch (error) {
      setUploadError(getErrorMessage(error, "Không thể tải chứng chỉ lên."));
    } finally {
      setUploadingKey("");
    }
  };

  return { uploadingKey, uploadError, ocrMessages, uploadIdentity, uploadCertificate };
}
