import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';

OrderSummary order(Map<String, dynamic> fields) => OrderSummary.fromJson({
  '_id': 'order',
  'orderCode': 'ORD-TEST',
  'status': 'created',
  'paymentStatus': 'unpaid',
  'serviceId': {'name': 'Vệ sinh điều hòa'},
  ...fields,
});

void main() {
  test('Bảy nhãn trạng thái dựa vào thanh toán và giao đơn thực tế', () {
    for (final entry in <(Map<String, dynamic>, String)>[
      ({}, 'Chờ thanh toán'),
      ({'paymentStatus': 'paid'}, 'Đang tìm thợ'),
      (
        {
          'paymentStatus': 'partially_paid',
          'depositPaidAt': '2026-10-22T01:00:00Z',
        },
        'Đang tìm thợ',
      ),
      ({'paymentStatus': 'paid', 'hasPendingAssignment': true}, 'Chờ xác nhận'),
      (
        {'hasPendingAssignment': true, 'bookingStatus': 'awaiting_provider'},
        'Chờ xác nhận',
      ),
      (
        {'paymentStatus': 'paid', 'preferredProviderId': 'selected-provider'},
        'Đang tìm thợ',
      ),
      ({'paymentStatus': 'unpaid', 'readyForMatching': true}, 'Đang tìm thợ'),
      ({'bookingStatus': 'awaiting_payment'}, 'Chờ thanh toán'),
      ({'status': 'accepted'}, 'Chờ xử lý'),
      ({'status': 'in_progress'}, 'Đang xử lý'),
      ({'status': 'completed'}, 'Hoàn thành'),
      ({'status': 'cancelled', 'hasPendingAssignment': true}, 'Đã hủy'),
    ]) {
      expect(customerOrderStatusLabel(order(entry.$1)), entry.$2);
    }
  });

  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'Card ghi Mã đơn, trạng thái mới và không tràn ở cỡ chữ $scale',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(320, 800);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: child!,
            ),
            home: Scaffold(
              body: ListView(
                children: [
                  OrderSummaryCard(
                    order: order({
                      'paymentStatus': 'paid',
                      'hasPendingAssignment': true,
                      'addressId': {
                        'fullAddress': '45 Lê Hữu Trác',
                        'ward': 'An Hải',
                        'province': 'Đà Nẵng',
                      },
                      'pricing': {'totalPaidAmount': 120000},
                    }),
                  ),
                ],
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Mã đơn ORD-TEST'), findsOneWidget);
        expect(find.text('Chờ xác nhận'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
