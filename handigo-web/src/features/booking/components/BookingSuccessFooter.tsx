export const BookingSuccessFooter = () => (
  <footer className="mt-auto px-md py-lg border-t border-outline-variant/20 w-full">
    <div className="container-max mx-auto flex flex-col md:flex-row justify-between items-center gap-md">
      <div className="flex items-center gap-sm">
        <span className="font-headline-md text-headline-md font-extrabold text-primary/50">HandiGo</span>
        <span className="text-on-surface-variant text-label-sm">© 2024 Dịch vụ gia đình cao cấp</span>
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
