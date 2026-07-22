import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { authService } from '../services/auth.service';
import { AuthFeedback } from '../components/AuthFeedback';
import {
  ForgotEmailStep,
  ForgotOtpStep,
  ForgotPasswordProgress,
  ForgotPasswordStep,
} from '../components/ForgotPasswordSteps';

type ForgotStep = 'email' | 'otp' | 'password';
const steps: ForgotStep[] = ['email', 'otp', 'password'];

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<ForgotStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const stepIndex = steps.indexOf(step);

  const requestOtp = async () => {
    await authService.forgotPassword({ email: normalizedEmail });
    setNotice('Nếu email tồn tại, mã OTP đã được gửi đến hộp thư của bạn.');
  };

  const handleSendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      setIsSubmitting(true);
      await requestOtp();
      setStep('otp');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể gửi mã OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (otp.length !== 6) {
      setError('Mã OTP phải gồm 6 chữ số.');
      return;
    }
    setNotice(null);
    setStep('password');
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setIsSubmitting(true);
      await authService.resetPassword({ email: normalizedEmail, otp, newPassword });
      navigate('/login', {
        replace: true,
        state: { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' },
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setNotice(null);
    try {
      setIsResending(true);
      await requestOtp();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể gửi lại OTP.');
    } finally {
      setIsResending(false);
    }
  };

  const title = step === 'email'
    ? 'Khôi phục mật khẩu'
    : step === 'otp'
      ? 'Xác thực mã OTP'
      : 'Tạo mật khẩu mới';

  const description = step === 'email'
    ? 'Nhập email tài khoản để nhận mã xác thực.'
    : step === 'otp'
      ? `Mã xác thực đã được gửi đến ${normalizedEmail}.`
      : 'Mật khẩu mới cần có ít nhất 8 ký tự.';

  return (
    <AuthLayout
      eyebrow="Bảo mật tài khoản"
      title={title}
      description={description}
      brandTitle="Khôi phục quyền truy cập an toàn."
      brandDescription="Quy trình xác thực ngắn gọn giúp bạn quay lại quản lý dịch vụ mà vẫn bảo vệ tài khoản."
      maxWidth="sm"
    >
      <ForgotPasswordProgress stepIndex={stepIndex} total={steps.length} />

      <AuthFeedback error={error} notice={notice} />

      {step === 'email' && (
        <ForgotEmailStep
          email={email}
          isSubmitting={isSubmitting}
          onEmailChange={setEmail}
          onSubmit={handleSendOtp}
        />
      )}

      {step === 'otp' && (
        <ForgotOtpStep
          otp={otp}
          isResending={isResending}
          onOtpChange={setOtp}
          onSubmit={handleConfirmOtp}
          onBack={() => setStep('email')}
          onResend={handleResendOtp}
        />
      )}

      {step === 'password' && (
        <ForgotPasswordStep
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          isSubmitting={isSubmitting}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handleResetPassword}
          onBack={() => setStep('otp')}
        />
      )}

      <p className="mt-7 text-center text-sm text-on-surface-variant">
        Đã nhớ mật khẩu?{' '}
        <Link className="font-semibold text-primary hover:text-primary-hover" to="/login">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
