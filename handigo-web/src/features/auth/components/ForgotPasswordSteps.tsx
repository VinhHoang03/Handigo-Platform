import type { FormEvent } from "react";
import { FloatingInput } from "@/components/common/FloatingField";

/** Thanh tiến trình 3 bước của luồng khôi phục mật khẩu. */
export function ForgotPasswordProgress({
  stepIndex,
  total,
}: {
  stepIndex: number;
  total: number;
}) {
  return (
    <div
      className="mb-7 grid gap-2"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      role="progressbar"
      aria-valuenow={stepIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Bước ${stepIndex + 1} trên ${total}`}
    >
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={`h-1.5 rounded-full transition-colors ${
            index <= stepIndex ? "bg-primary" : "bg-outline-variant/60"
          }`}
        />
      ))}
    </div>
  );
}

export function ForgotEmailStep({
  email,
  isSubmitting,
  onEmailChange,
  onSubmit,
}: {
  email: string;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <FloatingInput
        id="forgot-email"
        label="Email"
        type="email"
        value={email}
        autoComplete="email"
        required
        onValueChange={onEmailChange}
      />
      <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting ? "Đang gửi OTP..." : "Gửi mã OTP"}
      </button>
    </form>
  );
}

export function ForgotOtpStep({
  otp,
  isResending,
  onOtpChange,
  onSubmit,
  onBack,
  onResend,
}: {
  otp: string;
  isResending: boolean;
  onOtpChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onResend: () => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <FloatingInput
        id="forgot-otp"
        label="Mã OTP"
        value={otp}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        onValueChange={(value) => onOtpChange(value.replace(/\D/g, "").slice(0, 6))}
      />
      <button type="submit" disabled={otp.length !== 6} className="btn-primary w-full">
        Tiếp tục
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-ghost px-0" onClick={onBack}>
          Sửa email
        </button>
        <button
          type="button"
          className="btn-ghost px-0"
          disabled={isResending}
          onClick={onResend}
        >
          {isResending ? "Đang gửi lại..." : "Gửi lại OTP"}
        </button>
      </div>
    </form>
  );
}

export function ForgotPasswordStep({
  newPassword,
  confirmPassword,
  isSubmitting,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBack,
}: {
  newPassword: string;
  confirmPassword: string;
  isSubmitting: boolean;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <FloatingInput
        id="forgot-new-password"
        label="Mật khẩu mới"
        type="password"
        value={newPassword}
        autoComplete="new-password"
        minLength={8}
        required
        onValueChange={onNewPasswordChange}
      />
      <FloatingInput
        id="forgot-confirm-password"
        label="Xác nhận mật khẩu mới"
        type="password"
        value={confirmPassword}
        autoComplete="new-password"
        minLength={8}
        required
        onValueChange={onConfirmPasswordChange}
      />
      <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
      </button>
      <button type="button" className="btn-ghost w-full" onClick={onBack}>
        Quay lại mã OTP
      </button>
    </form>
  );
}
