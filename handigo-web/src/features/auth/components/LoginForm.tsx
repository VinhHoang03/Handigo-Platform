import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FloatingInput } from '@/components/common/FloatingField';
import { useAuth } from '../hooks/useAuth';
import { getRoleHomePath } from '../utils/roleNavigation';

interface LoginFormProps {
  rememberMe: boolean;
  onRememberMeChange: (checked: boolean) => void;
}

export function LoginForm({ rememberMe, onRememberMeChange }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const user = await login({ email: email.trim().toLowerCase(), password }, rememberMe);
    if (user) navigate(getRoleHomePath(user.role, user.providerOnboardingStatus), { replace: true });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && <div role="alert" className="rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">{error}</div>}
      <FloatingInput id="login-email" label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onValueChange={setEmail} />
      <FloatingInput id="login-password" label="Mật khẩu" type="password" autoComplete="current-password" required value={password} onValueChange={setPassword} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-on-surface-variant">
          <input type="checkbox" checked={rememberMe} onChange={(event) => onRememberMeChange(event.target.checked)} className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary" />
          <span>Ghi nhớ đăng nhập</span>
        </label>
        <Link className="inline-flex min-h-11 items-center font-medium text-primary hover:text-primary-hover" to="/forgot-password">Quên mật khẩu?</Link>
      </div>
      <button type="submit" disabled={isLoading} className="btn-primary w-full">{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
    </form>
  );
}
