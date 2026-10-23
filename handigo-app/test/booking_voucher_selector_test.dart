import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/features/account/domain/account_models.dart';
import 'package:handigo_app/features/account/presentation/account_screens.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/service_catalog/presentation/booking_voucher_selector.dart';

const voucher = VoucherItem(
  code: 'SAVED10',
  name: 'Ưu đãi đã lưu',
  discountType: 'PERCENT',
  discountValue: 10,
  minOrderAmount: 100000,
);

void main() {
  testWidgets('Dropdown tải voucher, chọn mã, nhập tay và bỏ chọn', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    final pending = Completer<List<VoucherItem>>();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          accountVouchersProvider.overrideWith((ref) => pending.future),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: BookingVoucherSelector(
              controller: controller,
              inspectionRequired: false,
            ),
          ),
        ),
      ),
    );
    final container = ProviderScope.containerOf(
      tester.element(find.byType(BookingVoucherSelector)),
    );
    await tester.tap(find.byTooltip('Chọn voucher'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    pending.complete([
      voucher,
      const VoucherItem(
        code: 'INSPECT',
        name: 'Dịch vụ báo giá',
        applicableOrderType: 'variable_price',
      ),
    ]);
    await tester.pumpAndSettle();
    expect(find.textContaining('SAVED10'), findsOneWidget);
    expect(find.textContaining('INSPECT'), findsNothing);
    expect(find.text('Giảm 10% · Đơn từ 100.000đ'), findsOneWidget);
    await tester.tap(find.textContaining('SAVED10'));
    await tester.pumpAndSettle();
    expect(controller.text, 'SAVED10');
    expect(container.read(bookingDraftProvider).voucherCode, 'SAVED10');
    expect(find.byTooltip('Đóng danh sách voucher'), findsNothing);
    await tester.enterText(find.byType(TextField), 'manual');
    expect(container.read(bookingDraftProvider).voucherCode, 'MANUAL');
    await tester.tap(find.byTooltip('Chọn voucher'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Không sử dụng voucher'));
    await tester.pumpAndSettle();
    expect(controller.text, isEmpty);
    expect(container.read(bookingDraftProvider).voucherCode, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Lỗi tải voucher có thử lại và trạng thái danh sách rỗng', (
    tester,
  ) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    var attempts = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          accountVouchersProvider.overrideWith((ref) async {
            if (++attempts == 1) throw StateError('Lỗi kết nối');
            return <VoucherItem>[];
          }),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: BookingVoucherSelector(
              controller: controller,
              inspectionRequired: false,
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.byTooltip('Chọn voucher'));
    await tester.pumpAndSettle();
    expect(find.text('Không thể tải voucher.'), findsOneWidget);
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(
      find.text('Bạn chưa có voucher khả dụng cho dịch vụ này.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
