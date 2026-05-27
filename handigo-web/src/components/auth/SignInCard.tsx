import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi';
import { BrandLogo } from '../common/BrandLogo';
import { FloatingInput } from './FloatingInput';
import { SocialButton } from './SocialButton';

const Divider = () => (
  <div className="relative my-8 text-center">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-outline-variant dark:border-outline/20" />
    </div>
    <span className="relative px-3 bg-white dark:bg-inverse-surface text-on-surface-variant dark:text-outline-variant text-[10px] uppercase font-bold tracking-wider">HOẶC</span>
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
      await authApi.login(email, password);
      navigate('/profile');
    } catch {
      setError('Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] bg-white/70 dark:bg-inverse-surface/70 backdrop-blur-xl p-6 md:p-10 rounded-2xl border border-outline-variant/30 shadow-xl">
      <div className="flex flex-col items-center mb-6 lg:hidden">
        <BrandLogo />
      </div>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-on-surface dark:text-surface-bright mb-1">Chào mừng trở lại</h2>
        <p className="text-sm text-on-surface-variant dark:text-outline-variant">Vui lòng đăng nhập vào tài khoản của bạn.</p>
      </header>
      <form className="space-y-5" method="POST" onSubmit={handleSubmit}>
        <FloatingInput id="identifier" label="Email" type="email" value={email} onChange={setEmail} />
        <FloatingInput id="password" label="Mật khẩu" type="password" trailingIcon="visibility" value={password} onChange={setPassword} />
        <div className="flex items-center justify-between text-xs font-medium">
          <label className="flex items-center space-x-2 cursor-pointer group">
            <input className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary bg-transparent" type="checkbox" />
            <span className="text-on-surface-variant dark:text-outline-variant group-hover:text-primary transition-colors">Ghi nhớ</span>
          </label>
          <Link className="text-primary hover:text-primary-container font-semibold transition-colors" to="#">Quên mật khẩu?</Link>
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        <button className="w-full py-3 bg-primary text-on-primary text-base font-bold rounded-xl hover:bg-primary-container active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-60" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
      <Divider />
      <div className="grid grid-cols-2 gap-3 mb-8">
        <SocialButton provider="Google" />
        <SocialButton provider="Facebook" />
      </div>
      <footer className="text-center text-xs">
        <span className="text-on-surface-variant dark:text-outline-variant">Bạn chưa có tài khoản?</span>
        <Link className="text-primary hover:text-primary-container font-bold ml-1 transition-colors" to="#">Đăng ký ngay</Link>
      </footer>
    </div>
  );
};
