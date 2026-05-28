import React, { useState } from "react";
import { Link } from "react-router-dom";
import logoImg from "../../../assets/logo.png";
import loginImg from "../../../assets/login.png";
import { LoginForm } from "../components/LoginForm";
import SocialLoginButtons from "../components/SocialLoginButtons";

const LoginPage: React.FC = () => {
  const [socialError, setSocialError] = useState<string | null>(null);
  return (
    <main className="h-screen w-screen flex items-stretch overflow-hidden bg-background">
      {/* Left Side: Brand Imagery */}
      <section className="hidden lg:flex w-[45%] h-full relative flex-col items-center justify-center overflow-hidden bg-primary p-8">
        {/* Decorative Elements */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-secondary-container/20 rounded-full blur-[80px]"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-inverse-primary/20 rounded-full blur-[70px]"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-[400px]">
          <div className="flex items-center gap-2 mb-2">
            <img src={logoImg} alt="FixNow Logo" className="h-10 w-auto" />
            <h2 className="text-xl font-bold text-white">FixNow</h2>
          </div>
          <h1 className="text-2xl xl:text-3xl font-bold text-white mb-4 leading-tight">
            The Dependable Expert in{" "}
            <span className="text-secondary-fixed">Home Services.</span>
          </h1>
          <p className="text-sm xl:text-base text-on-primary-container/80 mb-8">
            Kết nối bạn với những chuyên gia hàng đầu cho mọi nhu cầu sửa chữa
            và bảo trì tổ ấm của bạn.
          </p>
          <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden shadow-2xl group">
            <img
              className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-105"
              src={loginImg}
              alt="Home maintenance illustration"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent"></div>
          </div>
        </div>
      </section>

      {/* Right Side: Login Panel */}
      <section className="w-full lg:w-[55%] h-full flex items-center justify-center p-4 md:p-8 relative bg-surface">
        {/* Theme Toggle */}
        <button className="absolute top-4 right-4 p-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant">
          <span className="material-symbols-outlined text-xl">dark_mode</span>
        </button>

        {/* Login Card */}
        <div className="w-full max-w-[400px] bg-white/70 dark:bg-inverse-surface/70 backdrop-blur-xl p-6 md:p-10 rounded-2xl border border-outline-variant/30 shadow-xl">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <img src={logoImg} alt="FixNow Logo" className="h-12 w-auto mb-2" />
            <h2 className="text-xl font-bold text-primary">FixNow</h2>
          </div>

          <header className="mb-8">
            <h2 className="text-2xl font-bold text-on-surface dark:text-surface-bright mb-1">
              Chào mừng trở lại
            </h2>
            <p className="text-sm text-on-surface-variant dark:text-outline-variant">
              Vui lòng đăng nhập vào tài khoản của bạn.
            </p>
          </header>

          <LoginForm />

          <div className="relative my-8 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-outline-variant dark:border-outline/20"></div>
            </div>
            <span className="relative px-3 bg-white dark:bg-inverse-surface text-on-surface-variant dark:text-outline-variant text-[10px] uppercase font-bold tracking-wider">
              HOẶC
            </span>
          </div>

          {socialError && (
            <div className="mb-4 p-3 text-sm text-error bg-error-container rounded-xl">
              {socialError}
            </div>
          )}

          <SocialLoginButtons onError={setSocialError} />

          <footer className="text-center text-xs">
            <span className="text-on-surface-variant dark:text-outline-variant">
              Bạn chưa có tài khoản?
            </span>
            <Link
              className="text-primary hover:text-primary-container font-bold ml-1 transition-colors"
              to="/register"
            >
              Đăng ký ngay
            </Link>
          </footer>
        </div>

        {/* Language/Legal Links */}
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

export default LoginPage;
