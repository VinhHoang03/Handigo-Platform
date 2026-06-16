import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../features/auth/services/auth.service';
import { BrandLogo } from '../common/BrandLogo';
import { FloatingInput } from '../common/FloatingField';
import { SocialButton } from './SocialButton';

const Divider = () => (
  <div className="relative my-8 text-center">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-outline-variant dark:border-outline/20" />
    </div>
    <span className="relative bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant dark:bg-inverse-surface dark:text-outline-variant">
      Hoặc
    </span>
  </div>
);

export const SignInCard = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await authService.login({ email, password });
      navigate(response.user.role === 'PROVIDER' ? '/provider' : '/customer');
    } catch {
      setError('Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-outline-variant/30 bg-white/70 p-6 shadow-xl backdrop-blur-xl dark:bg-inverse-surface/70 md:p-10">
      <div className="mb-6 flex flex-col items-center lg:hidden">
        <BrandLogo />
      </div>
      <header className="mb-8">
        <h2 className="mb-1 text-2xl font-bold text-on-surface dark:text-surface-bright">
          Chào mừng trở lại
        </h2>
        <p className="text-sm text-on-surface-variant dark:text-outline-variant">
          Vui lòng đăng nhập vào tài khoản của bạn.
        </p>
      </header>
      <form className="space-y-5" method="POST" onSubmit={handleSubmit}>
        <FloatingInput
          id="identifier"
          label="Email"
          type="email"
          value={email}
          onValueChange={setEmail}
        />
        <FloatingInput
          id="password"
          label="Mật khẩu"
          type="password"
          value={password}
          onValueChange={setPassword}
        />
        <div className="flex items-center justify-between text-xs font-medium">
          <label className="group flex cursor-pointer items-center space-x-2">
            <input
              className="h-4 w-4 rounded border-outline-variant bg-transparent text-primary focus:ring-primary"
              type="checkbox"
            />
            <span className="text-on-surface-variant transition-colors group-hover:text-primary dark:text-outline-variant">
              Ghi nhớ
            </span>
          </label>
          <Link className="font-semibold text-primary transition-colors hover:text-primary-container" to="#">
            Quên mật khẩu?
          </Link>
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          className="w-full rounded-xl bg-primary py-3 text-base font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-container active:scale-95 disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
      <Divider />
      <div className="mb-8 grid grid-cols-2 gap-3">
        <SocialButton provider="Google" />
        <SocialButton provider="Facebook" />
      </div>
      <footer className="text-center text-xs">
        <span className="text-on-surface-variant dark:text-outline-variant">
          Bạn chưa có tài khoản?
        </span>
        <Link className="ml-1 font-bold text-primary transition-colors hover:text-primary-container" to="#">
          Đăng ký ngay
        </Link>
      </footer>
    </div>
  );
};
