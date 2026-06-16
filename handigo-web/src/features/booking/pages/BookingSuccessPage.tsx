import { Link } from 'react-router-dom';
import { BookingShell } from '../components/BookingComponents';
import { mapImage, selectedServiceImage } from '../data/bookingMockData';

const BookingSuccessPage = () => (
  <BookingShell>
    <main className="flex flex-col items-center justify-center py-lg">
      <div className="text-center mb-lg w-full max-w-2xl">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full mb-md animate-[float_4s_ease-in-out_infinite] shadow-lg shadow-emerald-200/50">
          <span className="material-symbols-outlined text-5xl font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
        </div>
        <h1 className="font-headline-xl text-headline-xl text-on-surface mb-sm">Đặt lịch thành công!</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Cảm ơn bạn đã tin tưởng HandiGo. Chuyên gia của chúng tôi sẽ sớm liên hệ với bạn.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-md w-full max-w-4xl">
        <section className="md:col-span-2 glass-card rounded-3xl p-md shadow-sm">
          <div className="flex justify-between items-start mb-md">
            <div>
              <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                Mã đơn hàng
              </span>
              <p className="font-headline-md text-headline-md text-primary">#HG-8829-2024</p>
            </div>
            <div className="bg-primary/10 text-primary px-sm py-xs rounded-full font-label-sm">Đã xác nhận</div>
          </div>

          <div className="space-y-md">
            <div className="flex gap-md">
              <img className="w-24 h-24 rounded-2xl object-cover shadow-sm" src={selectedServiceImage} alt="Dịch vụ đã đặt" />
              <div className="flex flex-col justify-center">
                <h2 className="font-headline-md text-headline-md text-on-surface">Vệ sinh căn hộ cao cấp</h2>
                <p className="text-on-surface-variant flex items-center gap-xs">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  4.9 (120 đánh giá)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md border-t border-outline-variant/30 pt-md">
              <div className="flex items-start gap-sm">
                <div className="p-2 bg-surface-container rounded-lg text-primary">
                  <span className="material-symbols-outlined">schedule</span>
                </div>
                <div>
                  <p className="font-label-sm text-on-surface-variant">Thời gian</p>
                  <p className="font-label-md text-on-surface">09:00 - Thứ Tư, 24/05/2024</p>
                </div>
              </div>
              <div className="flex items-start gap-sm">
                <div className="p-2 bg-surface-container rounded-lg text-primary">
                  <span className="material-symbols-outlined">location_on</span>
                </div>
                <div>
                  <p className="font-label-sm text-on-surface-variant">Địa chỉ</p>
                  <p className="font-label-md text-on-surface">Căn hộ B-1204, Vinhomes Central Park, Bình Thạnh, TP. HCM</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="md:col-span-1 flex flex-col gap-md">
          <div className="glass-card rounded-3xl p-md shadow-sm flex flex-col h-full">
            <h3 className="font-headline-md text-headline-md mb-md">Tóm tắt</h3>
            <div className="space-y-sm flex-grow">
              <div className="flex justify-between text-label-md">
                <span className="text-on-surface-variant">Giá dịch vụ</span>
                <span className="text-on-surface">450.000đ</span>
              </div>
              <div className="flex justify-between text-label-md">
                <span className="text-on-surface-variant">Phí di chuyển</span>
                <span className="text-on-surface">25.000đ</span>
              </div>
              <div className="flex justify-between text-label-md">
                <span className="text-on-surface-variant">Giảm giá</span>
                <span className="text-emerald-600">-50.000đ</span>
              </div>
            </div>
            <div className="border-t border-outline-variant/30 pt-sm mt-md">
              <div className="flex justify-between items-center">
                <span className="font-bold text-on-surface">Tổng cộng</span>
                <span className="font-headline-md text-headline-md text-primary">425.000đ</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-col sm:flex-row gap-md mt-lg w-full max-w-4xl">
        <Link
          to="/customer/bookings/HG-8829-2024"
          className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center justify-center gap-sm"
        >
          <span className="material-symbols-outlined">map</span>
          Theo dõi đơn hàng
        </Link>
        <Link
          to="/customer"
          className="flex-1 py-4 bg-surface-container-high/50 text-primary border border-outline-variant/30 rounded-2xl font-bold hover:bg-surface-container-highest/20 transition-all active:scale-95 flex items-center justify-center gap-sm"
        >
          <span className="material-symbols-outlined">home</span>
          Về trang chủ
        </Link>
      </div>

      <div className="w-full max-w-4xl mt-lg h-48 rounded-3xl overflow-hidden border border-outline-variant/30 relative shadow-sm">
        <div className="absolute inset-0 bg-slate-200 flex items-center justify-center overflow-hidden">
          <img className="w-full h-full object-cover opacity-60 grayscale" src={mapImage} alt="Bản đồ vị trí" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container/80 to-transparent" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-md py-xs rounded-full shadow-md flex items-center gap-sm">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
            <span className="text-label-sm font-label-sm text-on-surface">Đang tìm chuyên gia gần nhất...</span>
          </div>
        </div>
      </div>

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
    </main>
  </BookingShell>
);

export default BookingSuccessPage;
