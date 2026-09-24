import type { FormEvent } from "react";
import { FloatingInput } from "@/components/common/FloatingField";

interface RegisterDetailsFormProps {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  registerAsProvider: boolean;
  isSubmitting: boolean;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onRegisterAsProviderChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function RegisterDetailsForm({
  fullName,
  email,
  phone,
  password,
  confirmPassword,
  registerAsProvider,
  isSubmitting,
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onRegisterAsProviderChange,
  onSubmit,
}: RegisterDetailsFormProps) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <FloatingInput
        id="register-name"
        label="Họ và tên"
        value={fullName}
        autoComplete="name"
        required
        onValueChange={onFullNameChange}
      />

      <div className="grid gap-3">
        <FloatingInput
          id="register-email"
          label="Email"
          type="email"
          value={email}
          autoComplete="email"
          required
          onValueChange={onEmailChange}
        />
        <FloatingInput
          id="register-phone"
          label="Số điện thoại (tùy chọn)"
          type="tel"
          value={phone}
          autoComplete="tel"
          onValueChange={onPhoneChange}
        />
      </div>

      <div className="grid gap-3">
        <FloatingInput
          id="register-password"
          label="Mật khẩu"
          type="password"
          value={password}
          autoComplete="new-password"
          minLength={8}
          required
          onValueChange={onPasswordChange}
        />
        <FloatingInput
          id="register-confirm-password"
          label="Xác nhận mật khẩu"
          type="password"
          value={confirmPassword}
          autoComplete="new-password"
          minLength={8}
          required
          onValueChange={onConfirmPasswordChange}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
        <input
          type="checkbox"
          checked={registerAsProvider}
          onChange={(event) => onRegisterAsProviderChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
        />
        <span>
          <span className="block font-semibold text-on-surface">
            Đăng ký trở thành Nhà cung cấp dịch vụ
          </span>
          <span className="mt-1 block text-sm text-on-surface-variant">
            Sau khi xác thực email, bạn sẽ tiếp tục hoàn thiện hồ sơ để gửi Admin
            xét duyệt.
          </span>
        </span>
      </label>

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting ? "Đang gửi OTP..." : "Đăng ký"}
      </button>
    </form>
  );
}
