import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logoImg from '../../../assets/logo.png';
import loginImg from '../../../assets/login.png';
import { authService } from '../services/auth.service';

type ForgotStep = 'email' | 'otp' | 'password';

interface FieldProps {
  id: string;
  label: string;
  value: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
  onChange: (value: string) => void;
}

const Field: React.FC<FieldProps> = ({
  id,
  label,
  value,
  type = 'text',
  autoComplete,
  maxLength,
  required = true,
  onChange,
}) => (
  <div className="floating-label-group relative">
    <input
      autoComplete={autoComplete}
      className="peer w-full h-12 px-4 pt-4 bg-surface-container-lowest dark:bg-on-surface-variant/10 border border-outline-variant dark:border-outline/30 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm text-on-surface dark:text-surface-bright"
      id={id}
      maxLength={maxLength}
      onChange={(event) => onChange(event.target.value)}
      placeholder=" "
      required={required}
      type={type}
      value={value}
    />
    <label
      className="absolute left-4 top-3 text-sm text-on-surface-variant dark:text-outline-variant origin-left transition-all peer-focus:-translate-y-2.5 peer-focus:scale-85 peer-[:not(:placeholder-shown)]:-translate-y-2.5 peer-[:not(:placeholder-shown)]:scale-85"
      htmlFor={id}
    >
      {label}
    </label>
  </div>
);

const stepOrder: ForgotStep[] = ['email', 'otp', 'password'];

const ForgotPasswordPage: React.FC = () => {
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
  const currentStepIndex = stepOrder.indexOf(step);

  const requestOtp = async (message = 'Mã OTP đã được gửi đến email của bạn.') => {
    await authService.forgotPassword({ email: normalizedEmail });
    setNotice(message);
  };

  const handleSendOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      await requestOtp();
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi mã OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmOtp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (otp.length !== 6) {
      setError('Mã OTP phải gồm 6 chữ số.');
      return;
    }

    setStep('password');
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
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

    setIsSubmitting(true);
    try {
      await authService.resetPassword({
        email: normalizedEmail,
        otp,
        newPassword,
      });
      navigate('/signin', {
        replace: true,
        state: { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    setNotice(null);
    setIsResending(true);

    try {
      await requestOtp('Mã OTP mới đã được gửi lại.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi lại OTP.');
    } finally {
      setIsResending(false);
    }
  };

  const updateOtp = (value: string) => {
    setOtp(value.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <main className="min-h-screen lg:h-screen w-screen flex items-stretch overflow-x-hidden bg-background">
      <section className="hidden lg:flex w-[45%] h-full relative flex-col items-center justify-center overflow-hidden bg-primary p-8">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-secondary-container/20 rounded-full blur-[80px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-inverse-primary/20 rounded-full blur-[70px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-[400px]">
          <div className="flex items-center gap-2 mb-2">
            <img src={logoImg} alt="FixNow Logo" className="h-10 w-auto" />
            <h2 className="text-xl font-bold text-white">FixNow</h2>
          </div>
          <h1 className="text-2xl xl:text-3xl font-bold text-white mb-4 leading-tight">
            Khôi phục quyền truy cập vào{' '}
            <span className="text-secondary-fixed">FixNow.</span>
          </h1>
          <p className="text-sm xl:text-base text-on-primary-container/80 mb-8">
            Nhận mã xác thực qua email và tạo mật khẩu mới để tiếp tục quản lý dịch vụ tại nhà.
          </p>
          <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden shadow-2xl group">
            <img
              className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
              src={loginImg}
              alt="Home service"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
          </div>
        </div>
      </section>

      <section className="w-full lg:w-[55%] min-h-screen lg:h-full flex items-center justify-center p-4 md:p-8 relative bg-surface">
        <button
          aria-label="Đổi giao diện sang tối"
          className="absolute top-4 right-4 p-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
          type="button"
        >
          <span className="material-symbols-outlined text-xl">dark_mode</span>
        </button>

        <div className="w-full max-w-[440px] bg-white/70 dark:bg-inverse-surface/70 backdrop-blur-xl p-6 md:p-10 rounded-2xl border border-outline-variant/30 shadow-xl">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <img src={logoImg} alt="FixNow Logo" className="h-12 w-auto mb-2" />
            <h2 className="text-xl font-bold text-primary">FixNow</h2>
          </div>

          <div className="mb-7 grid grid-cols-3 gap-2">
            {stepOrder.map((item, index) => (
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  index <= currentStepIndex ? 'bg-primary' : 'bg-outline-variant/50'
                }`}
                key={item}
              />
            ))}
          </div>

          <header className="mb-8">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
              {step === 'email' && 'Quên mật khẩu'}
              {step === 'otp' && 'Xác thực OTP'}
              {step === 'password' && 'Mật khẩu mới'}
            </p>
            <h2 className="text-2xl font-bold text-on-surface dark:text-surface-bright mb-1">
              {step === 'email' && 'Nhập email tài khoản'}
              {step === 'otp' && 'Nhập mã OTP'}
              {step === 'password' && 'Tạo mật khẩu mới'}
            </h2>
            <p className="text-sm text-on-surface-variant dark:text-outline-variant">
              {step === 'email' && 'Chúng tôi sẽ gửi mã xác thực 6 số đến email của bạn.'}
              {step === 'otp' && `Mã OTP đã được gửi đến ${normalizedEmail}.`}
              {step === 'password' && 'Mật khẩu mới sẽ được áp dụng sau khi OTP hợp lệ.'}
            </p>
          </header>

          {error && (
            <div className="mb-4 p-3 text-sm text-error bg-error-container rounded-xl">
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-4 p-3 text-sm text-primary bg-primary/10 rounded-xl">
              {notice}
            </div>
          )}

          {step === 'email' && (
            <form className="space-y-5" method="POST" onSubmit={handleSendOtp}>
              <Field
                autoComplete="email"
                id="email"
                label="Email"
                onChange={setEmail}
                type="email"
                value={email}
              />

              <button
                className="w-full flex justify-center py-3 bg-primary text-on-primary text-base font-bold rounded-xl hover:bg-primary-container active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form className="space-y-5" method="POST" onSubmit={handleConfirmOtp}>
              <Field
                autoComplete="one-time-code"
                id="otp"
                label="Mã OTP"
                maxLength={6}
                onChange={updateOtp}
                type="text"
                value={otp}
              />

              <button
                className="w-full flex justify-center py-3 bg-primary text-on-primary text-base font-bold rounded-xl hover:bg-primary-container active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isSubmitting || otp.length !== 6}
                type="submit"
              >
                Tiếp tục
              </button>

              <div className="flex items-center justify-between text-xs font-medium">
                <button
                  className="text-on-surface-variant hover:text-primary transition-colors"
                  onClick={() => setStep('email')}
                  type="button"
                >
                  Sửa email
                </button>
                <button
                  className="text-primary hover:text-primary-container font-semibold transition-colors disabled:opacity-60"
                  disabled={isResending}
                  onClick={handleResendOtp}
                  type="button"
                >
                  {isResending ? 'Đang gửi lại...' : 'Gửi lại OTP'}
                </button>
              </div>
            </form>
          )}

          {step === 'password' && (
            <form className="space-y-5" method="POST" onSubmit={handleResetPassword}>
              <Field
                autoComplete="new-password"
                id="newPassword"
                label="Mật khẩu mới"
                onChange={setNewPassword}
                type="password"
                value={newPassword}
              />
              <Field
                autoComplete="new-password"
                id="confirmPassword"
                label="Xác nhận mật khẩu"
                onChange={setConfirmPassword}
                type="password"
                value={confirmPassword}
              />

              <button
                className="w-full flex justify-center py-3 bg-primary text-on-primary text-base font-bold rounded-xl hover:bg-primary-container active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
              </button>

              <div className="flex items-center justify-between text-xs font-medium">
                <button
                  className="text-on-surface-variant hover:text-primary transition-colors"
                  onClick={() => setStep('otp')}
                  type="button"
                >
                  Đổi mã OTP
                </button>
                <button
                  className="text-primary hover:text-primary-container font-semibold transition-colors disabled:opacity-60"
                  disabled={isResending}
                  onClick={handleResendOtp}
                  type="button"
                >
                  {isResending ? 'Đang gửi lại...' : 'Gửi lại OTP'}
                </button>
              </div>
            </form>
          )}

          <footer className="mt-8 text-center text-xs">
            <span className="text-on-surface-variant dark:text-outline-variant">
              Đã nhớ mật khẩu?
            </span>
            <Link
              className="text-primary hover:text-primary-container font-bold ml-1 transition-colors"
              to="/signin"
            >
              Đăng nhập
            </Link>
          </footer>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0 flex space-x-4 text-[10px] font-bold text-on-surface-variant/60 dark:text-outline-variant/40 uppercase tracking-widest whitespace-nowrap">
          <Link className="hover:text-primary transition-colors" to="#">
            Trợ giúp
          </Link>
          <Link className="hover:text-primary transition-colors" to="#">
            Điều khoản
          </Link>
          <Link className="hover:text-primary transition-colors" to="#">
            Bảo mật
          </Link>
          <span>© 2024 FixNow</span>
        </div>
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
