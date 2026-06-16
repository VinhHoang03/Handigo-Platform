import { BookingPageHeader, BookingShell, BookingStepper, OrderSummaryCard } from '../components/BookingComponents';

const paymentMethods = [
  ['account_balance_wallet', 'Ví HandiGo', 'Số dư: 1.500.000đ', 'wallet'],
  ['credit_card', 'Thẻ tín dụng/ghi nợ', 'Visa, Mastercard, JCB', 'card'],
  ['account_balance', 'Chuyển khoản ngân hàng', 'Quét mã VietQR hoặc Internet Banking', 'bank'],
  ['payments', 'Tiền mặt', 'Thanh toán trực tiếp cho nhân viên', 'cash'],
];

const detailItems = [
  ['cleaning_services', 'Dịch vụ', 'Tổng vệ sinh nhà cửa'],
  ['calendar_today', 'Thời gian', '09:00, Thứ 7 - 24/05/2024'],
  ['location_on', 'Địa chỉ', '245 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh'],
];

const ConfirmPaymentPage = () => (
  <BookingShell>
    <BookingPageHeader
      title="Đặt lịch dịch vụ"
      description="Vui lòng kiểm tra lại thông tin và chọn phương thức thanh toán."
    />
    <BookingStepper currentStep={3} />

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
      <div className="lg:col-span-8 space-y-gutter">
        <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
          <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">receipt_long</span>
            Chi tiết dịch vụ
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {detailItems.map(([icon, label, value], index) => (
              <div key={label} className={`flex items-start gap-4 ${index === 2 ? 'md:col-span-2' : ''}`}>
                <div className="bg-primary-fixed-dim/30 p-3 rounded-lg text-primary">
                  <span className="material-symbols-outlined">{icon}</span>
                </div>
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant">{label}</p>
                  <p className="font-body-md text-body-md font-semibold">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant/30 shadow-sm">
          <h2 className="font-headline-md text-headline-md mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
            Phương thức thanh toán
          </h2>
          <div className="space-y-3">
            {paymentMethods.map(([icon, title, subtitle, value], index) => (
              <label
                key={value}
                className="group relative flex items-center p-4 rounded-xl border border-outline-variant/50 hover:border-primary cursor-pointer transition-all bg-surface-container-low/30 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input defaultChecked={index === 0} className="hidden peer" name="payment" type="radio" value={value} />
                <div className="flex-1 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${index === 0 ? 'bg-primary-container text-white' : 'bg-on-surface/5 text-on-surface'}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                  </div>
                  <div>
                    <p className="font-body-md text-body-md font-semibold">{title}</p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">{subtitle}</p>
                  </div>
                </div>
                <div className="w-6 h-6 border-2 border-outline-variant rounded-full peer-checked:border-primary peer-checked:bg-primary flex items-center justify-center transition-all">
                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="lg:col-span-4">
        <OrderSummaryCard
          step={3}
          actionLabel="Xác nhận & Thanh toán"
          actionTo="/customer/bookings/success"
          total="457.600đ"
        />
      </div>
    </div>
  </BookingShell>
);

export default ConfirmPaymentPage;
