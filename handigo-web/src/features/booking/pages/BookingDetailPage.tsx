import { Link } from 'react-router-dom';
import { BookingShell } from '../components/BookingComponents';
import { mapImage, providerAvatar } from '../data/bookingMockData';

const timeline = [
  {
    icon: 'check',
    title: 'Đã xác nhận thợ',
    description: 'Thợ Nguyễn Văn An đã nhận lời thực hiện dịch vụ.',
    time: '09:15, 24 Tháng 5, 2024',
    state: 'done',
  },
  {
    icon: 'location_on',
    title: 'Thợ đã đến nơi',
    description: 'Thợ đã có mặt tại địa chỉ yêu cầu và bắt đầu khảo sát.',
    time: '13:45, 24 Tháng 5, 2024',
    state: 'done',
  },
  {
    icon: 'build',
    title: 'Đang thực hiện',
    description: 'Vệ sinh dàn lạnh, kiểm tra áp suất gas và thông tắc ống thoát nước ngưng.',
    time: 'Bắt đầu lúc 14:00 (Đã làm 45 phút)',
    state: 'active',
  },
  {
    icon: 'verified',
    title: 'Hoàn thành & nghiệm thu',
    description: 'Dự kiến hoàn thành lúc 15:30',
    time: '',
    state: 'pending',
  },
];

const BookingDetailPage = () => (
  <BookingShell>
    <div className="flex items-center gap-sm">
      <Link to="/customer/bookings" className="material-symbols-outlined text-primary p-xs hover:bg-surface-container rounded-full transition-colors">
        arrow_back
      </Link>
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Theo dõi đơn hàng</h1>
        <p className="text-on-surface-variant">Cập nhật trạng thái thực hiện dịch vụ theo thời gian gần nhất.</p>
      </div>
    </div>

    <main className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      <div className="lg:col-span-8 flex flex-col gap-md">
        <section className="glass-card rounded-xl p-md shadow-sm">
          <div className="flex flex-col md:flex-row md:justify-between gap-md mb-sm">
            <div>
              <span className="bg-primary/10 text-primary px-sm py-xs rounded-full font-label-sm text-label-sm mb-xs inline-block">
                Mã đơn: #HG-98231
              </span>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">Sửa chữa máy lạnh chuyên sâu</h2>
            </div>
            <div className="flex flex-col md:items-end">
              <span className="flex items-center gap-xs text-primary font-bold">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Đang thực hiện
              </span>
              <p className="text-on-surface-variant text-label-md font-label-md mt-1">Dự kiến xong lúc: 15:30</p>
            </div>
          </div>
          <div className="h-px bg-outline-variant/30 my-md" />
          <div className="grid md:grid-cols-2 gap-md">
            <div>
              <span className="text-on-surface-variant text-label-sm font-label-sm">ĐỊA ĐIỂM</span>
              <p className="font-medium">245 Trần Hưng Đạo, Quận 1, TP. HCM</p>
            </div>
            <div className="md:text-right">
              <span className="text-on-surface-variant text-label-sm font-label-sm">TỔNG THANH TOÁN</span>
              <p className="font-bold text-primary text-body-lg font-body-lg">450.000đ</p>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-xl p-md shadow-sm overflow-hidden">
          <h2 className="font-headline-md text-headline-md mb-md">Trạng thái chi tiết</h2>
          <div>
            {timeline.map((step, index) => {
              const isDone = step.state === 'done';
              const isActive = step.state === 'active';
              const isLast = index === timeline.length - 1;

              return (
                <div key={step.title} className={`flex gap-md ${step.state === 'pending' ? 'opacity-50' : ''}`}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shrink-0 ${
                        isDone
                          ? 'bg-primary text-white'
                          : isActive
                            ? 'bg-primary-container text-primary border-4 border-white shadow-sm'
                            : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${isActive ? 'animate-pulse' : ''}`}>{step.icon}</span>
                    </div>
                    {!isLast ? <div className={`w-0.5 h-16 ${isDone || isActive ? 'bg-primary' : 'bg-surface-container-high'}`} /> : null}
                  </div>
                  <div className="pb-base">
                    <h3 className={`font-bold ${isActive ? 'text-primary font-headline-md text-headline-md' : 'text-on-surface'}`}>
                      {step.title}
                    </h3>
                    {isActive ? (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-sm mt-xs">
                        <p className="text-on-surface-variant font-medium">Công việc hiện tại:</p>
                        <p className="text-sm mt-xs text-on-surface-variant">{step.description}</p>
                      </div>
                    ) : (
                      <p className="text-on-surface-variant text-label-md font-label-md">{step.description}</p>
                    )}
                    {step.time ? <span className={`text-xs mt-1 block ${isActive ? 'text-primary font-bold' : 'text-outline'}`}>{step.time}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="lg:col-span-4 flex flex-col gap-md">
        <section className="glass-card rounded-xl p-md shadow-sm border-l-4 border-l-primary">
          <h2 className="font-label-sm text-label-sm text-on-surface-variant mb-md uppercase tracking-wider">Thông tin thợ</h2>
          <div className="flex items-center gap-md mb-md">
            <div className="relative">
              <img className="w-20 h-20 rounded-xl object-cover shadow-sm" src={providerAvatar} alt="Thợ Nguyễn Văn An" />
              <span className="absolute -bottom-2 -right-2 bg-green-500 w-5 h-5 rounded-full border-2 border-white" />
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Nguyễn Văn An</h3>
              <div className="flex items-center gap-1 text-tertiary">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  star
                </span>
                <span className="font-bold">4.9</span>
                <span className="text-on-surface-variant text-label-sm font-normal">(128 đánh giá)</span>
              </div>
              <span className="text-on-surface-variant text-label-md font-label-md">8 năm kinh nghiệm</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-sm mb-md">
            {[
              ['security', 'Đã xác thực'],
              ['local_shipping', 'Xe máy riêng'],
            ].map(([icon, label]) => (
              <div key={label} className="bg-surface-container rounded-lg p-sm flex flex-col items-center">
                <span className="material-symbols-outlined text-primary mb-1">{icon}</span>
                <span className="text-[10px] text-on-surface-variant uppercase">{label}</span>
              </div>
            ))}
          </div>
          <div className="space-y-sm">
            <button className="w-full bg-primary text-white py-sm rounded-xl font-bold flex items-center justify-center gap-base active:scale-95 transition-transform hover:shadow-lg hover:bg-primary-container">
              <span className="material-symbols-outlined">chat</span>
              Chat với thợ
            </button>
            <button className="w-full border border-outline-variant text-on-surface py-sm rounded-xl font-medium flex items-center justify-center gap-base hover:bg-surface-container transition-all active:scale-[0.98]">
              <span className="material-symbols-outlined">call</span>
              Gọi điện
            </button>
          </div>
        </section>

        <section className="bg-surface-container-low rounded-xl p-md border border-outline-variant/30">
          <div className="flex items-center gap-sm mb-sm text-on-surface">
            <span className="material-symbols-outlined text-primary">support_agent</span>
            <h2 className="font-bold">Bạn cần hỗ trợ?</h2>
          </div>
          <p className="text-on-surface-variant text-label-md mb-md leading-relaxed">
            Đội ngũ HandiGo luôn sẵn sàng giải quyết mọi vấn đề phát sinh trong quá trình sửa chữa.
          </p>
          <button className="text-primary font-bold flex items-center gap-xs hover:translate-x-1 transition-transform">
            Trung tâm trợ giúp
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </section>

        <section className="glass-card rounded-xl overflow-hidden shadow-sm h-48 relative">
          <img className="absolute inset-0 w-full h-full object-cover opacity-80" src={mapImage} alt="Bản đồ vị trí thực hiện" />
          <div className="absolute top-md left-md bg-white/90 backdrop-blur-sm px-sm py-xs rounded-full flex items-center gap-base shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs font-bold">Vị trí thực hiện</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full scale-[2] animate-ping" />
              <div className="w-8 h-8 bg-primary rounded-full border-4 border-white shadow-md flex items-center justify-center relative">
                <span className="material-symbols-outlined text-white text-[16px]">home</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </main>
  </BookingShell>
);

export default BookingDetailPage;
