import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/service_catalog/domain/service_option.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_option_selector.dart';

void main() {
  const detail = ServiceDetail(
    service: Service(id: 'service', name: 'Máy lạnh', description: '', serviceType: 'fixed_price', optionGroups: [
      ServiceOptionGroup(id: 'type', name: 'Loại máy', selectionMode: 'single', isRequired: true),
      ServiceOptionGroup(id: 'work', name: 'Công việc', selectionMode: 'multiple', isRequired: true),
    ]),
    options: [
      ServiceOption(id: 'a', name: 'Máy treo tường', price: 180000, groupId: 'type', selectionGroup: 'Loại máy', selectionMode: 'single', isRequired: true),
      ServiceOption(id: 'b', name: 'Máy âm trần', price: 260000, groupId: 'type', selectionGroup: 'Loại máy', selectionMode: 'single', isRequired: true),
      ServiceOption(id: 'c', name: 'Vệ sinh', price: 90000, groupId: 'work', selectionGroup: 'Công việc', isRequired: true),
      ServiceOption(id: 'd', name: 'Kiểm tra', price: 60000, groupId: 'work', selectionGroup: 'Công việc', isRequired: true),
    ],
  );
  test('Phải chọn từng nhóm bắt buộc và giới hạn nhóm chọn một', () {
    expect(detail.selectionError([]), isNotNull);
    expect(detail.selectionError(['a']), contains('Công việc'));
    expect(detail.selectionError(['a', 'b', 'c']), contains('chỉ được chọn một'));
    expect(detail.selectionError(['a', 'c', 'd']), isNull);
    expect(detail.selectionError(['a', 'c', 'đã-xóa']), isNotNull);
  });
  test('Tổng tiền sử dụng ưu đãi trả về từ hệ thống', () {
    final preview = BookingPreview.fromJson({'bookingAmount': 300000, 'promotionDiscountAmount': 30000, 'voucherDiscountAmount': 20000, 'discountedAmount': 250000, 'promotionSnapshot': {'name': 'Tuần lễ ưu đãi'}});
    expect(preview.discountedAmount, 250000);
    expect(preview.promotionName, 'Tuần lễ ưu đãi');
  });
  testWidgets('Chọn một thay lựa chọn cùng nhóm, chọn nhiều giữ các lựa chọn', (tester) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(container: container, child: const MaterialApp(home: Scaffold(body: SingleChildScrollView(child: ServiceOptionSelector(detail: detail))))));
    expect(find.text('Loại máy · Chọn một · Bắt buộc'), findsOneWidget);
    await tester.tap(find.text('Máy treo tường'));
    await tester.pump();
    await tester.tap(find.text('Máy âm trần'));
    await tester.pump();
    expect(container.read(bookingDraftProvider).selectedOptionIds, ['b']);
    await tester.tap(find.text('Vệ sinh'));
    await tester.pump();
    await tester.ensureVisible(find.text('Kiểm tra'));
    await tester.tap(find.text('Kiểm tra'));
    await tester.pump();
    expect(container.read(bookingDraftProvider).selectedOptionIds, ['b', 'c', 'd']);
    container.read(bookingDraftProvider.notifier).startService('khác');
    expect(container.read(bookingDraftProvider).selectedOptionIds, isEmpty);
    expect(tester.takeException(), isNull);
  });
}
