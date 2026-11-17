import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_cancel_sheet.dart';

OrderDetail _order({
  String status = 'accepted',
  String paymentMethod = 'bank',
  String? orderType,
  bool inspectionRequired = false,
  String? currentQuotationId,
  String? providerId = 'provider',
  DateTime? arrivedAt,
  DateTime? deadline,
}) => OrderDetail(
  id: 'order',
  code: 'HD-001',
  serviceName: 'Sửa điện',
  status: status,
  paymentStatus: 'paid',
  paymentMethod: paymentMethod,
  orderType: orderType,
  inspectionRequired: inspectionRequired,
  currentQuotationId: currentQuotationId,
  providerId: providerId,
  arrivalProviderId: arrivedAt == null ? null : providerId,
  arrivedAt: arrivedAt,
  customerCancellationDeadline: deadline,
);

CancellationPreview _preview({
  bool canCancel = true,
  double paid = 200000,
  String scope = 'single',
}) => CancellationPreview.fromJson({
  'scope': scope,
  'orderCount': 1,
  'paidAmount': paid,
  'refundAmount': 150000,
  'cancellationFee': 50000,
  'canCancel': canCancel,
  'items': [
    {
      'refundRate': 75,
      'policyReason': 'Hủy sau khi thợ nhận đơn.',
      'canCancel': canCancel,
    },
  ],
});

Future<void> _open(
  WidgetTester tester, {
  required OrderDetail order,
  required CancellationPreview preview,
  CancelPreviewLoader? reload,
  CancelSubmit? submit,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(800, 2400);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: TextButton(
            onPressed: () => showOrderCancelSheet(
              context,
              order: order,
              preview: preview,
              reload: reload ?? () async => preview,
              submit: submit ?? (_, _) async {},
            ),
            child: const Text('Mở'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Mở'));
  await tester.pumpAndSettle();
}

void main() {
  test('Lý do hủy được lọc theo loại đơn và báo giá như web', () {
    final normal = customerCancellationReasonsFor(_order(orderType: 'normal'));
    expect(normal, isNot(contains('Thời gian thực hiện không còn phù hợp')));
    expect(normal, contains('Chi phí không phù hợp'));
    expect(
      customerCancellationReasonsFor(_order(orderType: 'scheduled')),
      contains('Thời gian thực hiện không còn phù hợp'),
    );
    final inspection = customerCancellationReasonsFor(
      _order(inspectionRequired: true),
    );
    expect(inspection, isNot(contains('Chi phí không phù hợp')));
    expect(
      customerCancellationReasonsFor(
        _order(inspectionRequired: true, currentQuotationId: 'quote'),
      ),
      contains('Chi phí không phù hợp'),
    );
  });

  test('Khóa hủy khi đang làm, thợ đã đến hoặc hết hạn', () {
    final now = DateTime.now();
    final open = _order(deadline: now.add(const Duration(minutes: 5)));
    expect(open.canCancelAt(now), isTrue);
    expect(open.showsCancelActions, isTrue);
    expect(
      _order(
        deadline: now.subtract(const Duration(minutes: 1)),
      ).canCancelAt(now),
      isFalse,
    );
    expect(_order(status: 'in_progress').canCancelAt(now), isFalse);
    expect(_order(status: 'created', providerId: null).canCancelAt(now), isTrue);
    final arrived = _order(
      deadline: now.add(const Duration(minutes: 5)),
      arrivedAt: now,
    );
    expect(arrived.canCancelAt(now), isFalse);
    expect(arrived.showsCancelActions, isFalse);
  });

  test('Preview lấy lý do và tỷ lệ hoàn từ items', () {
    final preview = _preview();
    expect(preview.policyReason, 'Hủy sau khi thợ nhận đơn.');
    expect(preview.singleRefundRate, 75);
    expect(preview.isSeries, isFalse);
  });

  testWidgets('Hiện chính sách hoàn tiền và bắt buộc nhập khi chọn lý do khác', (
    tester,
  ) async {
    String? sent;
    await _open(
      tester,
      order: _order(deadline: DateTime.now().add(const Duration(hours: 1))),
      preview: _preview(),
      submit: (reason, _) async => sent = reason,
    );
    expect(find.text('Chính sách hoàn tiền'), findsOneWidget);
    expect(find.text('Hoàn 75%'), findsOneWidget);
    expect(find.text('Hủy sau khi thợ nhận đơn.'), findsOneWidget);

    await tester.tap(find.text('Hủy yêu cầu').last);
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng chọn lý do hủy đơn.'), findsOneWidget);

    await tester.tap(find.text('Lý do khác'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hủy yêu cầu').last);
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng nhập thông tin cho lý do khác.'), findsOneWidget);
    expect(sent, isNull);

    await tester.enterText(find.byType(TextField), 'Bận việc đột xuất');
    await tester.tap(find.text('Hủy yêu cầu').last);
    await tester.pumpAndSettle();
    expect(sent, 'Lý do khác: Bận việc đột xuất');
  });

  testWidgets('Đơn tiền mặt ẩn chính sách hoàn tiền', (tester) async {
    await _open(
      tester,
      order: _order(
        paymentMethod: 'cash',
        deadline: DateTime.now().add(const Duration(hours: 1)),
      ),
      preview: _preview(paid: 0),
    );
    expect(find.text('Chính sách hoàn tiền'), findsNothing);
  });

  testWidgets('Preview không cho hủy thì khóa nút và hiện lý do', (
    tester,
  ) async {
    await _open(
      tester,
      order: _order(deadline: DateTime.now().add(const Duration(hours: 1))),
      preview: _preview(canCancel: false),
    );
    expect(find.text('Hủy sau khi thợ nhận đơn.'), findsWidgets);
    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull);
  });

  testWidgets('Lỗi 409 tải lại chính sách và yêu cầu xác nhận lại', (
    tester,
  ) async {
    var reloaded = 0;
    await _open(
      tester,
      order: _order(deadline: DateTime.now().add(const Duration(hours: 1))),
      preview: _preview(),
      reload: () async {
        reloaded++;
        return _preview(paid: 300000);
      },
      submit: (_, _) async =>
          throw const ApiException('Xung đột', statusCode: 409),
    );
    await tester.tap(find.text('Không còn nhu cầu sử dụng dịch vụ'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hủy yêu cầu').last);
    await tester.pumpAndSettle();
    expect(reloaded, 1);
    expect(
      find.textContaining('Thông tin hủy đơn đã thay đổi'),
      findsOneWidget,
    );
    expect(find.textContaining('300.000'), findsOneWidget);
  });
}
