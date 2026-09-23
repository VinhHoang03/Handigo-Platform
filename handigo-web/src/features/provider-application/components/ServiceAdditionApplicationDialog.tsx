import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { getErrorMessage } from "@/utils/apiError";
import { providerApplicationApi } from "../api/providerApplication.api";
import type { ProviderApplication } from "../types/providerApplication.types";
import { CategorySelectionStep } from "./CategorySelectionStep";
import { ServiceAdditionCertificatesSection } from "./ServiceAdditionCertificatesSection";
import {
  serviceId,
  toCertificateForm,
  toCertificatePayload,
} from "./serviceAdditionApplicationHelpers";
import { useServiceAdditionCategories } from "./useServiceAdditionCategories";
import { useServiceAdditionCertificates } from "./useServiceAdditionCertificates";

interface Props {
  open: boolean;
  currentServiceIds: string[];
  application?: ProviderApplication | null;
  onClose: () => void;
  onSubmitted: () => void;
}

export function ServiceAdditionApplicationDialog({
  open,
  currentServiceIds,
  application,
  onClose,
  onSubmitted,
}: Props) {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    application?.applicationType === "service_addition"
      ? application.serviceIds.map(serviceId)
      : [],
  );
  const [description, setDescription] = useState(application?.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const {
    certificates,
    certificateForm,
    isCertificateFormOpen,
    isUploading,
    uploadCertificate,
    addCertificate,
    removeCertificate,
    setCertificateForm,
    setIsCertificateFormOpen,
  } = useServiceAdditionCertificates(
    application?.applicationType === "service_addition"
      ? application.certificates.map(toCertificateForm)
      : [],
    setError,
  );
  const { selectableCategories, isLoading } = useServiceAdditionCategories(
    open,
    currentServiceIds,
    setError,
  );

  const toggleService = (id: string) => {
    setSelectedServiceIds((current) =>
      current.includes(id)
        ? current.filter((serviceIdValue) => serviceIdValue !== id)
        : [...current, id],
    );
  };

  const submit = async () => {
    if (!selectedServiceIds.length || !certificates.length) {
      setError("Vui lòng chọn dịch vụ mới và cung cấp ít nhất một chứng chỉ.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      const payload = {
        applicationType: "service_addition" as const,
        description: description.trim() || undefined,
        serviceIds: selectedServiceIds,
        certificates: certificates.map(toCertificatePayload),
      };
      if (application?.status === "rejected") {
        await providerApplicationApi.resubmitServiceAddition(
          application._id,
          payload,
        );
      } else {
        await providerApplicationApi.createServiceAddition(payload);
      }
      onSubmitted();
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Không thể gửi đơn đăng ký dịch vụ."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={application ? "Chỉnh sửa đơn đăng ký dịch vụ" : "Đăng ký thêm dịch vụ"}
      onClose={onClose}
      size="xl"
      closeOnOverlayClick={!isSubmitting}
      closeOnEsc={!isSubmitting}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="font-bold text-on-surface">Dịch vụ chỉ được thêm sau khi admin phê duyệt</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            Chỉ các dịch vụ chưa có trong hồ sơ được hiển thị. Chứng chỉ mới sẽ được xét duyệt cùng đơn này.
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-error/10 p-3 text-sm font-medium text-error">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-surface-container-low" />
        ) : selectableCategories.length ? (
          <CategorySelectionStep
            categories={selectableCategories}
            selectedIds={selectedServiceIds}
            experienceYears={0}
            showExperience={false}
            onToggle={toggleService}
            onExperienceChange={() => undefined}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">
            Bạn đã đăng ký tất cả dịch vụ đang hoạt động.
          </div>
        )}

        <ServiceAdditionCertificatesSection
          certificates={certificates}
          certificateForm={certificateForm}
          isCertificateFormOpen={isCertificateFormOpen}
          isUploading={isUploading}
          onOpenForm={() => setIsCertificateFormOpen(true)}
          onCloseForm={() => setIsCertificateFormOpen(false)}
          onFormChange={setCertificateForm}
          onUpload={(file) => void uploadCertificate(file)}
          onSubmitForm={addCertificate}
          onRemoveCertificate={removeCertificate}
        />

        <label className="block">
          <span className="mb-2 block text-sm font-bold">Ghi chú chuyên môn</span>
          <textarea
            value={description}
            rows={4}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-xl border border-outline-variant/40 bg-surface px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            placeholder="Mô tả kỹ năng mới hoặc quá trình học thêm..."
          />
        </label>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={isSubmitting || !selectedServiceIds.length || !certificates.length}
            onClick={() => void submit()}
          >
            {isSubmitting ? "Đang gửi..." : application ? "Gửi lại đơn" : "Gửi đơn xét duyệt"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
