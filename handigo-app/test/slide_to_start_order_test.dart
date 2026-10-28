import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/features/provider/presentation/slide_to_start_order.dart';

Future<void> showControl(
  WidgetTester tester,
  Future<void> Function() action, {
  bool enabled = true,
}) => tester.pumpWidget(
  MaterialApp(
    home: Scaffold(
      body: Center(
        child: SizedBox(
          width: 320,
          child: SlideToStartOrder(onConfirmed: action, enabled: enabled),
        ),
      ),
    ),
  ),
);
Finder get handle => find.byKey(const ValueKey('start-order-slide-handle'));

void main() {
  testWidgets('Chạm nút, chạm đường trượt và kéo chưa hết không bắt đầu đơn', (
    tester,
  ) async {
    var calls = 0;
    await showControl(tester, () async {
      calls++;
    });
    await tester.tap(handle);
    await tester.tap(find.text('Trượt để bắt đầu xử lý'));
    await tester.drag(handle, const Offset(100, 0));
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(tester.getTopLeft(handle).dx, 244);
  });
  testWidgets(
    'Kéo hết từ trái sang phải chỉ gửi một lần trong lúc đang xử lý',
    (tester) async {
      var calls = 0;
      final pending = Completer<void>();
      await showControl(tester, () {
        calls++;
        return pending.future;
      });
      await tester.drag(handle, const Offset(264, 0));
      await tester.pump();
      expect(calls, 1);
      expect(find.text('Đang xử lý...'), findsOneWidget);
      await tester.drag(handle, const Offset(264, 0));
      expect(calls, 1);
      pending.complete();
      await tester.pumpAndSettle();
      expect(find.text('Trượt để bắt đầu xử lý'), findsOneWidget);
    },
  );
  testWidgets(
    'Kéo ngược chiều, kéo trên đường trượt và nút bị khóa không xác nhận',
    (tester) async {
      var calls = 0;
      await showControl(tester, () async {
        calls++;
      });
      await tester.drag(handle, const Offset(-264, 0));
      await tester.drag(
        find.text('Trượt để bắt đầu xử lý'),
        const Offset(264, 0),
      );
      await tester.pumpAndSettle();
      expect(calls, 0);
      await showControl(tester, () async {
        calls++;
      }, enabled: false);
      await tester.drag(handle, const Offset(264, 0));
      await tester.pumpAndSettle();
      expect(calls, 0);
    },
  );
}
