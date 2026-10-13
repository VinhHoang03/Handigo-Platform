import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/provider/presentation/provider_history_widgets.dart';

void main() {
  test('Đọc thông tin khách hàng từ API và tương thích dữ liệu cũ', () {
    final order = OrderSummary.fromJson({
      '_id': 'order',
      'customerId': {
        'fullName': 'Nguyễn Văn An',
        'avatar': 'https://example.test/avatar.png',
      },
    });
    expect(order.customerName, 'Nguyễn Văn An');
    expect(order.customerAvatar, 'https://example.test/avatar.png');
    expect(
      OrderSummary.fromJson({
        '_id': 'old',
        'customerId': 'customer',
      }).customerName,
      isNull,
    );
  });

  for (final (status, action) in const [
    ('accepted', 'Xem lịch hẹn'),
    ('in_progress', 'Xem tiến trình'),
    ('completed', 'Xem kết quả'),
    ('cancelled', 'Xem chi tiết hủy'),
  ]) {
    testWidgets('Thẻ $status mở đúng chi tiết provider khi phóng lớn chữ', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 800);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (_, state) => Scaffold(
              body: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  ProviderHistoryOrderCard(
                    order: OrderSummary(
                      id: 'order',
                      code: 'HDG-001',
                      status: status,
                      serviceName:
                          'Kiểm tra hệ thống điện và sửa chữa thiết bị tại nhà',
                      customerName: 'Nguyễn Văn An',
                      addressLabel: 'Phường Tân Phong, Thành phố Hồ Chí Minh',
                      totalAmount: 350000,
                    ),
                  ),
                ],
              ),
            ),
          ),
          GoRoute(
            path: '/provider/orders/:id',
            builder: (_, state) =>
                const Scaffold(body: Text('Chi tiết đơn của thợ')),
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        MaterialApp.router(
          theme: AppTheme.light,
          routerConfig: router,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(2)),
            child: child!,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Nguyễn Văn An'), findsOneWidget);
      expect(find.text('Chưa có lịch hẹn'), findsOneWidget);
      expect(find.text('Đặt lại dịch vụ'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.ensureVisible(find.text(action));
      await tester.tap(find.text(action));
      await tester.pumpAndSettle();
      expect(find.text('Chi tiết đơn của thợ'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
