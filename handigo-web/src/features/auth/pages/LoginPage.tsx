import React from "react";
import { Link } from "react-router-dom";
import logoImg from "../../../assets/logo.png";
import loginImg from "../../../assets/login.png";
import { LoginForm } from "../components/LoginForm";

const LoginPage: React.FC = () => {
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

          <div className="grid grid-cols-2 gap-3 mb-8">
            <button className="flex items-center justify-center space-x-2 py-2.5 px-4 border border-outline-variant dark:border-outline/30 rounded-xl hover:bg-surface-container-high dark:hover:bg-on-surface-variant/20 transition-all text-xs font-bold text-on-surface dark:text-surface-bright">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                ></path>
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                ></path>
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81.42z"
                  fill="#FBBC05"
                ></path>
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                ></path>
              </svg>
              <span>Google</span>
            </button>
            <button className="flex items-center justify-center space-x-2 py-2.5 px-4 border border-outline-variant dark:border-outline/30 rounded-xl hover:bg-surface-container-high dark:hover:bg-on-surface-variant/20 transition-all text-xs font-bold text-on-surface dark:text-surface-bright">
              <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path>
              </svg>
              <span>Facebook</span>
            </button>
          </div>

          <footer className="text-center text-xs">
            <span className="text-on-surface-variant dark:text-outline-variant">
              Bạn chưa có tài khoản?
            </span>
            <Link
              className="text-primary hover:text-primary-container font-bold ml-1 transition-colors"
              to="#"
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
