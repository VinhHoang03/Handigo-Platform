import { useEffect, useState } from 'react';
import { Check, Download, FileText, X } from 'lucide-react';
import { AsyncState } from '@/components/common/AsyncState';
import { DashboardShell } from '@/components/common/DashboardShell';
import { FloatingTextarea } from '@/components/common/FloatingField';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import type { Category } from '@/features/provider-application/types/providerApplication.types';
import { adminApi } from '../api/admin.api';
import { ApplicationFilters } from '../components/applications/ApplicationFilters';
import { ApplicationList } from '../components/applications/ApplicationList';
import { useAdminList } from '../hooks/useAdminList';
import type {
  AdminApplication,
  AdminQuery,
  ApplicationCertificate,
  ApplicationIdentityDocument,
} from '../types/admin.types';

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url) ||
  url.includes('/image/upload/');

const downloadUrl = (url: string) =>
  url.includes('/upload/')
    ? url.replace('/upload/', '/upload/fl_attachment/')
    : url;

const formatDate = (value?: string) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return date.toLocaleDateString('vi-VN');
};

const documentTypeLabel = (type?: string) =>
  type === 'passport' ? 'Hộ chiếu' : 'CCCD';

const rejectionReasons = [
  'Giấy tờ định danh không hợp lệ',
  'Không thể xác minh chứng chỉ',
  'Kinh nghiệm chưa đáp ứng',
  'Thiếu thông tin bắt buộc',
  'Khác',
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
    { label: 'Ảnh mặt trước', url: identity.frontImageUrl },
    { label: 'Ảnh mặt sau', url: identity.backImageUrl },
    { label: 'Ảnh hộ chiếu', url: identity.passportImageUrl },
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
          <b>Số giấy tờ:</b> {identity.documentNumber || 'Chưa cập nhật'}
        </p>
        <p>
          <b>Họ tên:</b> {identity.fullName || 'Chưa cập nhật'}
        </p>
        <p>
          <b>Nơi cấp:</b> {identity.issuedPlace || 'Chưa cập nhật'}
        </p>
        <p>
          <b>Nguồn xác thực:</b> {identity.provider || 'manual'}
        </p>
        <p>
          <b>Ngày cấp:</b> {formatDate(identity.issuedAt)}
        </p>
        <p>
          <b>Ngày hết hạn:</b> {formatDate(identity.expiresAt)}
        </p>
        <p><b>Ngày sinh:</b> {formatDate(identity.dateOfBirth)}</p>
        <p><b>Giới tính:</b> {identity.gender === 'male' ? 'Nam' : identity.gender === 'female' ? 'Nữ' : identity.gender === 'other' ? 'Khác' : 'Chưa cập nhật'}</p>
        <p><b>Quốc tịch:</b> {identity.nationality || 'Chưa cập nhật'}</p>
        <p><b>Quê quán/Nơi sinh:</b> {identity.placeOfOrigin || 'Chưa cập nhật'}</p>
        <p><b>Nơi thường trú:</b> {identity.placeOfResidence || 'Chưa cập nhật'}</p>
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
              {certificate.certificateNumber ? `Số ${certificate.certificateNumber} · ` : ''}
              {certificate.issuer || 'Chưa cập nhật đơn vị cấp'} · Ngày cấp{' '}
              {formatDate(certificate.issuedAt)} · Hết hạn{' '}
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
                <AssetPreview
                  key={url}
                  url={url}
                  label={certificate.title}
                />
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
  const { result, loading, error, load } = useAdminList('applications', query);
  const items = (result?.items || []) as AdminApplication[];
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const closeModal = () => {
    setSelected(null);
    setRejecting(false);
    setReason('');
    setCustomReason('');
    setNotes('');
  };

  const review = async (status: 'approved' | 'rejected') => {
    const finalReason = reason === 'Khác' ? customReason.trim() : reason.trim();
    if (!selected || (status === 'rejected' && (!finalReason || !notes.trim()))) return;
    try {
      setBusy(true);
      await adminApi.review(
        selected._id,
        status,
        finalReason || undefined,
        notes.trim() || undefined,
      );
      closeModal();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell role="ADMIN">
      <header>
        <h1 className="text-headline-lg font-bold">Duyệt hồ sơ thợ</h1>
        <p className="text-on-surface-variant">
          Xem thông tin chuyên môn và xét duyệt đơn đăng ký.
        </p>
      </header>

      <ApplicationFilters
        query={query}
        categories={categories}
        onChange={setQuery}
      />

      <AsyncState
        loading={loading}
        error={error}
        empty={!items.length}
        emptyMessage="Chưa có hồ sơ phù hợp với bộ lọc."
        onRetry={load}
      >
        <ApplicationList items={items} onSelect={setSelected} />
      </AsyncState>

      <Pagination
        page={query.page || 1}
        totalPages={result?.pagination.totalPages || 1}
        onChange={(page) => setQuery({ ...query, page })}
      />

      <Modal
        open={Boolean(selected)}
        title="Chi tiết hồ sơ thợ"
        onClose={closeModal}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <p className="font-bold">{selected.userId.fullName}</p>
              <p className="text-on-surface-variant">
                {selected.userId.email} ·{' '}
                {selected.userId.phone || 'Chưa có SĐT'}
              </p>
            </div>
            <div>
              <b>Dịch vụ:</b>{' '}
              {selected.serviceIds.map((item) => item.name).join(', ')}
            </div>
            <div>
              <b>Kinh nghiệm:</b> {selected.experienceYears} năm
            </div>
            <div>
              <b>Khu vực:</b> {selected.workingAreas.join(', ')}
            </div>
            <div>
              <b>Giới thiệu:</b>
              <p className="mt-1 rounded-2xl bg-surface-container-low p-3 leading-relaxed">
                {selected.description}
              </p>
            </div>

            <IdentitySection identity={selected.identityDocument} />
            <CertificateSection certificates={selected.certificates} />

            {selected.rejectionReason && (
              <section className="rounded-2xl border border-error/20 bg-error-container/30 p-4 text-on-error-container">
                <h3 className="font-bold">Thông tin từ chối gần nhất</h3>
                <p className="mt-2"><b>Lý do:</b> {selected.rejectionReason}</p>
                <p className="mt-1"><b>Ghi chú:</b> {selected.rejectionNotes || 'Chưa cập nhật'}</p>
                <p className="mt-1"><b>Ngày duyệt:</b> {formatDate(selected.reviewedAt || undefined)}</p>
                <p className="mt-1"><b>Người duyệt:</b> {selected.reviewedBy?.fullName || 'Quản trị viên'}</p>
              </section>
            )}
            {Boolean(selected.reviewHistory?.length) && (
              <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
                <h3 className="font-bold">Lịch sử xét duyệt</h3>
                <ol className="space-y-3">
                  {selected.reviewHistory?.map((event, index) => {
                    const actor = typeof event.actorId === 'string'
                      ? 'Người dùng hệ thống'
                      : event.actorId.fullName;
                    return (
                      <li key={`${event.action}-${event.occurredAt}-${index}`} className="rounded-xl bg-surface-container-low p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-bold">{event.action === 'submitted' ? 'Đã gửi hồ sơ' : event.action === 'resubmitted' ? 'Đã gửi lại' : event.action === 'approved' ? 'Đã phê duyệt' : 'Đã từ chối'}</p>
                          <span className="text-on-surface-variant">{formatDate(event.occurredAt)}</span>
                        </div>
                        <p className="mt-1 text-on-surface-variant">Người thực hiện: {actor}</p>
                        {event.rejectionReason && <p className="mt-1"><b>Lý do:</b> {event.rejectionReason}</p>}
                        {event.notes && <p className="mt-1"><b>Ghi chú:</b> {event.notes}</p>}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
            {(selected.status === 'pending' || selected.status === 'resubmitted') && (
              <div className="space-y-3">
                {rejecting && (
                  <div className="space-y-3 rounded-2xl bg-surface-container-low p-4">
                    <label className="form-select">
                      <span className="form-select__label">Lý do từ chối</span>
                      <select className="form-select__control" value={reason} onChange={(event) => setReason(event.target.value)}>
                        <option value="">Chọn lý do</option>
                        {rejectionReasons.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    {reason === 'Khác' && (
                      <label className="block space-y-2">
                        <span className="text-sm font-bold">Lý do khác</span>
                        <input value={customReason} maxLength={200} onChange={(event) => setCustomReason(event.target.value)} className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 outline-none focus:border-primary" />
                      </label>
                    )}
                    <FloatingTextarea id="application-rejection-notes" label="Ghi chú chi tiết (bắt buộc)" value={notes} rows={4} maxLength={2000} onValueChange={setNotes} />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-error/10 py-3 font-semibold text-error disabled:opacity-50"
                  >
                    <X size={18} /> Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => review(rejecting ? 'rejected' : 'approved')}
                    disabled={busy || (rejecting && (!(reason === 'Khác' ? customReason.trim() : reason.trim()) || !notes.trim()))}
                    className="btn-primary"
                  >
                    <Check size={18} />{' '}
                    {busy
                      ? 'Đang xử lý...'
                      : rejecting
                        ? 'Xác nhận từ chối'
                        : 'Phê duyệt'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
