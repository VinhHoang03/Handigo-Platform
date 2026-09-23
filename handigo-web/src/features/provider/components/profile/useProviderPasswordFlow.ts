import { useState, type FormEvent } from "react";
import { changePasswordApi } from "@/features/auth/api/auth.api";
import { getErrorMessage } from "@/utils/apiError";
import {
  emptyPasswordForm,
  type PasswordForm,
} from "../../utils/providerProfilePage";

/** Password change flow: confirm dialog -> update form -> submit. */
export function useProviderPasswordFlow() {
  const [isPwdConfirmOpen, setIsPwdConfirmOpen] = useState(false);
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [pwdData, setPwdData] = useState<PasswordForm>(emptyPasswordForm);
  const [pwdError, setPwdError] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  function closePasswordModal() {
    setIsPwdModalOpen(false);
    setPwdData(emptyPasswordForm);
    setPwdError("");
    setPwdMsg("");
  }

  function handlePasswordFieldChange(field: keyof PasswordForm, value: string) {
    setPwdData((current) => ({ ...current, [field]: value }));
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
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
    } catch (passwordError) {
      setPwdError(
        getErrorMessage(
          passwordError,
          "Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.",
        ),
      );
    } finally {
      setIsUpdatingPwd(false);
    }
  }

  return {
    isPwdConfirmOpen,
    setIsPwdConfirmOpen,
    isPwdModalOpen,
    setIsPwdModalOpen,
    pwdData,
    pwdError,
    pwdMsg,
    isUpdatingPwd,
    closePasswordModal,
    handlePasswordFieldChange,
    handleUpdatePassword,
  };
}
