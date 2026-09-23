import type { RefObject } from "react";
import type { ProviderCertificate } from "../../types/provider.types";
import { isImageUrl } from "../../utils/providerProfilePage";
import { Eye, EyeOff, FileText, Globe, ImageOff, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

export function CertificateCard({
  certificate,
  isMenuOpen,
  menuRef,
  onToggleMenu,
  onCloseMenu,
  onToggleVisibility,
  onEditCertificate,
  onDeleteCertificate,
  onSelect,
}: {
  certificate: ProviderCertificate;
  isMenuOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onToggleVisibility: (certificate: ProviderCertificate) => void;
  onEditCertificate: (certificate: ProviderCertificate) => void;
  onDeleteCertificate: (certificateId: string) => void;
  onSelect: (certificate: ProviderCertificate) => void;
}) {
  const previewUrl =
    certificate.imageUrls.find((url) => isImageUrl(url)) ||
    certificate.imageUrls[0] ||
    "";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_12px_32px_rgba(19,27,46,0.10)]">
      <div
        className="absolute right-3 top-3 z-10"
        ref={isMenuOpen ? menuRef : undefined}
      >
        <button
          type="button"
          aria-label="Mở menu chứng chỉ"
          className="grid h-9 w-9 place-items-center rounded-full bg-surface-container-lowest/92 text-on-surface shadow-sm ring-1 ring-outline-variant/40 transition hover:bg-surface-container-low"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu();
          }}
        >
          <MoreHorizontal aria-hidden="true" size={18} />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-36 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-1.5 shadow-[0_16px_40px_rgba(19,27,46,0.16)]">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface transition hover:bg-primary/5"
              onClick={() => {
                onCloseMenu();
                onToggleVisibility(certificate);
              }}
            >
              {certificate.isPublic ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
              {certificate.isPublic ? "Chuyển riêng tư" : "Công khai"}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface transition hover:bg-primary/5"
              onClick={() => {
                onCloseMenu();
                onEditCertificate(certificate);
              }}
            >
              <Pencil aria-hidden="true" size={18} />
              Sửa
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-error transition hover:bg-error/5"
              onClick={() => {
                onCloseMenu();
                onDeleteCertificate(certificate.id);
              }}
            >
              <Trash2 aria-hidden="true" size={18} />
              Xóa
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="block w-full text-left"
        onClick={() => {
          onCloseMenu();
          onSelect(certificate);
        }}
      >
        <div className="bg-surface-container-low p-3">
          {previewUrl ? (
            isImageUrl(previewUrl) ? (
              <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest">
                <img
                  src={previewUrl}
                  alt={certificate.title}
                  className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]"
                />
              </div>
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-primary">
                <FileText aria-hidden="true" size={48} />
              </div>
            )
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant">
              <ImageOff aria-hidden="true" size={48} />
            </div>
          )}
        </div>

        <div className="space-y-2 p-4">
          <div>
            <h4 className="line-clamp-2 font-bold text-on-surface">
              {certificate.title}
            </h4>
            <p className="mt-1 line-clamp-1 text-sm text-on-surface-variant">
              {certificate.issuer || "Chưa cập nhật đơn vị cấp"}
            </p>
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${certificate.isPublic ? "bg-secondary-container/30 text-secondary" : "bg-surface-container text-on-surface-variant"}`}
            >
              {certificate.isPublic ? <Globe aria-hidden="true" size={14} /> : <Lock aria-hidden="true" size={14} />}
              {certificate.isPublic ? "Công khai" : "Riêng tư"}
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}
