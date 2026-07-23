import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface UseAvatarCropCanvasParams {
  previewUrl: string;
  file: File | null;
  isUploading: boolean;
}

/**
 * Vẽ canvas xem trước theo zoom/vị trí kéo và xử lý thao tác kéo-thả bằng
 * con trỏ. Tách khỏi phần chọn tệp/upload để `useAvatarEditor` không vượt
 * quá 200 dòng. Logic tính toán giữ nguyên như bản gốc.
 */
export function useAvatarCropCanvas({
  previewUrl,
  file,
  isUploading,
}: UseAvatarCropCanvasParams) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    positionX: 0,
    positionY: 0,
  });
  const [zoom, setZoom] = useState(1);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);

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

  const resetCrop = () => {
    setZoom(1);
    setPositionX(0);
    setPositionY(0);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
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

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
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

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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

  return {
    canvasRef,
    zoom,
    setZoom,
    resetCrop,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getCroppedFile,
  };
}
