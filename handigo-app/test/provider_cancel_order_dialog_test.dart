import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/provider/presentation/provider_cancel_order_dialog.dart';

void main() {
  testWidgets(
    'Đã đến nơi có lý do từ chối báo giá, không có lý do không thể đến địa chỉ',
    (tester) async {
      String? result;
      final order = OrderDetail(
        id: 'order',
        code: 'HD-001',
        serviceName: 'Sửa điện',
        status: 'accepted',
        paymentStatus: 'partially_paid',
        paymentMethod: 'cash',
        inspectionRequired: true,
        providerId: 'provider',
        arrivalProviderId: 'provider',
        arrivedAt: DateTime.now(),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () async => result = await showDialog<String>(
                  context: context,
                  builder: (_) => ProviderCancelOrderDialog(order: order),
                ),
                child: const Text('Mở'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Mở'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      expect(find.text('Không thể đến địa chỉ khách hàng'), findsNothing);
      await tester.tap(find.text('Khách hàng không đồng ý báo giá').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tiếp tục hủy đơn'));
      await tester.pumpAndSettle();
      expect(result, isNull);
      await tester.tap(find.text('Xác nhận hủy'));
      await tester.pumpAndSettle();
      expect(result, 'Khách hàng không đồng ý báo giá');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Lịch hẹn có lý do riêng, hộp thoại cuộn được trên màn hình nhỏ và chữ lớn',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 640);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(2)),
            child: child!,
          ),
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (_) => const ProviderCancelOrderDialog(
                    order: OrderDetail(
                      id: 'order',
                      code: 'HD-001',
                      serviceName: 'Sửa điện',
                      status: 'accepted',
                      paymentStatus: 'paid',
                      paymentMethod: 'cash',
                      orderType: 'scheduled',
                    ),
                  ),
                ),
                child: const Text('Mở'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Mở'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      expect(find.text('Lịch hẹn không còn phù hợp').last, findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
