import type { PointerEvent, RefObject } from "react";
import { InitialsAvatar } from "@/components/common/InitialsAvatar";

interface AvatarCropCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  previewUrl: string;
  fullName: string;
  src?: string;
  file: File | null;
  zoom: number;
  isUploading: boolean;
  onZoomChange: (zoom: number) => void;
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
}

/** Vùng xem trước + căn chỉnh ảnh đại diện (canvas kéo-thả và thanh phóng to). */
export function AvatarCropCanvas({
  canvasRef,
  previewUrl,
  fullName,
  src,
  file,
  zoom,
  isUploading,
  onZoomChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: AvatarCropCanvasProps) {
  return (
    <>
      <div className="flex justify-center">
        {previewUrl ? (
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            className="h-48 w-48 touch-none cursor-grab rounded-full border-4 border-primary/10 object-cover shadow-md active:cursor-grabbing"
            aria-label="Xem trước ảnh đại diện đã căn chỉnh"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        ) : (
          <InitialsAvatar
            name={fullName}
            src={src}
            className="h-40 w-40 border-4 border-primary/10 shadow-md"
            textClassName="text-4xl"
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
              onChange={(event) => onZoomChange(Number(event.target.value))}
              className="w-full accent-primary"
            />
          </label>
          <p className="text-center text-sm font-medium text-on-surface-variant">
            Kéo trực tiếp trên ảnh để căn vị trí hiển thị.
          </p>
        </div>
      )}
    </>
  );
}
