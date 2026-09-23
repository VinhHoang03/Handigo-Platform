import { Modal } from "@/components/common/Modal";
import type { AdminApplication } from "../../types/admin.types";
import { ApplicationReviewActions } from "./ApplicationReviewActions";
import { ApplicationReviewHistory } from "./ApplicationReviewHistory";
import { CertificateSection } from "./CertificateSection";
import { IdentitySection } from "./IdentitySection";

interface ApplicationDetailModalProps {
  application: AdminApplication | null;
  busy: boolean;
  onApprove: () => void;
  onReject: (reason: string, notes: string) => void;
  onClose: () => void;
}

export function ApplicationDetailModal({ application, busy, onApprove, onReject, onClose }: ApplicationDetailModalProps) {
  const isServiceAddition = application?.applicationType === "service_addition";

  return (
    <Modal open={Boolean(application)} title="Chi tiết hồ sơ thợ" onClose={onClose} size="lg">
      {application && (
        <div className="space-y-6">
          <section className="space-y-2">
            <p className="text-headline-md font-bold text-on-surface">
              {application.userId?.fullName || "Tài khoản không còn tồn tại"}
            </p>
            <p className="text-sm text-on-surface-variant">
              {application.userId?.email || "Không còn thông tin tài khoản"} · {application.userId?.phone || "Chưa có SĐT"}
            </p>
          </section>

          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Loại đơn</p>
            <p className="mt-2 text-base font-semibold text-on-surface">
              {isServiceAddition ? "Đăng ký bổ sung dịch vụ mới" : "Đăng ký từ customer lên provider"}
            </p>
            {isServiceAddition && (
              <p className="mt-2 text-sm text-on-surface-variant">
                ℹ️ Khi duyệt, hệ thống chỉ cộng thêm các dịch vụ và chứng chỉ trong đơn, không ghi đè hồ sơ hiện tại.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-on-surface-variant">
              {isServiceAddition ? "Dịch vụ đề nghị bổ sung" : "Dịch vụ"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {application.serviceIds.map((item) => (
                <span key={item._id} className="inline-flex rounded-full bg-secondary/10 px-3 py-1.5 text-sm font-semibold text-secondary">
                  {item.name}
                </span>
              ))}
            </div>
          </section>

          {!isServiceAddition && (
            <div className="grid gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Kinh nghiệm</p>
                <p className="mt-2 text-headline-md font-bold text-primary">{application.experienceYears}+</p>
                <p className="text-xs text-on-surface-variant">năm hoạt động</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">Khu vực hoạt động</p>
                <p className="mt-2 text-sm font-semibold text-on-surface">{application.workingAreas.join(", ") || "Chưa cập nhật"}</p>
              </div>
            </div>
          )}

          <section>
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-on-surface-variant">
              {isServiceAddition ? "Ghi chú chuyên môn" : "Giới thiệu"}
            </p>
            <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 leading-relaxed text-on-surface">
              {application.description || "Không có ghi chú."}
            </p>
          </section>

          {!isServiceAddition && <IdentitySection identity={application.identityDocument} />}
          <CertificateSection certificates={application.certificates} />

          <ApplicationReviewHistory application={application} />

          {(application.status === "pending" || application.status === "resubmitted") && (
            <ApplicationReviewActions
              applicationType={application.applicationType}
              busy={busy}
              onApprove={onApprove}
              onReject={onReject}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
