import { useState, type FormEvent } from "react";
import { getErrorMessage } from "@/utils/apiError";
import {
  emptyCertificateForm,
  type CertificateForm,
} from "@/features/provider/utils/providerProfilePage";
import { providerApplicationApi } from "../api/providerApplication.api";

/**
 * Gom trạng thái + thao tác quản lý danh sách chứng chỉ mới trong đơn đăng ký
 * bổ sung dịch vụ. Tách khỏi `ServiceAdditionApplicationDialog` để giữ file
 * dưới 200 dòng — hành vi giữ nguyên 100% so với bản gốc (dùng chung state
 * lỗi với dialog cha qua `setError`).
 */
export function useServiceAdditionCertificates(
  initialCertificates: CertificateForm[],
  setError: (message: string) => void,
) {
  const [certificates, setCertificates] = useState<CertificateForm[]>(initialCertificates);
  const [certificateForm, setCertificateForm] = useState<CertificateForm>({
    ...emptyCertificateForm,
  });
  const [isCertificateFormOpen, setIsCertificateFormOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadCertificate = async (file: File) => {
    try {
      setIsUploading(true);
      setError("");
      const asset = await providerApplicationApi.uploadImage(
        file,
        "certificate",
        "certificate",
      );
      setCertificateForm((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, asset.url],
      }));
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Không thể tải chứng chỉ lên."));
    } finally {
      setIsUploading(false);
    }
  };

  const addCertificate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!certificateForm.title.trim() || !certificateForm.imageUrls.length) {
      setError("Vui lòng nhập tên và tải ít nhất một tệp chứng chỉ.");
      return;
    }
    setCertificates((current) => [...current, { ...certificateForm }]);
    setCertificateForm({ ...emptyCertificateForm, imageUrls: [] });
    setIsCertificateFormOpen(false);
    setError("");
  };

  const removeCertificate = (index: number) => {
    setCertificates((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  return {
    certificates,
    certificateForm,
    isCertificateFormOpen,
    isUploading,
    uploadCertificate,
    addCertificate,
    removeCertificate,
    setCertificateForm,
    setIsCertificateFormOpen,
  };
}
