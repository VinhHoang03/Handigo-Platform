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
      'createdAt': '2026-10-30T13:28:00.000Z',
      'pricing': {'totalPaidAmount': 120000, 'providerEarningAmount': 102000},
    });
    expect(order.customerName, 'Nguyễn Văn An');
    expect(order.customerAvatar, 'https://example.test/avatar.png');
    expect(order.providerAmount, 102000);
    expect(order.createdAt, DateTime.parse('2026-10-30T13:28:00.000Z'));
    expect(
      OrderSummary.fromJson({
        '_id': 'old',
        'customerId': 'customer',
      }).customerName,
      isNull,
    );
  });

  test('Tính đúng số tiền provider giống web', () {
    final fixedPriceOrder = OrderSummary.fromJson({
      '_id': 'fixed',
      'pricing': {'totalPaidAmount': 120000, 'providerEarningAmount': 102000},
    });
    final quotedOrder = OrderSummary.fromJson({
      '_id': 'quoted',
      'inspectionRequired': true,
      'quotationFinalAmount': 500000,
      'depositPaidAt': '2026-10-30T10:00:00.000Z',
      'depositAmount': 20000,
      'pricing': {'totalPaidAmount': 20000},
    });

    expect(fixedPriceOrder.totalAmount, 120000);
    expect(fixedPriceOrder.providerAmount, 102000);
    expect(quotedOrder.providerAmount, 480000);
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
                      createdAt: DateTime(2026, 10, 30, 13, 28),
                      addressLabel: 'Phường Tân Phong, Thành phố Hồ Chí Minh',
                      totalAmount: 350000,
                      providerAmount: 297500,
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
      expect(find.text('Nhắn tin'), findsOneWidget);
      expect(find.text('Chưa chọn thời gian'), findsNothing);
      expect(find.textContaining('30/10/2026'), findsOneWidget);
      expect(find.textContaining('297.500'), findsOneWidget);
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
