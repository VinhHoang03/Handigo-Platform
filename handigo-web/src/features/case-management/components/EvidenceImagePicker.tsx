import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

interface EvidenceImagePickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

export function EvidenceImagePicker({
  files,
  onChange,
  disabled,
  maxFiles = 10,
}: EvidenceImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const images = Array.from(selected).filter((file) => file.type.startsWith("image/"));
    onChange([...files, ...images].slice(0, maxFiles));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => (
          <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-xl border border-outline-variant px-3 py-2 text-sm">
            <span className="max-w-52 truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
              disabled={disabled}
              aria-label={`Xóa ${file.name}`}
              className="text-error disabled:opacity-40"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        className="sr-only"
        onChange={(event) => addFiles(event.target.files)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || files.length >= maxFiles}
        className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-40"
      >
        <ImagePlus size={18} /> Thêm ảnh bằng chứng ({files.length}/{maxFiles})
      </button>
      <p className="mt-2 text-xs text-on-surface-variant">
        Hỗ trợ JPEG, PNG, WebP, GIF hoặc AVIF; mỗi ảnh tối đa 5 MB.
      </p>
    </div>
  );
}
