interface SocialButtonProps {
  provider: 'Google' | 'Facebook';
}

export function SocialButton({ provider }: SocialButtonProps) {
  return (
    <button
      type="button"
      className="social-login-button"
      aria-label={`Đăng nhập với ${provider}`}
    >
      <span>{provider}</span>
    </button>
  );
}
