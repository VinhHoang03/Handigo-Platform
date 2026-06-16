import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '../components/LoginForm';
import SocialLoginButtons from '../components/SocialLoginButtons';

export default function LoginPage() {
  const location = useLocation();
  const [rememberMe, setRememberMe] = useState(
    localStorage.getItem('handigo:remember-login') !== 'false',
  );
  const [socialError, setSocialError] = useState<string | null>(null);
  const successMessage = (location.state as { message?: string } | null)?.message;

  return (
    <AuthLayout
      maxWidth="sm"
      title="Chào mừng trở lại"
      description="Đăng nhập để tiếp tục quản lý lịch đặt và dịch vụ của bạn."
      brandTitle="Chuyên gia đáng tin cậy cho mọi dịch vụ tại nhà."
      brandDescription="Kết nối nhanh với đội ngũ chuyên nghiệp đã được kiểm duyệt, theo dõi công việc minh bạch và an tâm trong từng lần đặt lịch."
    >
      {successMessage && (
        <div className="mb-5 rounded-xl border border-secondary/20 bg-secondary/10 p-3 text-sm text-secondary">
          {successMessage}
        </div>
      )}

      <LoginForm rememberMe={rememberMe} onRememberMeChange={setRememberMe} />

      <div className="relative my-4 flex items-center sm:my-5">
        <div className="h-px flex-1 bg-outline-variant/60" />
        <span className="px-3 text-xs font-medium uppercase tracking-wider text-on-surface-variant">
          Hoặc
        </span>
        <div className="h-px flex-1 bg-outline-variant/60" />
      </div>

      {socialError && (
        <div role="alert" className="mb-4 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
          {socialError}
        </div>
      )}
      <SocialLoginButtons
        rememberMe={rememberMe}
        onError={(message) => setSocialError(message)}
      />

      <p className="mt-5 text-center text-sm text-on-surface-variant">
        Chưa có tài khoản?{' '}
        <Link className="font-semibold text-primary hover:text-primary-container" to="/register">
          Đăng ký ngay
        </Link>
      </p>
    </AuthLayout>
  );
}
