import '../lib/features/orders/domain/order_summary.dart';

void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

void main() {
  final deadline = DateTime.utc(2026, 10, 15, 1, 5);
  OrderDetail order(String status, {DateTime? expiresAt}) => OrderDetail(
    id: 'don-kiem-thu',
    code: 'ORD-KIEMTHU',
    serviceName: 'Dịch vụ',
    status: status,
    paymentStatus: 'paid',
    paymentMethod: 'wallet',
    customerCancellationDeadline: expiresAt,
  );

  {
    for (final status in ['accepted']) {
      final item = order(status, expiresAt: deadline);
      check(
        item.canCancelAt(deadline.subtract(const Duration(seconds: 1))),
        'Phải cho hủy trước thời hạn.',
      );
      check(item.canCancelAt(deadline), 'Phải cho hủy đúng mốc 5 phút.');
      check(
        !item.canCancelAt(deadline.add(const Duration(milliseconds: 1))),
        'Phải khóa hủy khi quá hạn.',
      );
    }
  }

  {
    check(
      !order('in_progress', expiresAt: deadline).canCancelAt(deadline),
      'Không cho khách hủy khi thợ đã bắt đầu.',
    );
    check(
      order('created').canCancelAt(deadline),
      'Đơn chưa nhận vẫn được hủy.',
    );
    for (final status in [
      'accepted',
      'in_progress',
      'completed',
      'cancelled',
    ]) {
      check(
        !order(status).canCancelAt(deadline),
        'Không mở hủy khi thiếu mốc nhận hoặc đơn đã kết thúc.',
      );
    }
  }

  {
    final item = OrderDetail.fromJson({
      '_id': 'don-kiem-thu',
      'status': 'accepted',
      'customerCancellationDeadline': deadline.toIso8601String(),
    });
    check(
      item.customerCancellationDeadline == deadline,
      'Phải đọc đúng thời hạn server.',
    );
    check(
      !CancellationPreview.fromJson({'canCancel': false}).canCancel,
      'Phải giữ quyền hủy do server trả về.',
    );
  }
  print(
    'Đạt kiểm thử thời hạn hủy trên app: trước hạn, đúng 5 phút, quá hạn, dữ liệu cũ và phản hồi API.',
  );
}
