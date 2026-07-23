import { isImageUrl } from "../../utils/providerProfilePage";

export function CertificatePreviewSurface({
  url,
  label,
  heightClass = "h-64",
}: {
  url: string;
  label: string;
  heightClass?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-low p-3">
      {isImageUrl(url) ? (
        <div
          className={`flex w-full items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest ${heightClass}`}
        >
          <img src={url} alt={label} className="h-full w-full object-contain" />
        </div>
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`flex w-full items-center justify-center rounded-xl border border-outline-variant/30 bg-surface-container-lowest text-sm font-bold text-primary ${heightClass}`}
        >
          Xem tài liệu
        </a>
      )}
    </div>
  );
}
