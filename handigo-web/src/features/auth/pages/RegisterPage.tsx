import React from 'react';
import { Link } from 'react-router-dom';

const RegisterPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-white dark:bg-inverse-surface p-8 rounded-2xl shadow-xl">
        <h2 className="text-2xl font-bold mb-4">Đăng ký tài khoản</h2>
        <p className="text-on-surface-variant mb-6">Tính năng đang được phát triển...</p>
        <Link to="/signin" className="text-primary hover:underline">Quay lại Đăng nhập</Link>
      </div>
    </div>
  );
};

export default RegisterPage;
