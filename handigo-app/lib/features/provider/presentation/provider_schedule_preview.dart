import '../../orders/domain/order_summary.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final providerUiPreviewProvider =
    NotifierProvider<ProviderUiPreviewController, List<OrderSummary>?>(
      ProviderUiPreviewController.new,
    );

class ProviderUiPreviewController extends Notifier<List<OrderSummary>?> {
  @override
  List<OrderSummary>? build() => null;

  void setEnabled(bool enabled) {
    if (kDebugMode) {
      state = enabled ? createSchedulePreviewOrders(DateTime.now()) : null;
    }
  }
}

/// Dữ liệu xem thử chỉ được tạo trong bộ nhớ khi người dùng bật chế độ debug.
List<OrderSummary> createSchedulePreviewOrders(DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  return [
    OrderSummary(
      id: 'preview-schedule-cancelled',
      code: 'XEM-THU-007',
      serviceName: 'Sửa vòi sen phòng tắm',
      status: 'cancelled',
      scheduledAt: DateTime(today.year, today.month, today.day - 1, 11),
      addressLabel: 'Phường Tân Phong, Quận 7',
      customerName: 'Chị Hạnh',
      totalAmount: 180000,
      providerAmount: 153000,
      durationMinutes: 60,
      problemDescription: 'Vòi sen bị rò nước và áp lực nước yếu.',
    ),
    OrderSummary(
      id: 'preview-schedule-completed',
      code: 'XEM-THU-008',
      serviceName: 'Tổng vệ sinh căn hộ',
      status: 'completed',
      scheduledAt: DateTime(today.year, today.month, today.day - 1, 15),
      addressLabel: 'Chung cư Riviera Point, Quận 7',
      customerName: 'Anh Minh',
      totalAmount: 420000,
      providerAmount: 357000,
      durationMinutes: 120,
      problemDescription: 'Căn hộ cần tổng vệ sinh trước khi bàn giao.',
    ),
    OrderSummary(
      id: 'preview-schedule-1',
      code: 'XEM-THU-001',
      serviceName: 'Vệ sinh máy giặt cửa ngang',
      status: 'completed',
      scheduledAt: today.add(const Duration(hours: 8, minutes: 30)),
      addressLabel: 'Đỗ Xuân Hợp, Quận 9, TP. Thủ Đức',
      customerName: 'Chị Lan',
      totalAmount: 250000,
      providerAmount: 212500,
      durationMinutes: 90,
      problemDescription: 'Máy giặt rung mạnh và có tiếng ồn khi vắt.',
    ),
    OrderSummary(
      id: 'preview-schedule-2',
      code: 'XEM-THU-002',
      serviceName: 'Sửa rò rỉ ống nước bồn rửa',
      status: 'in_progress',
      scheduledAt: today.add(const Duration(hours: 10, minutes: 30)),
      addressLabel: 'Chung cư Sunrise City, Nguyễn Hữu Thọ, Quận 7',
      customerName: 'Anh Tuấn',
      totalAmount: 150000,
      providerAmount: 127500,
      durationMinutes: 90,
      problemDescription: 'Bồn rửa bị rò nước ở khớp nối phía dưới.',
    ),
    OrderSummary(
      id: 'preview-schedule-3',
      code: 'XEM-THU-003',
      serviceName: 'Bảo dưỡng máy lạnh treo tường x2',
      status: 'accepted',
      scheduledAt: today.add(const Duration(hours: 14)),
      addressLabel: 'KDC Him Lam, Đường số 4, Quận 7',
      customerName: 'Anh Nam',
      totalAmount: 360000,
      providerAmount: 306000,
      durationMinutes: 90,
      problemDescription: 'Hai máy lạnh cần vệ sinh và kiểm tra gas.',
    ),
    OrderSummary(
      id: 'preview-schedule-4',
      code: 'XEM-THU-004',
      serviceName: 'Kiểm tra đường điện gia đình',
      status: 'accepted',
      scheduledAt: DateTime(today.year, today.month, today.day + 1, 9),
      addressLabel: 'Phường Tân Phong, Quận 7',
      customerName: 'Chị Mai',
      totalAmount: 280000,
      providerAmount: 238000,
      durationMinutes: 90,
      problemDescription: 'Một số ổ cắm chập chờn, cần kiểm tra đường dây.',
    ),
    OrderSummary(
      id: 'preview-schedule-5',
      code: 'XEM-THU-005',
      serviceName: 'Vệ sinh điều hòa',
      status: 'accepted',
      scheduledAt: DateTime(today.year, today.month, today.day + 2, 15),
      addressLabel: 'Phường An Phú, TP. Thủ Đức',
      customerName: 'Anh Minh',
      totalAmount: 240000,
      providerAmount: 204000,
      durationMinutes: 90,
      problemDescription: 'Điều hòa có mùi và làm lạnh chậm.',
    ),
  ];
}
