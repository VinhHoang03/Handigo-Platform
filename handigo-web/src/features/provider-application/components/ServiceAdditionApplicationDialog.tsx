import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal } from "@/components/common/Modal";
import { getErrorMessage } from "@/utils/apiError";
import { CertificateInlineForm } from "@/features/provider/components/ProviderProfileForms";
import {
  emptyCertificateForm,
  type CertificateForm,
} from "@/features/provider/utils/providerProfilePage";
import { providerApplicationApi } from "../api/providerApplication.api";
import type {
  Category,
  ProviderApplication,
  ProviderApplicationCertificate,
} from "../types/providerApplication.types";
import { CategorySelectionStep } from "./CategorySelectionStep";

const serviceId = (service: ProviderApplication["serviceIds"][number]) =>
  typeof service === "string" ? service : service._id;

const toCertificateForm = (
  certificate: ProviderApplicationCertificate,
): CertificateForm => ({
  title: certificate.title,
  issuer: certificate.issuer || "",
  issuedAt: certificate.issuedAt?.slice(0, 10) || "",
  expiresAt: certificate.expiresAt?.slice(0, 10) || "",
  imageUrls: certificate.imageUrls || [],
  description: certificate.description || "",
  isPublic: false,
});

const toCertificatePayload = (
  certificate: CertificateForm,
): ProviderApplicationCertificate => ({
  title: certificate.title.trim(),
  issuer: certificate.issuer.trim() || undefined,
  issuedAt: certificate.issuedAt || undefined,
  expiresAt: certificate.expiresAt || undefined,
  imageUrls: certificate.imageUrls,
  description: certificate.description.trim() || undefined,
});

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() =>
    application?.applicationType === "service_addition"
      ? application.serviceIds.map(serviceId)
      : [],
  );
  const [certificates, setCertificates] = useState<CertificateForm[]>(() =>
    application?.applicationType === "service_addition"
      ? application.certificates.map(toCertificateForm)
      : [],
  );
  const [certificateForm, setCertificateForm] = useState<CertificateForm>({
    ...emptyCertificateForm,
  });
  const [description, setDescription] = useState(application?.description || "");
  const [isCertificateFormOpen, setIsCertificateFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    providerApplicationApi
      .categories()
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError, "Không thể tải danh sách dịch vụ."));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const selectableCategories = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          services: (category.services || []).filter(
            (service) => !currentServiceIds.includes(service._id),
          ),
        }))
        .filter((category) => (category.services || []).length > 0),
    [categories, currentServiceIds],
  );

  const toggleService = (id: string) => {
    setSelectedServiceIds((current) =>
      current.includes(id)
        ? current.filter((serviceIdValue) => serviceIdValue !== id)
        : [...current, id],
    );
  };

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

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-on-surface">Chứng chỉ mới</h3>
              <p className="text-sm text-on-surface-variant">
                Đã thêm {certificates.length} chứng chỉ vào đơn.
              </p>
            </div>
            {!isCertificateFormOpen && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsCertificateFormOpen(true)}
              >
                Thêm chứng chỉ
              </button>
            )}
          </div>

          {isCertificateFormOpen && (
            <CertificateInlineForm
              form={certificateForm}
              isSaving={false}
              uploading={isUploading}
              showVisibility={false}
              onChange={setCertificateForm}
              onUpload={(file) => void uploadCertificate(file)}
              onCancel={() => setIsCertificateFormOpen(false)}
              onSubmit={addCertificate}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {certificates.map((certificate, index) => (
              <article
                key={`${certificate.title}-${index}`}
                className="rounded-xl border border-outline-variant/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{certificate.title}</p>
                    <p className="text-sm text-on-surface-variant">
                      {certificate.issuer || "Chưa cập nhật đơn vị cấp"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-sm font-bold text-error"
                    onClick={() =>
                      setCertificates((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Xóa
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <label className="block">
          <span className="mb-2 block text-sm font-bold">Ghi chú chuyên môn</span>
          <textarea
            value={description}
            rows={4}
            maxLength={2000}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-xl border border-outline-variant/40 bg-white px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
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
