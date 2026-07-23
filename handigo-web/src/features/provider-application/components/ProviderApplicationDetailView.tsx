import { StatusBadge } from "@/components/common/StatusBadge";
import type { ProviderApplication } from "../types/providerApplication.types";
import { CertificateDetail } from "./ProviderApplicationCertificateDetail";
import { IdentityDetail } from "./ProviderApplicationIdentityDetail";
import {
  actionLabel,
  actorName,
  applicationName,
  formatDateTime,
  getServiceNames,
} from "./providerApplicationHistoryHelpers";

export function ApplicationDetail({
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
