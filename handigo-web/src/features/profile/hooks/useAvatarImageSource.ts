import { useRef, useState } from "react";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/**
 * Quản lý tệp ảnh đại diện đã chọn + URL xem trước (object URL). Tách khỏi
 * phần crop canvas và upload để `useAvatarEditor` không vượt quá 200 dòng.
 */
export function useAvatarImageSource() {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const clearSelectedFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  /** Trả về `File` nếu hợp lệ, ngược lại trả về thông báo lỗi. */
  const selectFile = (nextFile: File): File | string => {
    if (!ACCEPTED_AVATAR_TYPES.has(nextFile.type)) {
      return "Chỉ chấp nhận ảnh JPEG, PNG, WebP, GIF hoặc AVIF.";
    }
    if (nextFile.size > MAX_AVATAR_SIZE) {
      return "Ảnh đại diện không được vượt quá 5 MB.";
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const objectUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setFile(nextFile);
    return nextFile;
  };

  return {
    inputRef,
    previewUrlRef,
    file,
    previewUrl,
    selectFile,
    clearSelectedFile,
  };
}
