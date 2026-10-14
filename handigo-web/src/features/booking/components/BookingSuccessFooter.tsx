export const BookingSuccessFooter = () => (
  <footer className="mt-4 py-3 border-t border-outline-variant/20 w-full max-w-4xl">
    <div className="mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
      <div className="flex items-center gap-sm">
        <span className="font-headline-md text-lg font-extrabold text-primary/50">HandiGo</span>
        <span className="text-on-surface-variant text-label-sm">© 2026 Dịch vụ gia đình cao cấp</span>
      </div>
      <div className="flex gap-md text-on-surface-variant text-label-sm">
        <a className="hover:text-primary transition-colors" href="#">
          Điều khoản
        </a>
        <a className="hover:text-primary transition-colors" href="#">
          Bảo mật
        </a>
        <a className="hover:text-primary transition-colors" href="#">
          Hỗ trợ
        </a>
      </div>
    </div>
  </footer>
);
