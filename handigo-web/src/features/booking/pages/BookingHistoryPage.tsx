import { Link } from 'react-router-dom';
import { BookingHistoryCard, BookingPageHeader, BookingShell } from '../components/BookingComponents';
import { bookings } from '../data/bookingMockData';

const filters = ['Tất cả', 'Đang xử lý', 'Đã hoàn thành', 'Đã hủy'];

const BookingHistoryPage = () => (
  <BookingShell>
    <BookingPageHeader
      title="Lịch sử đặt lịch"
      description="Quản lý và theo dõi các dịch vụ bạn đã đặt trên HandiGo."
      action={
        <div className="flex flex-col md:flex-row gap-md items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              className="w-full pl-10 pr-4 py-3 bg-surface-container rounded-xl border-none focus:ring-2 focus:ring-primary/20 text-label-md"
              placeholder="Tìm kiếm đơn đặt chỗ..."
              type="text"
            />
          </div>
          <Link
            to="/customer/bookings/new"
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-on-primary px-lg py-3 rounded-xl font-label-md text-label-md shadow-md hover:bg-primary-container transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add</span>
            Tạo đơn dịch vụ mới
          </Link>
        </div>
      }
    />

    <div className="flex gap-sm overflow-x-auto pb-2">
      {filters.map((filter, index) => (
        <button
          key={filter}
          className={`px-md py-2 rounded-full font-label-md text-label-md whitespace-nowrap transition-all ${
            index === 0
              ? 'bg-primary text-on-primary shadow-md'
              : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10'
          }`}
        >
          {filter}
        </button>
      ))}
    </div>

    <div className="grid grid-cols-1 gap-md">
      {bookings.map((booking) => (
        <BookingHistoryCard key={booking.id} booking={booking} />
      ))}
    </div>

    <div className="pt-lg flex justify-center">
      <button className="px-lg py-3 border-2 border-primary/20 text-primary rounded-full font-label-md text-label-md hover:bg-primary/5 transition-all flex items-center gap-2 group">
        Xem thêm lịch sử
        <span className="material-symbols-outlined group-hover:translate-y-1 transition-transform">expand_more</span>
      </button>
    </div>
  </BookingShell>
);

export default BookingHistoryPage;
