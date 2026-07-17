import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileText, Pencil } from "lucide-react";
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

const applicationName = (application: ProviderApplication) => {
  const serviceNames = application.serviceIds
    .map((service) => typeof service === "string" ? "" : service.name)
    .filter(Boolean);
  const prefix = application.applicationType === "service_addition"
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
  if (application.status === "draft" && !application.submittedAt && !firstSubmission) {
    return null;
  }
  return application.submittedAt || firstSubmission || application.createdAt;
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

  const genderLabel = identity.gender === "male"
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
        <p><b>Loại:</b> {identity.type === "passport" ? "Hộ chiếu" : "CCCD"}</p>
        <p><b>Số giấy tờ:</b> {identity.documentNumber || "Chưa cập nhật"}</p>
        <p><b>Họ tên:</b> {identity.fullName || "Chưa cập nhật"}</p>
        <p><b>Ngày sinh:</b> {formatDate(identity.dateOfBirth)}</p>
        <p><b>Giới tính:</b> {genderLabel}</p>
        <p><b>Quốc tịch:</b> {identity.nationality || "Chưa cập nhật"}</p>
        <p><b>Quê quán/Nơi sinh:</b> {identity.placeOfOrigin || "Chưa cập nhật"}</p>
        <p><b>Nơi thường trú:</b> {identity.placeOfResidence || "Chưa cập nhật"}</p>
        <p><b>Ngày cấp:</b> {formatDate(identity.issuedAt)}</p>
        <p><b>Nơi cấp:</b> {identity.issuedPlace || "Chưa cập nhật"}</p>
        <p><b>Ngày hết hạn:</b> {formatDate(identity.expiresAt)}</p>
      </div>
      <div className="rounded-lg bg-surface-container-low p-4">
        <p className="mb-3 text-sm text-on-surface-variant">
          Ảnh giấy tờ được ẩn để bảo vệ thông tin cá nhân. Chỉ tải xuống khi cần kiểm tra.
        </p>
        <div className="flex flex-wrap gap-2">
          {assets.map((asset) => (
            <DownloadButton key={asset.url} url={asset.url} label={asset.label} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CertificateDetail({ certificate }: { certificate: ProviderApplicationCertificate }) {
  return (
    <div className="space-y-3 rounded-xl border border-outline-variant/40 p-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p><b>Tên:</b> {certificate.title}</p>
        <p><b>Số chứng chỉ:</b> {certificate.certificateNumber || "Chưa cập nhật"}</p>
        <p><b>Đơn vị cấp:</b> {certificate.issuer || "Chưa cập nhật"}</p>
        <p><b>Ngày cấp:</b> {formatDate(certificate.issuedAt)}</p>
        <p><b>Ngày hết hạn:</b> {formatDate(certificate.expiresAt)}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {certificate.imageUrls.map((url) => (
          <div key={url} className="rounded-lg bg-surface-container-low p-3">
            {isImageUrl(url) ? (
              <img src={url} alt={certificate.title} className="h-36 w-full rounded-lg object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center gap-2 text-primary">
                <FileText size={20} /> Tài liệu chứng chỉ
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={url} target="_blank" rel="noreferrer" className="btn-secondary min-h-10 px-3 py-2 text-sm">
                <Eye size={16} /> Xem
              </a>
              <DownloadButton url={url} label="chứng chỉ" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApplicationDetail({ application }: { application: ProviderApplication }) {
  const serviceNames = application.serviceIds
    .map((service) => typeof service === "string" ? service : service.name)
    .join(", ");

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
          : "Đăng ký trở thành provider"}
      </p>

      {(application.rejectionReason || application.rejectionNotes) && (
        <section className="rounded-2xl border border-error/20 bg-error-container/30 p-4">
          <h3 className="font-bold text-on-error-container">Thông tin từ chối gần nhất</h3>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <p><b>Lý do:</b> {application.rejectionReason || "Chưa cập nhật"}</p>
            <p><b>Ngày xét duyệt:</b> {formatDateTime(application.reviewedAt)}</p>
            <p><b>Người xét duyệt:</b> {application.reviewedBy?.fullName || "Quản trị viên"}</p>
            <p className="sm:col-span-2"><b>Ghi chú:</b> {application.rejectionNotes || "Chưa cập nhật"}</p>
          </div>
        </section>
      )}

      {application.applicationType !== "service_addition" && (
        <IdentityDetail application={application} />
      )}

      <section className="space-y-3">
        <h3 className="font-bold">Chứng chỉ nghề nghiệp</h3>
        {application.certificates.length ? application.certificates.map((certificate, index) => (
          <CertificateDetail key={certificate._id || certificate.id || index} certificate={certificate} />
        )) : (
          <div className="rounded-lg border border-dashed border-outline-variant/60 p-4 text-sm text-on-surface-variant">Không có chứng chỉ.</div>
        )}
      </section>

      <section className="grid gap-3 rounded-2xl bg-surface-container-low p-4 text-sm sm:grid-cols-2">
        <p><b>Kinh nghiệm:</b> {application.experienceYears} năm</p>
        <p><b>Kỹ năng:</b> {serviceNames || "Chưa cập nhật"}</p>
        <p><b>Khu vực:</b> {application.workingAreas.join(", ") || "Chưa cập nhật"}</p>
        <p className="sm:col-span-2"><b>Mô tả:</b> {application.description}</p>
      </section>

      <section>
        <h3 className="mb-4 font-bold">Lịch sử xét duyệt</h3>
        <ol className="space-y-0">
          {(application.reviewHistory || []).map((event, index) => (
            <li key={`${event.action}-${event.occurredAt}-${index}`} className="relative grid grid-cols-[24px_1fr] gap-3 pb-5 last:pb-0">
              {index < (application.reviewHistory?.length || 0) - 1 && <span className="absolute left-[11px] top-6 h-[calc(100%-12px)] w-px bg-outline-variant" />}
              <span className="z-10 mt-1 h-6 w-6 rounded-full border-4 border-surface bg-primary" />
              <div className="rounded-xl bg-surface-container-low p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">{actionLabel[event.action] || event.action}</p>
                  <StatusBadge value={event.status} />
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {actorName(event.actorId)} · {formatDateTime(event.occurredAt)}
                </p>
                {event.rejectionReason && <p className="mt-2 text-sm"><b>Lý do:</b> {event.rejectionReason}</p>}
                {event.notes && <p className="mt-1 text-sm"><b>Ghi chú:</b> {event.notes}</p>}
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
  onEdit,
  canEditApplication = () => true,
}: {
  canEditRejected: boolean;
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

  if (loading) return <div className="rounded-xl bg-surface-container-low p-6 text-center text-on-surface-variant">Đang tải lịch sử hồ sơ...</div>;
  if (error) return <div className="rounded-xl border border-error/20 bg-error-container/30 p-5 text-center text-on-error-container"><p>{error}</p><button type="button" className="btn-secondary mt-3" onClick={() => void load()}>Thử lại</button></div>;
  if (!items.length) return <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low p-8 text-center text-on-surface-variant">Bạn chưa có hồ sơ đăng ký Provider.</div>;

  return (
    <div className="space-y-4">
      <div className={canEditRejected ? "hidden overflow-hidden rounded-xl border border-outline-variant/30 md:block" : "hidden"}>
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container text-on-surface-variant"><tr><th className="p-3">Tên hồ sơ đăng ký</th><th className="p-3">Ngày gửi</th><th className="p-3">Cập nhật gần nhất</th><th className="p-3">Trạng thái</th><th className="p-3 text-right">Thao tác</th></tr></thead>
          <tbody>
            {items.map((application) => (
              <tr key={application._id} className="border-t border-outline-variant/30">
                <td className="max-w-64 p-3 font-semibold">{applicationName(application)}</td>
                <td className="p-3">{submittedDate(application) ? formatDate(submittedDate(application)) : "Chưa gửi"}</td>
                <td className="p-3">{formatDate(application.updatedAt)}</td>
                <td className="p-3"><StatusBadge value={application.status} /></td>
                <td className="p-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => void openDetail(application)}><Eye size={15} /> Chi tiết</button>
                    {application.status === "rejected" && (
                      <button type="button" className="btn-secondary min-h-9 px-3 py-1 text-xs" onClick={() => void openDetail(application)}>Xem lý do</button>
                    )}
                    {canEditRejected && canEditApplication(application) && ["draft", "rejected"].includes(application.status) && (
                      <button type="button" className="btn-primary min-h-9 px-3 py-1 text-xs" onClick={() => onEdit?.(application)}><Pencil size={15} /> {application.status === "draft" ? "Tiếp tục" : "Sửa và gửi lại"}</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`space-y-3 ${canEditRejected ? "md:hidden" : ""}`}>
        {items.map((application) => (
          <article key={application._id} className="space-y-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
            <div className="flex items-start justify-between gap-2"><p className="font-bold text-on-surface">{applicationName(application)}</p><StatusBadge value={application.status} /></div>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-container-low p-3 text-sm">
              <div><p className="text-xs text-on-surface-variant">Ngày gửi</p><p className="mt-1 font-medium">{submittedDate(application) ? formatDate(submittedDate(application)) : "Chưa gửi"}</p></div>
              <div><p className="text-xs text-on-surface-variant">Cập nhật gần nhất</p><p className="mt-1 font-medium">{formatDate(application.updatedAt)}</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => void openDetail(application)}><Eye size={16} /> Xem chi tiết</button>
              {application.status === "rejected" && <button type="button" className="btn-secondary flex-1" onClick={() => void openDetail(application)}>Xem lý do</button>}
              {canEditRejected && canEditApplication(application) && ["draft", "rejected"].includes(application.status) && <button type="button" className="btn-primary flex-1" onClick={() => onEdit?.(application)}><Pencil size={16} /> {application.status === "draft" ? "Tiếp tục" : "Sửa và gửi lại"}</button>}
            </div>
          </article>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      <Modal open={Boolean(selected)} title="Chi tiết hồ sơ Provider" size="lg" onClose={() => setSelected(null)}>
        {selected && <ApplicationDetail application={selected} />}
      </Modal>
    </div>
  );
}
