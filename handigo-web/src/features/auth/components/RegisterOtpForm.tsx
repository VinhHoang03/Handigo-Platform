import type { FormEvent } from "react";
import { OtpInput } from "./OtpInput";

interface RegisterOtpFormProps {
  otp: string;
  isSubmitting: boolean;
  isResending: boolean;
  onOtpChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBackToDetails: () => void;
  onResend: () => void;
}

export function RegisterOtpForm({
  otp,
  isSubmitting,
  isResending,
  onOtpChange,
  onSubmit,
  onBackToDetails,
  onResend,
}: RegisterOtpFormProps) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <OtpInput
        id="register-otp"
        value={otp}
        disabled={isSubmitting}
        onValueChange={onOtpChange}
      />

      <button
        type="submit"
        disabled={isSubmitting || !/^\d{6}$/.test(otp)}
        className="btn-primary w-full"
      >
        {isSubmitting ? "Đang xác thực..." : "Xác thực OTP"}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn-ghost px-0" onClick={onBackToDetails}>
          Sửa thông tin
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
