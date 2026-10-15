import type { BookingPolicies } from '../types/bookingPolicy.types';

const number = (value: number) => value.toLocaleString('vi-VN');
const money = (value: number) => `${number(value)}đ`;
const listClass = 'list-disc space-y-2 pl-5 text-sm leading-6 text-on-surface-variant';

export function BookingPolicyContent({ policies, depositAmount, payableDeposit }: {
  policies: BookingPolicies;
  depositAmount?: number;
  payableDeposit?: number;
}) {
  const { fixedPriceRefund: refund, matching } = policies;
  const tiers = [
    [`Từ ${number(refund.earlyHours)} giờ trở lên`, refund.earlyRefundPercent],
    [`Từ ${number(refund.middleHours)} đến dưới ${number(refund.earlyHours)} giờ`, refund.middleRefundPercent],
    [`Từ ${number(refund.lateHours)} đến dưới ${number(refund.middleHours)} giờ`, refund.lateRefundPercent],
    [`Dưới ${number(refund.lateHours)} giờ, chưa đến giờ hẹn`, refund.lastMinuteRefundPercent],
  ] as const;

  return <div className="space-y-6">
    <p className="text-sm leading-6 text-on-surface-variant">Các điều khoản dưới đây áp dụng cho đặt ngay, hẹn giờ và lịch định kỳ. Mức phí, tiền cọc và ưu đãi cụ thể của đơn được hiển thị trong phần tóm tắt trước khi xác nhận.</p>

    <section className="space-y-3">
      <h3 className="font-semibold text-on-surface">1. Đặt lịch, tìm thợ và thanh toán</h3>
      <ul className={listClass}>
        <li>Khách cần cung cấp đúng dịch vụ, số lượng, địa chỉ, thông tin liên hệ và mô tả công việc. Khung giờ đặt dịch vụ từ 08:00 đến 21:00 theo giờ Việt Nam; lịch hẹn không được sớm hơn phút hiện tại.</li>
        <li>Đơn cần thanh toán trước phải hoàn tất trong thời hạn hiển thị; thời gian giữ lịch chờ thanh toán mặc định theo cấu hình hiện tại là {number(policies.paymentHoldMinutes)} phút. Hết hạn có thể tự hủy; lịch định kỳ có thời hạn thanh toán riêng cho từng buổi được ghi trong đơn.</li>
        <li>Hệ thống tìm thợ trong bán kính {number(matching.initialRadiusKm)} km, mở rộng đến {number(matching.expandedRadiusKm)} km sau {number(matching.expandAfterMinutes)} phút và tìm thêm tối đa {number(matching.expandedDurationMinutes)} phút trong vòng mở rộng. Mỗi đề nghị có thời hạn phản hồi tối đa {number(matching.providerResponseSeconds)} giây và có thể kết thúc sớm khi chuyển vòng tìm kiếm.</li>
        <li>Với vòng tìm thợ tự động, nếu hết vòng mà không có thợ nhận, đơn được hủy và hoàn 100% khoản đã thanh toán. Với thợ được chọn trực tiếp, khách có thể được yêu cầu chọn thợ khác hoặc đồng ý tìm thợ thay thế.</li>
        <li>Chỉ khoản thanh toán được hệ thống xác nhận mới được tính vào số tiền hoàn hoặc cọc chuyển cho thợ. Khoản hoàn và trạng thái xử lý được hiển thị tại chi tiết đơn và lịch sử giao dịch.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h3 className="font-semibold text-on-surface">2. Dịch vụ giá cố định</h3>
      <ul className={listClass}>
        <li>Giá được tính theo dịch vụ, tùy chọn và số lượng đã chọn. Đơn giá cố định không thu cọc khảo sát riêng. Khách thanh toán số tiền của đơn bằng ví Handigo, chuyển khoản qua PayOS hoặc tiền mặt nếu phương thức đó khả dụng.</li>
        <li>Khách hủy khi chưa có thợ nhận: hoàn 100% khoản đã thanh toán.</li>
        <li>Khách hủy đơn đặt ngay/đơn gấp sau khi thợ đã nhận: hoàn {number(refund.normalRefundPercent)}% khoản đã thanh toán; phần còn lại là phí hủy.</li>
        <li>Với lịch hẹn hoặc định kỳ đã có thợ nhận, tỷ lệ hoàn phụ thuộc thời điểm hủy trước giờ thực hiện của từng buổi:</li>
      </ul>
      <table className="w-full table-fixed border-collapse text-sm leading-6">
        <thead><tr className="bg-surface-container-low text-left"><th scope="col" className="w-3/4 p-3 font-semibold">Thời gian trước giờ hẹn</th><th scope="col" className="p-3 font-semibold">Hoàn lại</th></tr></thead>
        <tbody>{tiers.map(([label, rate]) => <tr key={label} className="border-b border-outline-variant/30"><td className="p-3 text-on-surface-variant">{label}</td><td className="p-3 font-semibold tabular-nums">{number(rate)}%</td></tr>)}</tbody>
      </table>
      <ul className={listClass}>
        <li>Lịch hẹn đã đến hoặc quá giờ thực hiện không thể tự hủy theo luồng thông thường; khách cần liên hệ hỗ trợ. Nếu lịch cũ thiếu giờ bắt đầu, mức hoàn là {number(refund.missingScheduleRefundPercent)}%.</li>
        <li>Khi thợ hủy đơn đặt ngay/đơn gấp trước khi làm, khách có thể chọn tìm thợ thay thế hoặc hủy để được hoàn tiền. Đơn do hệ thống hoặc quản trị viên hủy trước khi làm được hoàn toàn bộ khoản đã thanh toán.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h3 className="font-semibold text-on-surface">3. Dịch vụ cần khảo sát và báo giá</h3>
      {depositAmount != null && <p className="rounded-xl bg-primary/5 p-3 text-sm leading-6 text-on-surface">Cọc của dịch vụ đang chọn: <strong>{money(depositAmount)}</strong>. {payableDeposit != null && <>Cọc cần thanh toán sau ưu đãi: <strong>{money(payableDeposit)}</strong>.</>}</p>}
      <ul className={listClass}>
        <li>Tiền cọc được hiển thị theo từng dịch vụ trước khi đặt đơn, thanh toán bằng ví Handigo hoặc PayOS; cọc không hỗ trợ tiền mặt. Thợ khảo sát và lưu báo giá sửa chữa. Chi phí sửa chữa còn lại được thanh toán trực tiếp cho thợ, có khấu trừ phần cọc thực trả.</li>
        <li><strong>Khách hủy khi chưa có thợ nhận:</strong> hoàn 100% tiền cọc thực trả.</li>
        <li><strong>Thợ hủy trước khi báo giá:</strong> Handigo tự điều phối thợ khác, giữ nguyên cọc; thợ vừa hủy không nhận cọc. Nếu không có thợ khác nhận trong vòng tìm kiếm, khách được hoàn 100% cọc.</li>
        <li><strong>Khách hủy khi thợ đã nhận đơn:</strong> toàn bộ cọc thực trả được tự động cộng vào ví thợ, kể cả khi chưa có báo giá.</li>
        <li><strong>Khách hoặc thợ hủy sau khi đã báo giá:</strong> toàn bộ cọc thực trả được tự động cộng vào ví thợ, không phụ thuộc lý do hủy. Khoản thanh toán thêm được hệ thống ghi nhận sẽ được hoàn cho khách.</li>
        <li>Quy tắc xử lý cọc trên áp dụng cho cả đặt ngay và lịch hẹn/định kỳ; các tỷ lệ hoàn theo giờ của dịch vụ giá cố định không áp dụng cho đơn báo giá.</li>
      </ul>
    </section>

    <section className="space-y-3">
      <h3 className="font-semibold text-on-surface">4. Ưu đãi, lịch định kỳ và hoàn thành đơn</h3>
      <ul className={listClass}>
        <li>Ưu đãi và mã giảm giá áp dụng theo điều kiện của từng chương trình. Với mã giảm cọc, khoản hoàn hoặc chuyển cho thợ được tính theo cọc thực trả sau ưu đãi. Không hoàn tiền cho phần giá trị được miễn hoặc giảm.</li>
        <li>Mỗi buổi định kỳ được theo dõi và xử lý thanh toán, hủy, hoàn tiền riêng. Khi chọn hủy các buổi còn lại, hệ thống tính theo trạng thái thực tế của từng buổi.</li>
        <li>Đơn đã bắt đầu thực hiện hoặc đã hoàn thành không thể hủy theo luồng thông thường. Khách cần liên hệ thợ hoặc gửi yêu cầu hỗ trợ/khiếu nại trong hệ thống khi có vấn đề.</li>
      </ul>
    </section>
  </div>;
}
