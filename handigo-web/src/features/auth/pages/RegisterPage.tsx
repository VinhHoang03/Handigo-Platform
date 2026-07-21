import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { FloatingInput } from "@/components/common/FloatingField";
import { authService } from "../services/auth.service";
import {
  isValidVietnamesePhone,
  normalizeVietnamesePhone,
} from "@/utils/phoneValidation";

type RegisterStep = "form" | "otp";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<RegisterStep>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerAsProvider, setRegisterAsProvider] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    const normalizedPhone = normalizeVietnamesePhone(phone);
    if (normalizedPhone && !isValidVietnamesePhone(normalizedPhone)) {
      setError(
        "Số điện thoại phải bắt đầu bằng 0 và dùng đầu số di động Việt Nam hợp lệ.",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.register({
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: normalizedPhone || undefined,
        password,
        registrationType: registerAsProvider ? "PROVIDER" : "CUSTOMER",
      });
      setStep("otp");
      setNotice("Mã OTP đã được gửi đến email của bạn.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Đăng ký thất bại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      setIsSubmitting(true);
      const response = await authService.verifyRegisterOtp({
        email: normalizedEmail,
        otp,
      });
      if (response.user?.role.toUpperCase() === "PROVIDER" && response.token) {
        navigate("/register-provider", { replace: true });
        return;
      }
      navigate("/login", {
        replace: true,
        state: { message: "Xác thực email thành công. Bạn có thể đăng nhập." },
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Xác thực OTP thất bại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setNotice(null);
    try {
      setIsResending(true);
      await authService.resendRegisterOtp(normalizedEmail);
      setNotice("Mã OTP mới đã được gửi lại.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể gửi lại OTP.",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      eyebrow={step === "form" ? "Tạo tài khoản" : "Xác thực email"}
      title={step === "form" ? "Đăng ký Handigo" : "Nhập mã OTP"}
      description={
        step === "form"
          ? "Hoàn tất thông tin để bắt đầu đặt và quản lý dịch vụ tại nhà."
          : `Nhập mã 6 số đã được gửi đến ${normalizedEmail}.`
      }
      brandTitle="Bắt đầu chăm sóc tổ ấm cùng Handigo."
      brandDescription="Một tài khoản giúp bạn đặt lịch nhanh, theo dõi tiến độ và kết nối với chuyên gia phù hợp."
      maxWidth="md"
    >
      {(error || notice) && (
        <div
          role="status"
          className={`mb-5 rounded-xl border p-3 text-sm ${
            error
              ? "border-error/20 bg-error/10 text-error"
              : "border-secondary/20 bg-secondary/10 text-secondary"
          }`}
        >
          {error || notice}
        </div>
      )}

      {step === "form" ? (
        <form className="space-y-3" onSubmit={handleRegister}>
          <FloatingInput
            id="register-name"
            label="Họ và tên"
            value={fullName}
            autoComplete="name"
            required
            onValueChange={setFullName}
          />
          <div className="grid gap-3">
            <FloatingInput
              id="register-email"
              label="Email"
              type="email"
              value={email}
              autoComplete="email"
              required
              onValueChange={setEmail}
            />
            <FloatingInput
              id="register-phone"
              label="Số điện thoại (tùy chọn)"
              type="tel"
              value={phone}
              autoComplete="tel"
              onValueChange={setPhone}
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
              onValueChange={setPassword}
            />
            <FloatingInput
              id="register-confirm-password"
              label="Xác nhận mật khẩu"
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              minLength={8}
              required
              onValueChange={setConfirmPassword}
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-4">
            <input
              type="checkbox"
              checked={registerAsProvider}
              onChange={(event) => setRegisterAsProvider(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
            />
            <span>
              <span className="block font-semibold text-on-surface">
                Đăng ký trở thành Nhà cung cấp dịch vụ
              </span>
              <span className="mt-1 block text-sm text-on-surface-variant">
                Sau khi xác thực email, bạn sẽ tiếp tục hoàn thiện hồ sơ để gửi
                Admin xét duyệt.
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? "Đang gửi OTP..." : "Đăng ký"}
          </button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={handleVerifyOtp}>
          <FloatingInput
            id="register-otp"
            label="Mã OTP"
            value={otp}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            onValueChange={(value) =>
              setOtp(value.replace(/\D/g, "").slice(0, 6))
            }
          />
          <button
            type="submit"
            disabled={isSubmitting || otp.length !== 6}
            className="btn-primary w-full"
          >
            {isSubmitting ? "Đang xác thực..." : "Xác thực OTP"}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="btn-ghost px-0"
              onClick={() => setStep("form")}
            >
              Sửa thông tin
            </button>
            <button
              type="button"
              className="btn-ghost px-0"
              disabled={isResending}
              onClick={handleResendOtp}
            >
              {isResending ? "Đang gửi lại..." : "Gửi lại OTP"}
            </button>
          </div>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-on-surface-variant">
        Đã có tài khoản?{" "}
        <Link
          className="font-semibold text-primary hover:text-primary-container"
          to="/login"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
