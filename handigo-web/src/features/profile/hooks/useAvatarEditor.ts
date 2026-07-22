import { useEffect, useState } from "react";
import { uploadUserAvatar } from "@/features/profile/api/userProfile.api";
import { getErrorMessage } from "@/utils/apiError";
import { useAvatarImageSource } from "./useAvatarImageSource";
import { useAvatarCropCanvas } from "./useAvatarCropCanvas";

interface UseAvatarEditorParams {
  onSave: (url: string) => Promise<void> | void;
}

/**
 * Điều phối chọn tệp + crop canvas + upload ảnh đại diện. Logic tính toán
 * giữ nguyên như bản gốc; chỉ tách state chọn tệp (`useAvatarImageSource`)
 * và state crop (`useAvatarCropCanvas`) ra hai hook con để mỗi file không
 * vượt quá 200 dòng.
 */
export function useAvatarEditor({ onSave }: UseAvatarEditorParams) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const {
    inputRef,
    previewUrlRef,
    file,
    previewUrl,
    selectFile: selectImageFile,
    clearSelectedFile,
  } = useAvatarImageSource();

  const {
    canvasRef,
    zoom,
    setZoom,
    resetCrop,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getCroppedFile,
  } = useAvatarCropCanvas({ previewUrl, file, isUploading });

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [previewUrlRef]);

  const closeModal = () => {
    if (isUploading) return;
    setOpen(false);
    clearSelectedFile();
    resetCrop();
    setError("");
  };

  const selectFile = (nextFile?: File) => {
    setError("");
    if (!nextFile) return;
    const result = selectImageFile(nextFile);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    resetCrop();
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
      resetCrop();
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

  return {
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
  };
}
