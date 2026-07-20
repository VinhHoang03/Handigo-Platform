import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Pencil } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import { StatusBadge } from "@/components/common/StatusBadge";
import { providerApplicationApi } from "../api/providerApplication.api";
import type {
  ApplicationActor,
  ProviderApplication,
  ProviderApplicationCertificate,
} from "../types/providerApplication.types";

const formatDateTime = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleString("vi-VN");
};

const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
};

const downloadUrl = (url: string) =>
  url.includes("/upload/")
    ? url.replace("/upload/", "/upload/fl_attachment/")
    : url;

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ||
  url.includes("/image/upload/");

const actorName = (actor: ApplicationActor | string | null) =>
  !actor || typeof actor === "string"
    ? "Người dùng hệ thống"
    : actor.fullName || "Người dùng hệ thống";

const actionLabel: Record<string, string> = {
  submitted: "Đã gửi hồ sơ",
  rejected: "Hồ sơ bị từ chối",
  resubmitted: "Đã chỉnh sửa và gửi lại",
  approved: "Hồ sơ được phê duyệt",
};

const applicationTypeLabel: Record<
  ProviderApplication["applicationType"],
  string
> = {
  initial: "Đăng ký trở thành nhà cung cấp dịch vụ",
  service_addition: "Bổ sung dịch vụ mới",
};

const statusLabel: Record<ProviderApplication["status"], string> = {
  draft: "Bản nháp",
  pending: "Chờ duyệt",
  resubmitted: "Gửi lại",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

const getServiceNames = (application: ProviderApplication) =>
  application.serviceIds
    .map((service) => (typeof service === "string" ? "" : service.name))
    .filter(Boolean);

const applicationName = (application: ProviderApplication) => {
  const serviceNames = getServiceNames(application);
  const prefix =
    application.applicationType === "service_addition"
      ? "Đơn bổ sung dịch vụ"
      : "Hồ sơ đăng ký provider";

  return serviceNames.length
    ? `${prefix}: ${serviceNames.slice(0, 2).join(", ")}`
    : prefix;
};

const submittedDate = (application: ProviderApplication) => {
  const firstSubmission = application.reviewHistory?.find((event) =>
    ["submitted", "resubmitted"].includes(event.action),
  )?.occurredAt;

  if (
    application.status === "draft" &&
    !application.submittedAt &&
    !firstSubmission
  ) {
    return null;
  }

  return application.submittedAt || firstSubmission || application.createdAt;
};

const getApplicationSummary = (application: ProviderApplication) => {
  const serviceNames = getServiceNames(application);

  return {
    submitted: submittedDate(application),
    serviceNames,
    typeLabel: applicationTypeLabel[application.applicationType],
  };
};

function DownloadButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={downloadUrl(url)}
      download
      target="_blank"
      rel="noreferrer"
      className="btn-secondary min-h-10 px-3 py-2 text-sm"
    >
      <Download size={16} /> Tải {label}
    </a>
  );
}

function IdentityDetail({ application }: { application: ProviderApplication }) {
  const identity = application.identityDocument;

  if (!identity) {
    return (
      <div className="rounded-lg border border-dashed border-outline-variant/60 p-4 text-sm text-on-surface-variant">
        Hồ sơ chưa có giấy tờ định danh.
      </div>
    );
  }

  const assets = [
    { label: "mặt trước", url: identity.frontImageUrl },
    { label: "mặt sau", url: identity.backImageUrl },
    { label: "hộ chiếu", url: identity.passportImageUrl },
  ].filter((item): item is { label: string; url: string } => Boolean(item.url));

  const genderLabel =
    identity.gender === "male"
      ? "Nam"
      : identity.gender === "female"
        ? "Nữ"
        : identity.gender === "other"
          ? "Khác"
          : "Chưa cập nhật";

  return (
    <section className="space-y-4 rounded-2xl border border-outline-variant/40 p-4">
      <h3 className="font-bold">Thông tin định danh</h3>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <b>Loại:</b> {identity.type === "passport" ? "Hộ chiếu" : "CCCD"}
        </p>
        <p>
          <b>Số giấy tờ:</b> {identity.documentNumber || "Chưa cập nhật"}
        </p>
        <p>
          <b>Họ tên:</b> {identity.fullName || "Chưa cập nhật"}
        </p>
        <p>
          <b>Ngày sinh:</b> {formatDate(identity.dateOfBirth)}
        </p>
        <p>
          <b>Giới tính:</b> {genderLabel}
        </p>
        <p>
          <b>Quốc tịch:</b> {identity.nationality || "Chưa cập nhật"}
        </p>
        <p>
          <b>Quê quán/Nơi sinh:</b>{" "}
          {identity.placeOfOrigin || "Chưa cập nhật"}
        </p>
        <p>
          <b>Nơi thường trú:</b>{" "}
          {identity.placeOfResidence || "Chưa cập nhật"}
        </p>
        <p>
          <b>Ngày cấp:</b> {formatDate(identity.issuedAt)}
        </p>
        <p>
          <b>Nơi cấp:</b> {identity.issuedPlace || "Chưa cập nhật"}
        </p>
        <p>
          <b>Ngày hết hạn:</b> {formatDate(identity.expiresAt)}
        </p>
      </div>

      <div className="rounded-lg bg-surface-container-low p-4">
        <p className="mb-3 text-sm text-on-surface-variant">
          Ảnh giấy tờ được ẩn để bảo vệ thông tin cá nhân. Chỉ tải xuống khi cần
          kiểm tra.
        </p>
        <div className="flex flex-wrap gap-2">
          {assets.map((asset) => (
            <DownloadButton
              key={asset.url}
              url={asset.url}
              label={asset.label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CertificateDetail({
  certificate,
}: {
  certificate: ProviderApplicationCertificate;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-outline-variant/40 p-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>
          <b>Tên:</b> {certificate.title}
        </p>
        <p>
          <b>Số chứng chỉ:</b>{" "}
          {certificate.certificateNumber || "Chưa cập nhật"}
        </p>
        <p>
          <b>Đơn vị cấp:</b> {certificate.issuer || "Chưa cập nhật"}
        </p>
        <p>
          <b>Ngày cấp:</b> {formatDate(certificate.issuedAt)}
        </p>
        <p>
          <b>Ngày hết hạn:</b> {formatDate(certificate.expiresAt)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {certificate.imageUrls.map((url) => (
          <div key={url} className="rounded-lg bg-surface-container-low p-3">
            {isImageUrl(url) ? (
              <img
                src={url}
                alt={certificate.title}
                className="h-36 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-36 items-center justify-center gap-2 text-primary">
                <FileText size={20} /> Tài liệu chứng chỉ
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary min-h-10 px-3 py-2 text-sm"
              >
                Xem
              </a>
              <DownloadButton url={url} label="chứng chỉ" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApplicationDetail({
  application,
}: {
  application: ProviderApplication;
}) {
  const serviceNames = getServiceNames(application).join(", ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-on-surface-variant">Tên hồ sơ đăng ký</p>
          <p className="font-bold">{applicationName(application)}</p>
        </div>
        <StatusBadge value={application.status} />
      </div>

      <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
        {application.applicationType === "service_addition"
          ? "Đăng ký thêm dịch vụ"
          : "Đăng ký trở thành nhà cung cấp dịch vụ"}
      </p>

      {(application.rejectionReason || application.rejectionNotes) && (
        <section className="rounded-2xl border border-error/20 bg-error-container/30 p-4">
          <h3 className="font-bold text-on-error-container">
            Thông tin từ chối gần nhất
          </h3>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <b>Lý do:</b> {application.rejectionReason || "Chưa cập nhật"}
            </p>
            <p>
              <b>Ngày xét duyệt:</b> {formatDateTime(application.reviewedAt)}
            </p>
            <p>
              <b>Người xét duyệt:</b>{" "}
              {application.reviewedBy?.fullName || "Quản trị viên"}
            </p>
            <p className="sm:col-span-2">
              <b>Ghi chú:</b> {application.rejectionNotes || "Chưa cập nhật"}
            </p>
          </div>
        </section>
      )}

      {application.applicationType !== "service_addition" && (
        <IdentityDetail application={application} />
      )}

      <section className="space-y-3">
        <h3 className="font-bold">Chứng chỉ nghề nghiệp</h3>
        {application.certificates.length ? (
          application.certificates.map((certificate, index) => (
            <CertificateDetail
              key={certificate._id || certificate.id || index}
              certificate={certificate}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-outline-variant/60 p-4 text-sm text-on-surface-variant">
            Không có chứng chỉ.
          </div>
        )}
      </section>

      <section className="grid gap-3 rounded-2xl bg-surface-container-low p-4 text-sm sm:grid-cols-2">
        <p>
          <b>Kinh nghiệm:</b> {application.experienceYears} năm
        </p>
        <p>
          <b>Kỹ năng:</b> {serviceNames || "Chưa cập nhật"}
        </p>
        <p>
          <b>Khu vực:</b>{" "}
          {application.workingAreas.join(", ") || "Chưa cập nhật"}
        </p>
        <p className="sm:col-span-2">
          <b>Mô tả:</b> {application.description || "Chưa cập nhật"}
        </p>
      </section>

      <section>
        <h3 className="mb-4 font-bold">Lịch sử xét duyệt</h3>
        <ol className="space-y-0">
          {(application.reviewHistory || []).map((event, index) => (
            <li
              key={`${event.action}-${event.occurredAt}-${index}`}
              className="relative grid grid-cols-[24px_1fr] gap-3 pb-5 last:pb-0"
            >
              {index < (application.reviewHistory?.length || 0) - 1 && (
                <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-outline-variant" />
              )}
              <span className="z-10 mt-1 h-6 w-6 rounded-full border-4 border-surface bg-primary" />
              <div className="rounded-xl bg-surface-container-low p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {actionLabel[event.action] || event.action}
                  </p>
                  <StatusBadge value={event.status} />
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {actorName(event.actorId)} · {formatDateTime(event.occurredAt)}
                </p>
                {event.rejectionReason && (
                  <p className="mt-2 text-sm">
                    <b>Lý do:</b> {event.rejectionReason}
                  </p>
                )}
                {event.notes && (
                  <p className="mt-1 text-sm">
                    <b>Ghi chú:</b> {event.notes}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function ProviderApplicationHistory({
  canEditRejected,
  compact = false,
  hideLastUpdated = false,
  onEdit,
  canEditApplication = () => true,
}: {
  canEditRejected: boolean;
  compact?: boolean;
  hideLastUpdated?: boolean;
  onEdit?: (application: ProviderApplication) => void;
  canEditApplication?: (application: ProviderApplication) => boolean;
}) {
  const [items, setItems] = useState<ProviderApplication[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ProviderApplication | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await providerApplicationApi.history(page, 10);
      setItems(result.items);
      setTotalPages(result.pagination.totalPages || 1);
    } catch {
      setError("Không thể tải lịch sử hồ sơ Provider.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    // Tải dữ liệu từ API khi trang danh sách thay đổi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const openDetail = async (application: ProviderApplication) => {
    setSelected(application);
    try {
      setSelected(await providerApplicationApi.detail(application._id));
    } catch {
      // Bản ghi trong danh sách vẫn đủ để hiển thị thông tin cơ bản.
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl bg-surface-container-low p-6 text-center text-on-surface-variant">
        Đang tải lịch sử hồ sơ...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error/20 bg-error-container/30 p-5 text-center text-on-error-container">
        <p>{error}</p>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => void load()}
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low p-8 text-center text-on-surface-variant">
        Bạn chưa có hồ sơ đăng ký Provider.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`space-y-2.5 ${compact ? "max-w-none" : ""}`}>
        {items.map((application) => {
          const summary = getApplicationSummary(application);
          const submittedText = summary.submitted
            ? formatDate(summary.submitted)
            : "Chưa gửi";

          return (
            <button
              type="button"
              key={application._id}
              className="group block w-full rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 py-3 text-left shadow-sm transition hover:border-primary/25 hover:bg-white hover:shadow-[0_10px_24px_rgba(19,27,46,0.08)]"
              onClick={() => void openDetail(application)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate pr-2 text-sm font-bold text-on-surface sm:text-[15px]">
                    {applicationName(application)}
                  </p>

                  <div className="mt-2 grid gap-x-3 gap-y-1 text-xs text-on-surface-variant sm:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
                    <p className="truncate">{summary.typeLabel}</p>
                    <p className="truncate">{summary.serviceNames.length} dịch vụ</p>
                    <p className="truncate">{submittedText}</p>
                  </div>

                  {!hideLastUpdated && (
                    <p className="mt-1 text-[11px] text-on-surface-variant/80">
                      Cập nhật gần nhất: {formatDate(application.updatedAt)}
                    </p>
                  )}
                </div>

                <div className="shrink-0 pt-0.5">
                  <StatusBadge value={statusLabel[application.status]} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <Modal
        open={Boolean(selected)}
        title="Chi tiết hồ sơ Provider"
        size="lg"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4">
            {canEditRejected &&
              canEditApplication(selected) &&
              ["draft", "rejected"].includes(selected.status) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn-primary min-h-10 px-4 py-2 text-sm"
                    onClick={() => onEdit?.(selected)}
                  >
                    <Pencil size={16} />{" "}
                    {selected.status === "draft"
                      ? "Tiếp tục hồ sơ"
                      : "Sửa và gửi lại"}
                  </button>
                </div>
              )}

            <ApplicationDetail application={selected} />
          </div>
        )}
      </Modal>
    </div>
  );
}
