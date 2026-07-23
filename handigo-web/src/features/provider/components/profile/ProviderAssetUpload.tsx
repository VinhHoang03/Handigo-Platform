import { useRef } from "react";
import { isImageUrl } from "../../utils/providerProfilePage";
import { Upload } from "lucide-react";

export function UploadedAssetPreview({
  url,
  label,
  onRemove,
}: {
  url: string;
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
      {isImageUrl(url) ? (
        <img
          src={url}
          alt={label}
          className="h-28 w-full rounded-lg object-cover"
        />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-28 items-center justify-center rounded-lg bg-surface-container-low text-sm font-bold text-primary"
        >
          Xem tài liệu
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          className="mt-2 text-xs font-bold text-error hover:underline"
          onClick={onRemove}
        >
          Xóa
        </button>
      )}
    </div>
  );
}

export function FileUploadSlot({
  id,
  label,
  value,
  accept,
  uploading,
  onUpload,
  onRemove,
}: {
  id: string;
  label: string;
  value?: string;
  accept: string;
  uploading?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-on-surface-variant">
          {label}
        </p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Upload aria-hidden="true" size={18} />
          {uploading ? "Đang tải..." : value ? "Thay đổi" : "Tải lên"}
        </button>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={uploading}
          tabIndex={-1}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) onUpload(file);
          }}
        />
      </div>
      {value ? (
        <UploadedAssetPreview url={value} label={label} onRemove={onRemove} />
      ) : (
        <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-sm text-on-surface-variant">
          Chưa có tệp.
        </div>
      )}
    </div>
  );
}
