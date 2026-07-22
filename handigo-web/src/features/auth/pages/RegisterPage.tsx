import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { authService } from "../services/auth.service";
import { AuthFeedback } from "../components/AuthFeedback";
import { RegisterDetailsForm } from "../components/RegisterDetailsForm";
import { RegisterOtpForm } from "../components/RegisterOtpForm";
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
      <AuthFeedback error={error} notice={notice} />

      {step === "form" ? (
        <RegisterDetailsForm
          fullName={fullName}
          email={email}
          phone={phone}
          password={password}
          confirmPassword={confirmPassword}
          registerAsProvider={registerAsProvider}
          isSubmitting={isSubmitting}
          onFullNameChange={setFullName}
          onEmailChange={setEmail}
          onPhoneChange={setPhone}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onRegisterAsProviderChange={setRegisterAsProvider}
          onSubmit={handleRegister}
        />
      ) : (
        <RegisterOtpForm
          otp={otp}
          isSubmitting={isSubmitting}
          isResending={isResending}
          onOtpChange={setOtp}
          onSubmit={handleVerifyOtp}
          onBackToDetails={() => setStep("form")}
          onResend={handleResendOtp}
        />
      )}

      <p className="mt-5 text-center text-sm text-on-surface-variant">
        Đã có tài khoản?{" "}
        <Link
          className="font-semibold text-primary hover:text-primary-hover"
          to="/login"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
