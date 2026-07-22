import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import logoImg from "../../assets/logo.png";
import loginImg from "../../assets/login.png";

interface AuthLayoutProps {
  eyebrow?: string;
  title: string;
  description: string;
  brandTitle: string;
  brandDescription: string;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

const maxWidthClass: Record<
  NonNullable<AuthLayoutProps["maxWidth"]>,
  string
> = {
  sm: "max-w-[480px]",
  md: "max-w-[480px]",
  lg: "max-w-[680px]",
};

export function AuthLayout({
  eyebrow,
  title,
  description,
  brandTitle,
  brandDescription,
  children,
  maxWidth = "md",
}: AuthLayoutProps) {
  return (
    <main id="main-content" className="h-dvh min-h-dvh overflow-hidden bg-background lg:grid lg:grid-cols-2">
      <section className="relative hidden h-full min-h-0 min-w-0 overflow-hidden bg-primary px-8 py-8 lg:flex lg:items-center lg:justify-center xl:px-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-secondary-container/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-inverse-primary/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0,transparent_58%)]" />
        </div>

        <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-[520px] flex-col items-center text-center">
          <Link
            to="/"
            className="mb-5 inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 backdrop-blur"
          >
            <img
              src={logoImg}
              alt=""
              className="h-9 w-9 object-contain rounded-lg"
            />
            <span className="font-headline-md text-xl font-bold text-on-primary">
              Handigo
            </span>
          </Link>
          <h1 className="max-w-[520px] font-headline-lg text-3xl font-semibold leading-tight text-on-primary xl:text-4xl">
            {brandTitle}
          </h1>
          <p className="mt-3 max-w-[500px] text-base leading-7 text-on-primary-container">
            {brandDescription}
          </p>
          {/* Ảnh minh hoạ có nền trắng đặc, nên đóng khung trên nền sáng để
              trông có chủ đích thay vì như một ô trắng dán nhầm lên nền indigo.
              (Class cũ `mix-blend-mode-screen` không tồn tại trong Tailwind —
              đúng phải là `mix-blend-screen` — nên hiệu ứng hoà trộn chưa từng
              được áp dụng; mà blend cũng không cứu được ảnh nền trắng trên nền
              tối, đã thử tách nền nhưng bóng đổ để lại vệt trắng.) */}
          <div className="mt-6 w-full max-w-[460px] overflow-hidden rounded-3xl bg-surface-container-lowest p-4 shadow-[0_16px_48px_-16px_rgba(0,0,0,0.35)]">
            <img
              src={loginImg}
              alt="Minh hoạ dịch vụ chăm sóc và sửa chữa nhà cửa"
              className="aspect-[4/3] w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      </section>

      <section className="relative flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden px-4 py-4 sm:px-6 lg:px-8 lg:py-6 xl:px-12">
        <div
          className={`flex w-full min-w-0 flex-col items-center lg:min-w-[400px] [@media(max-height:760px)]:scale-[0.94] [@media(max-height:680px)]:scale-[0.88] ${maxWidthClass[maxWidth]}`}
        >
          <Link
            to="/"
            className="mb-4 flex items-center justify-center gap-2 lg:hidden"
          >
            <img
              src={logoImg}
              alt=""
              className="h-11 w-11 object-contain rounded-lg"
            />
            <span className="font-headline-md text-2xl font-bold text-primary">
              Handigo
            </span>
          </Link>

          {/* Trước đây dùng `.glass-panel` (nền mờ + backdrop-blur). Đây là chỗ
              duy nhất trong app dùng class đó, và hiệu ứng kính mờ không mang
              lại gì trên nền đặc — thay bằng bề mặt đặc theo token. */}
          <div className="w-full rounded-[28px] border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-[0_12px_40px_-12px_rgba(19,27,46,0.16)] sm:p-7 lg:p-8">
            <header className="mb-4 sm:mb-5">
              {eyebrow && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {eyebrow}
                </p>
              )}
              <h2 className="font-headline-lg text-2xl font-semibold text-on-surface sm:text-3xl">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {description}
              </p>
            </header>
            {children}
          </div>

          <footer className="mt-4 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 text-center text-xs leading-5 text-on-surface-variant sm:mt-5 sm:gap-x-6 sm:text-[13px]">
            <Link className="transition-colors hover:text-primary" to="#">
              Trợ giúp
            </Link>
            <Link className="transition-colors hover:text-primary" to="#">
              Điều khoản
            </Link>
            <Link className="transition-colors hover:text-primary" to="#">
              Bảo mật
            </Link>
            <span>© 2026 Handigo</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
