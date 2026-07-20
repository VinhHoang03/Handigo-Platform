import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { uploadUserAvatar } from "@/features/profile/api/userProfile.api";
import { getErrorMessage } from "@/utils/apiError";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

interface AvatarEditorProps {
  src: string;
  fullName: string;
  onSave: (url: string) => Promise<void> | void;
  size?: "md" | "lg";
  disabled?: boolean;
}

export function AvatarEditor({
  src,
  fullName,
  onSave,
  size = "md",
  disabled,
}: AvatarEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewUrlRef = useRef("");
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    positionX: 0,
    positionY: 0,
  });
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!previewUrl) return;

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;

      const size = canvas.width;
      const scale =
        Math.max(size / image.naturalWidth, size / image.naturalHeight) * zoom;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const overflowX = Math.max(0, width - size);
      const overflowY = Math.max(0, height - size);
      const x = (size - width) / 2 + (positionX / 100) * (overflowX / 2);
      const y = (size - height) / 2 + (positionY / 100) * (overflowY / 2);

      context.clearRect(0, 0, size, size);
      context.drawImage(image, x, y, width, height);
    };
    image.src = previewUrl;

    return () => {
      cancelled = true;
    };
  }, [positionX, positionY, previewUrl, zoom]);

  const clearSelectedFile = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    setFile(null);
    setZoom(1);
    setPositionX(0);
    setPositionY(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const closeModal = () => {
    if (isUploading) return;
    setOpen(false);
    clearSelectedFile();
    setError("");
  };

  const selectFile = (nextFile?: File) => {
    setError("");
    if (!nextFile) return;
    if (!ACCEPTED_AVATAR_TYPES.has(nextFile.type)) {
      setError("Chỉ chấp nhận ảnh JPEG, PNG, WebP, GIF hoặc AVIF.");
      return;
    }
    if (nextFile.size > MAX_AVATAR_SIZE) {
      setError("Ảnh đại diện không được vượt quá 5 MB.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const objectUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setZoom(1);
    setPositionX(0);
    setPositionY(0);
    setFile(nextFile);
  };

  const getCroppedFile = () =>
    new Promise<File>((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error("Không thể xử lý ảnh đại diện."));
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Không thể xử lý ảnh đại diện."));
            return;
          }
          resolve(new File([blob], "avatar.webp", { type: "image/webp" }));
        },
        "image/webp",
        0.9,
      );
    });

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!file || isUploading) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      positionX,
      positionY,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const sensitivity = 200 / Math.max(rect.width, 1);
    const nextX =
      dragRef.current.positionX +
      (event.clientX - dragRef.current.startX) * sensitivity;
    const nextY =
      dragRef.current.positionY +
      (event.clientY - dragRef.current.startY) * sensitivity;
    setPositionX(Math.max(-100, Math.min(100, nextX)));
    setPositionY(Math.max(-100, Math.min(100, nextY)));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const saveAvatar = async () => {
    if (!file) {
      setError("Vui lòng chọn ảnh đại diện mới.");
      return;
    }

    try {
      setIsUploading(true);
      setError("");
      const croppedFile = await getCroppedFile();
      const url = await uploadUserAvatar(croppedFile);
      await onSave(url);
      setOpen(false);
      clearSelectedFile();
    } catch (uploadError) {
      setError(
        getErrorMessage(
          uploadError,
          "Không thể cập nhật ảnh đại diện. Vui lòng thử lại.",
        ),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const sizeClass = size === "lg" ? "h-32 w-32" : "h-20 w-20";

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`group relative shrink-0 overflow-hidden rounded-full ring-4 ring-primary-container/20 focus:outline-none focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60 ${sizeClass}`}
        aria-label="Đổi ảnh đại diện"
      >
        <img
          src={src}
          alt={`Ảnh đại diện của ${fullName}`}
          className="h-full w-full object-cover transition duration-200 group-hover:opacity-40 group-focus-visible:opacity-40"
        />
        <span className="absolute inset-0 grid place-items-center bg-on-surface/0 text-white opacity-0 transition duration-200 group-hover:bg-on-surface/35 group-hover:opacity-100 group-focus-visible:bg-on-surface/35 group-focus-visible:opacity-100">
          <Camera size={size === "lg" ? 28 : 22} aria-hidden="true" />
        </span>
      </button>

      <Modal open={open} title="Đổi ảnh đại diện" size="sm" onClose={closeModal}>
        <div className="space-y-5">
          <div className="flex justify-center">
            {previewUrl ? (
              <canvas
                ref={canvasRef}
                width={512}
                height={512}
                className="h-48 w-48 touch-none cursor-grab rounded-full border-4 border-primary/10 object-cover shadow-md active:cursor-grabbing"
                aria-label="Xem trước ảnh đại diện đã căn chỉnh"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            ) : (
              <img
                src={src}
                alt="Ảnh đại diện hiện tại"
                className="h-40 w-40 rounded-full border-4 border-primary/10 object-cover shadow-md"
              />
            )}
          </div>

          {file && (
            <div className="space-y-4 rounded-xl bg-surface-container-low p-4">
              <label className="block space-y-2">
                <span className="flex justify-between text-sm font-bold text-on-surface">
                  Phóng to
                  <span className="font-medium text-on-surface-variant">
                    {Math.round(zoom * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  disabled={isUploading}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </label>
              <p className="text-center text-sm font-medium text-on-surface-variant">
                Kéo trực tiếp trên ảnh để căn vị trí hiển thị.
              </p>
            </div>
          )}

          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 font-bold text-primary transition hover:bg-primary/10">
            <ImagePlus size={20} aria-hidden="true" />
            {file ? "Chọn ảnh khác" : "Chọn ảnh từ thiết bị"}
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="sr-only"
              disabled={isUploading}
              onChange={(event) => selectFile(event.target.files?.[0])}
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
              onClick={closeModal}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!file || isUploading}
              onClick={() => void saveAvatar()}
            >
              {isUploading ? "Đang tải lên..." : "Lưu ảnh đại diện"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
