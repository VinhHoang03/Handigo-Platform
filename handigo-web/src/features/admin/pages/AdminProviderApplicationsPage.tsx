import { useEffect, useState } from "react";
import { Check, Download, FileText, X } from "lucide-react";
import { AsyncState } from "@/components/common/AsyncState";
import { DashboardShell } from "@/components/common/DashboardShell";
import { FloatingTextarea } from "@/components/common/FloatingField";
import { Modal } from "@/components/common/Modal";
import { Pagination } from "@/components/common/Pagination";
import { useToast } from "@/components/common/Toast";
import type { Category } from "@/features/provider-application/types/providerApplication.types";
import { adminApi } from "../api/admin.api";
import { ApplicationFilters } from "../components/applications/ApplicationFilters";
import { ApplicationList } from "../components/applications/ApplicationList";
import { useAdminList } from "../hooks/useAdminList";
import type {
  AdminApplication,
  AdminQuery,
  ApplicationCertificate,
  ApplicationIdentityDocument,
} from "../types/admin.types";

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ||
  url.includes("/image/upload/");

const downloadUrl = (url: string) =>
  url.includes("/upload/")
    ? url.replace("/upload/", "/upload/fl_attachment/")
    : url;

const formatDate = (value?: string) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN");
};

const documentTypeLabel = (type?: string) =>
  type === "passport" ? "Hộ chiếu" : "CCCD";

const rejectionReasons = [
  "Giấy tờ định danh không hợp lệ",
  "Không thể xác minh chứng chỉ",
  "Kinh nghiệm chưa đáp ứng",
  "Thiếu thông tin bắt buộc",
  "Khác",
];

function AssetPreview({ url, label }: { url: string; label: string }) {
  return (
    <div>
      <a href={url} target="_blank" rel="noreferrer" className="block">
        {isImageUrl(url) ? (
          <img
            src={url}
            alt={label}
            className="h-36 w-full rounded-lg border border-outline-variant/40 object-cover"
          />
        ) : (
          <span className="flex h-36 items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-low text-sm font-bold text-primary">
            <FileText size={18} /> Xem tài liệu
          </span>
        )}
      </a>
      <span className="mt-1 block text-xs font-semibold text-on-surface-variant">
        {label}
      </span>
      <a
        href={downloadUrl(url)}
        download
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
      >
        <Download size={14} /> Tải xuống
      </a>
    </div>
  );
}

function IdentitySection({
  identity,
}: {
  identity?: ApplicationIdentityDocument;
}) {
  if (!identity) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/60 p-4 text-sm text-on-surface-variant">
        Hồ sơ chưa có giấy tờ định danh.
      </div>
    );
  }

  const assets = [
    { label: "Ảnh mặt trước", url: identity.frontImageUrl },
    { label: "Ảnh mặt sau", url: identity.backImageUrl },
    { label: "Ảnh hộ chiếu", url: identity.passportImageUrl },
  ].filter((asset): asset is { label: string; url: string } =>
    Boolean(asset.url),
  );

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/50 p-4">
      <h3 className="font-bold">Giấy tờ định danh</h3>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <p>
          <b>Loại giấy tờ:</b> {documentTypeLabel(identity.type)}
        </p>
        <p>
          <b>Số giấy tờ:</b> {identity.documentNumber || "Chưa cập nhật"}
        </p>
        <p>
          <b>Họ tên:</b> {identity.fullName || "Chưa cập nhật"}
        </p>
        <p>
          <b>Nơi cấp:</b> {identity.issuedPlace || "Chưa cập nhật"}
        </p>
        <p>
          <b>Nguồn xác thực:</b> {identity.provider || "manual"}
        </p>
        <p>
          <b>Ngày cấp:</b> {formatDate(identity.issuedAt)}
        </p>
        <p>
          <b>Ngày hết hạn:</b> {formatDate(identity.expiresAt)}
        </p>
        <p>
          <b>Ngày sinh:</b> {formatDate(identity.dateOfBirth)}
        </p>
        <p>
          <b>Giới tính:</b>{" "}
          {identity.gender === "male"
            ? "Nam"
            : identity.gender === "female"
              ? "Nữ"
              : identity.gender === "other"
                ? "Khác"
                : "Chưa cập nhật"}
        </p>
        <p>
          <b>Quốc tịch:</b> {identity.nationality || "Chưa cập nhật"}
        </p>
        <p>
          <b>Quê quán/Nơi sinh:</b> {identity.placeOfOrigin || "Chưa cập nhật"}
        </p>
        <p>
          <b>Nơi thường trú:</b> {identity.placeOfResidence || "Chưa cập nhật"}
        </p>
      </div>
      {assets.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {assets.map((asset) => (
            <AssetPreview key={asset.url} url={asset.url} label={asset.label} />
          ))}
        </div>
      )}
    </section>
  );
}

function CertificateSection({
  certificates = [],
}: {
  certificates?: ApplicationCertificate[];
}) {
  if (!certificates.length) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant/60 p-4 text-sm text-on-surface-variant">
        Hồ sơ chưa có chứng chỉ.
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="font-bold">Chứng chỉ nghề nghiệp</h3>
      {certificates.map((certificate, index) => (
        <div
          key={certificate._id || certificate.id || index}
          className="space-y-3 rounded-2xl border border-outline-variant/50 p-4"
        >
          <div>
            <p className="font-bold">{certificate.title}</p>
            <p className="text-sm text-on-surface-variant">
              {certificate.certificateNumber
                ? `Số ${certificate.certificateNumber} · `
                : ""}
              {certificate.issuer || "Chưa cập nhật đơn vị cấp"} · Ngày cấp{" "}
              {formatDate(certificate.issuedAt)} · Hết hạn{" "}
              {formatDate(certificate.expiresAt)}
            </p>
          </div>
          {certificate.description && (
            <p className="rounded-lg bg-surface-container-low p-3 text-sm">
              {certificate.description}
            </p>
          )}
          {certificate.imageUrls.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {certificate.imageUrls.map((url) => (
                <AssetPreview key={url} url={url} label={certificate.title} />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default function AdminProviderApplicationsPage() {
  const [query, setQuery] = useState<AdminQuery>({ page: 1, limit: 10 });
  const { result, loading, error, load } = useAdminList("applications", query);
  const items = (result?.items || []) as AdminApplication[];
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    adminApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const closeModal = () => {
    setSelected(null);
    setRejecting(false);
    setReason("");
    setCustomReason("");
    setNotes("");
  };

  const handleSelectApplication = (item: AdminApplication) => {
    try {
      // Kiểm tra user tồn tại
      if (!item.userId) {
        addToast(
          "Không thể mở hồ sơ: Tài khoản người dùng không còn tồn tại",
          "error",
        );
        return;
      }

      // Kiểm tra application data
      if (!item._id) {
        addToast("Không thể mở hồ sơ: Dữ liệu hồ sơ không hợp lệ", "error");
        return;
      }

      setSelected(item);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Lỗi khi mở hồ sơ. Vui lòng thử lại.";
      addToast(message, "error");
    }
  };

  const review = async (status: "approved" | "rejected") => {
    const finalReason = reason === "Khác" ? customReason.trim() : reason.trim();
    if (!selected || (status === "rejected" && (!finalReason || !notes.trim())))
      return;
    try {
      setBusy(true);
      await adminApi.review(
        selected._id,
        status,
        finalReason || undefined,
        notes.trim() || undefined,
      );
      closeModal();
      addToast(
        status === "approved"
          ? "Đã phê duyệt hồ sơ thành công"
          : "Đã từ chối hồ sơ",
        "success",
      );
      await load();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Lỗi khi duyệt hồ sơ. Vui lòng thử lại.";
      addToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <div className="space-y-8">
        {/* Header */}
        <header className="space-y-2">
          <h1 className="text-headline-lg font-bold text-on-surface">
            Duyệt hồ sơ thợ
          </h1>
        </header>

        {/* Filters */}
        <section>
          <ApplicationFilters
            query={query}
            categories={categories}
            onChange={setQuery}
          />
        </section>

        {/* Application List */}
        <section>
          <AsyncState
            loading={loading}
            error={error}
            empty={!items.length}
            emptyMessage="Chưa có hồ sơ phù hợp với bộ lọc."
            onRetry={load}
          >
            <ApplicationList items={items} onSelect={handleSelectApplication} />
          </AsyncState>
        </section>

        {/* Pagination */}
        <div className="flex justify-center">
          <Pagination
            page={query.page || 1}
            totalPages={result?.pagination.totalPages || 1}
            onChange={(page) => setQuery({ ...query, page })}
          />
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        title="Chi tiết hồ sơ thợ"
        onClose={closeModal}
        size="lg"
      >
        {selected && (
          <div className="space-y-6">
            {/* User Info Section */}
            <section className="space-y-2">
              <p className="text-headline-md font-bold text-on-surface">
                {selected.userId?.fullName || "Tài khoản không còn tồn tại"}
              </p>
              <p className="text-sm text-on-surface-variant">
                {selected.userId?.email || "Không còn thông tin tài khoản"} ·{" "}
                {selected.userId?.phone || "Chưa có SĐT"}
              </p>
            </section>

            {/* Application Type Card */}
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Loại đơn
              </p>
              <p className="mt-2 text-base font-semibold text-on-surface">
                {selected.applicationType === "service_addition"
                  ? "Đăng ký bổ sung dịch vụ mới"
                  : "Đăng ký từ customer lên provider"}
              </p>
              {selected.applicationType === "service_addition" && (
                <p className="mt-2 text-sm text-on-surface-variant">
                  ℹ️ Khi duyệt, hệ thống chỉ cộng thêm các dịch vụ và chứng chỉ
                  trong đơn, không ghi đè hồ sơ hiện tại.
                </p>
              )}
            </section>

            {/* Services */}
            <section>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-on-surface-variant">
                {selected.applicationType === "service_addition"
                  ? "Dịch vụ đề nghị bổ sung"
                  : "Dịch vụ"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {selected.serviceIds.map((item) => (
                  <span
                    key={item._id}
                    className="inline-flex rounded-full bg-secondary/10 px-3 py-1.5 text-sm font-semibold text-secondary"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </section>
            {selected.applicationType !== "service_addition" && (
              <>
                {/* Experience & Work Areas */}
                <div className="grid gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Kinh nghiệm
                    </p>
                    <p className="mt-2 text-2xl font-bold text-primary">
                      {selected.experienceYears}+
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      năm hoạt động
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Khu vực hoạt động
                    </p>
                    <p className="mt-2 text-sm font-semibold text-on-surface">
                      {selected.workingAreas.join(", ") || "Chưa cập nhật"}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Description / Introduction */}
            <section>
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-on-surface-variant">
                {selected.applicationType === "service_addition"
                  ? "Ghi chú chuyên môn"
                  : "Giới thiệu"}
              </p>
              <p className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 leading-relaxed text-on-surface">
                {selected.description || "Không có ghi chú."}
              </p>
            </section>

            {selected.applicationType !== "service_addition" && (
              <IdentitySection identity={selected.identityDocument} />
            )}
            <CertificateSection certificates={selected.certificates} />

            {selected.rejectionReason && (
              <section className="rounded-2xl border border-error/30 bg-error-container/20 p-4 text-on-error-container">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <h3 className="font-bold">Từ chối gần nhất</h3>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    <b>Lý do:</b> {selected.rejectionReason}
                  </p>
                  <p>
                    <b>Ghi chú:</b> {selected.rejectionNotes || "Chưa cập nhật"}
                  </p>
                  <p>
                    <b>Ngày duyệt:</b>{" "}
                    {formatDate(selected.reviewedAt || undefined)}
                  </p>
                  <p>
                    <b>Người duyệt:</b>{" "}
                    {selected.reviewedBy?.fullName || "Quản trị viên"}
                  </p>
                </div>
              </section>
            )}

            {Boolean(selected.reviewHistory?.length) && (
              <section className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface-variant">
                  📋 Lịch sử xét duyệt
                </h3>
                <ol className="space-y-2">
                  {selected.reviewHistory?.map((event, index) => {
                    const actor =
                      typeof event.actorId === "string"
                        ? "Người dùng hệ thống"
                        : event.actorId.fullName;
                    const actionLabel =
                      event.action === "submitted"
                        ? "Đã gửi hồ sơ"
                        : event.action === "resubmitted"
                          ? "Đã gửi lại"
                          : event.action === "approved"
                            ? "✓ Đã phê duyệt"
                            : "✗ Đã từ chối";
                    const borderColor =
                      event.action === "approved"
                        ? "border-secondary/40"
                        : event.action === "rejected"
                          ? "border-error/40"
                          : "border-outline-variant/40";

                    return (
                      <li
                        key={`${event.action}-${event.occurredAt}-${index}`}
                        className={`rounded-xl border ${borderColor} bg-surface-container-low p-3 text-sm`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-on-surface">
                            {actionLabel}
                          </p>
                          <span className="text-xs text-on-surface-variant">
                            {formatDate(event.occurredAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Bởi: {actor}
                        </p>
                        {event.rejectionReason && (
                          <p className="mt-1 text-xs">
                            <b>Lý do:</b> {event.rejectionReason}
                          </p>
                        )}
                        {event.notes && (
                          <p className="mt-1 text-xs">
                            <b>Ghi chú:</b> {event.notes}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
            {(selected.status === "pending" ||
              selected.status === "resubmitted") && (
              <section className="space-y-4 border-t border-outline-variant/30 pt-6">
                {rejecting && (
                  <div className="space-y-4 rounded-2xl bg-surface-container-low p-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-on-surface">
                        Lý do từ chối
                      </span>
                      <select
                        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      >
                        <option value="">Chọn lý do</option>
                        {rejectionReasons.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    {reason === "Khác" && (
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-on-surface">
                          Lý do khác
                        </span>
                        <input
                          value={customReason}
                          maxLength={200}
                          onChange={(event) =>
                            setCustomReason(event.target.value)
                          }
                          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                          placeholder="Nhập lý do từ chối..."
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-on-surface">
                        Ghi chú chi tiết (bắt buộc)
                      </span>
                      <FloatingTextarea
                        id="application-rejection-notes"
                        label=""
                        value={notes}
                        rows={4}
                        maxLength={2000}
                        onValueChange={setNotes}
                      />
                    </label>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {!rejecting ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejecting(true)}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-error/30 bg-error/5 py-3 font-semibold text-error transition-all hover:bg-error/10 disabled:opacity-50"
                      >
                        <X size={18} /> Từ chối
                      </button>
                      <button
                        type="button"
                        onClick={() => review("approved")}
                        disabled={busy}
                        className="btn-primary"
                      >
                        <Check size={18} />{" "}
                        {busy
                          ? "Đang xử lý..."
                          : selected.applicationType === "service_addition"
                            ? "Duyệt thêm dịch vụ"
                            : "Phê duyệt provider"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setRejecting(false)}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest py-3 font-semibold text-on-surface transition-all hover:bg-surface-container-low disabled:opacity-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => review("rejected")}
                        disabled={
                          busy ||
                          !(reason === "Khác"
                            ? customReason.trim()
                            : reason.trim()) ||
                          !notes.trim()
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-error/10 py-3 font-semibold text-error transition-all hover:bg-error/20 disabled:opacity-50"
                      >
                        <X size={18} />{" "}
                        {busy ? "Đang xử lý..." : "Xác nhận từ chối"}
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
