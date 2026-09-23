import { FileText, Trash2, UploadCloud } from "lucide-react";
import { isImageUrl } from "./providerDescriptionStepHelpers";

/** Thẻ hiển thị một tệp đã tải lên (ảnh hoặc tài liệu) kèm nút xóa. */
export function UploadedAsset({
  url,
  label,
  onRemove,
}: {
  url: string;
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3">
      {isImageUrl(url) ? (
        <img
          src={url}
          alt={label}
          className="h-32 w-full rounded-lg object-cover"
        />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-32 items-center justify-center gap-2 rounded-lg bg-surface-container-low text-sm font-bold text-primary"
        >
          <FileText size={18} /> Xem tài liệu
        </a>
      )}
      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-error hover:underline"
        onClick={onRemove}
      >
        <Trash2 size={14} /> Xóa
      </button>
    </div>
  );
}

/** Ô tải một tệp giấy tờ/chứng chỉ, hiển thị trạng thái đang tải và OCR. */
export function FileUploadSlot({
  id,
  label,
  value,
  uploading,
  onUpload,
  onRemove,
}: {
  id: string;
  label: string;
  value?: string;
  uploading?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-on-surface-variant">
          {label}
        </p>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary transition hover:bg-primary/90">
          <UploadCloud size={17} />
          {uploading ? "Đang tải và OCR..." : value ? "Thay đổi" : "Tải lên"}
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
      {value ? (
        <UploadedAsset url={value} label={label} onRemove={onRemove} />
      ) : (
        <div className="rounded-lg border border-dashed border-outline-variant/60 bg-surface-container-low p-5 text-center text-sm text-on-surface-variant">
          Chưa có tệp.
        </div>
      )}
    </div>
  );
}
