import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_detail_overview.dart';
import 'package:handigo_app/features/orders/presentation/order_payment_panel.dart';
import 'package:handigo_app/shared/widgets/app_feedback.dart';

OrderDetail order({bool inspection = false}) => OrderDetail.fromJson({
  '_id': 'order',
  'status': 'accepted',
  'paymentStatus': 'paid',
  'paymentMethod': 'wallet',
  'customerId': {
    'fullName': 'Khách An',
    'phone': '0901234567',
    'avatar': 'https://example.com/avatar.jpg',
  },
  'inspectionRequired': inspection,
  'pricing': {'baseAmount': 120000, 'totalPaidAmount': 100000},
});

void main() {
  testWidgets(
    'Khách hàng dùng icon, nút nhắn tin bên phải và sao chép đúng số điện thoại',
    (tester) async {
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData')
            copied = (call.arguments as Map)['text'] as String;
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: OrderDetailOverview(order: order(), providerView: true),
            ),
          ),
        ),
      );
      expect(find.text('Khách An'), findsOneWidget);
      expect(find.text('0901234567'), findsOneWidget);
      expect(find.byIcon(Icons.person_outline_rounded), findsOneWidget);
      expect(find.byIcon(Icons.phone_outlined), findsOneWidget);
      expect(find.byType(CircleAvatar), findsNothing);
      expect(find.text('Nhắn tin'), findsOneWidget);
      expect(
        tester.getCenter(find.text('Nhắn tin')).dx,
        greaterThan(tester.getCenter(find.text('0901234567')).dx),
      );
      await tester.tap(find.byTooltip('Sao chép số điện thoại'));
      await tester.pumpAndSettle();
      expect(copied, '0901234567');
      expect(find.text('Đã sao chép số điện thoại.'), findsOneWidget);
      AppToast.dismiss(tester.element(find.byType(OrderDetailOverview)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Số tiền cuối cần thu dùng khoản còn lại từ báo giá', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderPaymentSummary(
            order: order(inspection: true),
            providerView: true,
            quotation: const RepairQuotation(
              id: 'quote',
              status: 'saved',
              finalAmount: 800000,
              paidDeposit: 100000,
              remainingDirectPaymentAmount: 600000,
            ),
          ),
        ),
      ),
    );
    expect(find.text('Số tiền cuối cần thu'), findsOneWidget);
    expect(find.textContaining('600.000'), findsOneWidget);
  });

  testWidgets('Báo giá đã xác nhận nhận tiền không còn tiền cần thu', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderPaymentSummary(
            order: order(inspection: true),
            providerView: true,
            quotation: RepairQuotation(
              id: 'quote',
              status: 'saved',
              finalAmount: 800000,
              remainingDirectPaymentAmount: 700000,
              directPaymentConfirmedAt: DateTime(2026, 10, 25),
            ),
          ),
        ),
      ),
    );
    expect(find.text('Số tiền cuối cần thu'), findsOneWidget);
    expect(find.textContaining(RegExp(r'^0')), findsOneWidget);
  });

  testWidgets(
    'Đơn khảo sát chưa có báo giá không báo nhầm tiền cần thu bằng không',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OrderPaymentSummary(
              order: order(inspection: true),
              providerView: true,
            ),
          ),
        ),
      );
      expect(find.text('Chờ báo giá'), findsOneWidget);
    },
  );
}
