import { InitialsAvatar } from "@/components/common/InitialsAvatar";
import { Camera } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { useAvatarEditor } from "@/features/profile/hooks/useAvatarEditor";
import { AvatarCropCanvas } from "./AvatarCropCanvas";
import { AvatarUploadActions } from "./AvatarUploadActions";

interface AvatarEditorProps {
  src?: string;
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
  const {
    inputRef,
    canvasRef,
    open,
    setOpen,
    file,
    previewUrl,
    error,
    isUploading,
    zoom,
    setZoom,
    closeModal,
    selectFile,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    saveAvatar,
  } = useAvatarEditor({ onSave });

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
        <InitialsAvatar
          name={fullName}
          src={src}
          className="h-full w-full transition duration-200 group-hover:opacity-40 group-focus-visible:opacity-40"
        />
        <span className="absolute inset-0 grid place-items-center bg-on-surface/0 text-on-primary opacity-0 transition duration-200 group-hover:bg-on-surface/35 group-hover:opacity-100 group-focus-visible:bg-on-surface/35 group-focus-visible:opacity-100">
          <Camera size={size === "lg" ? 28 : 22} aria-hidden="true" />
        </span>
      </button>

      <Modal open={open} title="Đổi ảnh đại diện" size="sm" onClose={closeModal}>
        <div className="space-y-5">
          <AvatarCropCanvas
            canvasRef={canvasRef}
            previewUrl={previewUrl}
            fullName={fullName}
            src={src}
            file={file}
            zoom={zoom}
            isUploading={isUploading}
            onZoomChange={setZoom}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          <AvatarUploadActions
            inputRef={inputRef}
            file={file}
            isUploading={isUploading}
            error={error}
            onSelectFile={selectFile}
            onClose={closeModal}
            onSave={() => void saveAvatar()}
          />
        </div>
      </Modal>
    </>
  );
}
