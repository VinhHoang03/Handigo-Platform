import type { RefObject } from "react";
import { ImagePlus } from "lucide-react";

interface AvatarUploadActionsProps {
  inputRef: RefObject<HTMLInputElement | null>;
  file: File | null;
  isUploading: boolean;
  error: string;
  onSelectFile: (file?: File) => void;
  onClose: () => void;
  onSave: () => void;
}

/** Ô chọn tệp, chú thích định dạng/kích thước và nút Hủy/Lưu của modal đổi avatar. */
export function AvatarUploadActions({
  inputRef,
  file,
  isUploading,
  error,
  onSelectFile,
  onClose,
  onSave,
}: AvatarUploadActionsProps) {
  return (
    <>
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 font-bold text-primary transition hover:bg-primary/10">
        <ImagePlus size={20} aria-hidden="true" />
        {file ? "Chọn ảnh khác" : "Chọn ảnh từ thiết bị"}
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="sr-only"
          disabled={isUploading}
          onChange={(event) => onSelectFile(event.target.files?.[0])}
        />
      </label>

      <p className="text-center text-sm text-on-surface-variant">
        Hỗ trợ JPG/JPEG, PNG, WebP, GIF và AVIF, tối đa 5 MB.
      </p>
      {error && (
        <p className="rounded-lg bg-error/10 px-4 py-3 text-sm font-medium text-error">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="btn-secondary"
          disabled={isUploading}
          onClick={onClose}
        >
          Hủy
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!file || isUploading}
          onClick={onSave}
        >
          {isUploading ? "Đang tải lên..." : "Lưu ảnh đại diện"}
        </button>
      </div>
    </>
  );
}
