import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { FloatingInput } from '@/components/common/FloatingField';
import { authService } from '../services/auth.service';

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
      <div className="mb-7 grid grid-cols-3 gap-2" aria-label={`Bước ${stepIndex + 1} trên 3`}>
        {steps.map((item, index) => (
          <div
            key={item}
            className={`h-1.5 rounded-full transition-colors ${
              index <= stepIndex ? 'bg-primary' : 'bg-outline-variant/60'
            }`}
          />
        ))}
      </div>

      {(error || notice) && (
        <div
          role="status"
          className={`mb-5 rounded-xl border p-3 text-sm ${
            error
              ? 'border-error/20 bg-error/10 text-error'
              : 'border-secondary/20 bg-secondary/10 text-secondary'
          }`}
        >
          {error || notice}
        </div>
      )}

      {step === 'email' && (
        <form className="space-y-5" onSubmit={handleSendOtp}>
          <FloatingInput
            id="forgot-email"
            label="Email"
            type="email"
            value={email}
            autoComplete="email"
            required
            onValueChange={setEmail}
          />
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form className="space-y-5" onSubmit={handleConfirmOtp}>
          <FloatingInput
            id="forgot-otp"
            label="Mã OTP"
            value={otp}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            onValueChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
          />
          <button type="submit" disabled={otp.length !== 6} className="btn-primary w-full">
            Tiếp tục
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-ghost px-0" onClick={() => setStep('email')}>
              Sửa email
            </button>
            <button
              type="button"
              className="btn-ghost px-0"
              disabled={isResending}
              onClick={handleResendOtp}
            >
              {isResending ? 'Đang gửi lại...' : 'Gửi lại OTP'}
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form className="space-y-4" onSubmit={handleResetPassword}>
          <FloatingInput
            id="forgot-new-password"
            label="Mật khẩu mới"
            type="password"
            value={newPassword}
            autoComplete="new-password"
            minLength={8}
            required
            onValueChange={setNewPassword}
          />
          <FloatingInput
            id="forgot-confirm-password"
            label="Xác nhận mật khẩu mới"
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            minLength={8}
            required
            onValueChange={setConfirmPassword}
          />
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
            {isSubmitting ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep('otp')}>
            Quay lại mã OTP
          </button>
        </form>
      )}

      <p className="mt-7 text-center text-sm text-on-surface-variant">
        Đã nhớ mật khẩu?{' '}
        <Link className="font-semibold text-primary hover:text-primary-container" to="/login">
          Đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
