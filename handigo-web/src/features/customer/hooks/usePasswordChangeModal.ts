import { useState, type FormEvent } from "react";
import { changePasswordApi } from "@/features/auth/api/auth.api";
import { getErrorMessage } from "@/utils/apiError";

const EMPTY_PWD_FORM = { current: "", next: "", confirm: "" };

/** State + hành vi của luồng đổi mật khẩu: xác nhận trước, rồi nhập mật khẩu mới. */
export function usePasswordChangeModal() {
  const [isPwdConfirmOpen, setIsPwdConfirmOpen] = useState(false);
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdData, setPwdData] = useState(EMPTY_PWD_FORM);
  const [pwdError, setPwdError] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const openConfirm = () => setIsPwdConfirmOpen(true);
  const closeConfirm = () => setIsPwdConfirmOpen(false);

  const confirmAndOpenModal = () => {
    setIsPwdConfirmOpen(false);
    setIsPwdModalOpen(true);
  };

  const closePasswordModal = () => {
    setIsPwdModalOpen(false);
    setPwdData(EMPTY_PWD_FORM);
    setPwdError("");
    setPwdMsg("");
  };

  const updatePwdField = (field: keyof typeof EMPTY_PWD_FORM, value: string) => {
    setPwdData((current) => ({ ...current, [field]: value }));
  };

  const handleUpdatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPwdError("");
    setPwdMsg("");

    if (!pwdData.current.trim()) {
      setPwdError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (pwdData.next.length < 8) {
      setPwdError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    if (pwdData.next !== pwdData.confirm) {
      setPwdError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      setIsUpdatingPwd(true);
      await changePasswordApi({
        currentPassword: pwdData.current,
        newPassword: pwdData.next,
      });
      setPwdMsg("Cập nhật mật khẩu thành công.");
      window.setTimeout(closePasswordModal, 1200);
    } catch (error) {
      setPwdError(
        getErrorMessage(
          error,
          "Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.",
        ),
      );
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  return {
    isPwdConfirmOpen,
    isPwdModalOpen,
    pwdData,
    pwdError,
    pwdMsg,
    isUpdatingPwd,
    openConfirm,
    closeConfirm,
    confirmAndOpenModal,
    closePasswordModal,
    updatePwdField,
    handleUpdatePassword,
  };
}
