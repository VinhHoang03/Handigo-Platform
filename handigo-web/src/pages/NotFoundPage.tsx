import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6">
      <section className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase text-primary">404</p>
        <h1 className="mt-3 text-headline-lg font-bold">Không tìm thấy trang</h1>
        <p className="mt-3 text-on-surface-variant">
          Đường dẫn không tồn tại hoặc đã được thay đổi. Phiên đăng nhập của bạn vẫn được giữ nguyên.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-2.5"
          >
            <ArrowLeft size={18} /> Quay lại
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-on-primary"
          >
            <Home size={18} /> Trang chủ
          </button>
        </div>
      </section>
    </main>
  );
}
