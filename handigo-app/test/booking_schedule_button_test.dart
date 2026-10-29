import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider_selector.dart';
import 'package:handigo_app/features/service_catalog/presentation/booking_schedule_selector.dart';

final _daytime = DateTime(2026, 10, 21, 10);

void main() {
  test('Khung giờ đặt ngay từ 08:00 đến hết phút 21:00', () {
    expect(isImmediateBookingAvailable(DateTime(2026, 10, 21, 7, 59)), isFalse);
    expect(isImmediateBookingAvailable(DateTime(2026, 10, 21, 8)), isTrue);
    expect(isImmediateBookingAvailable(DateTime(2026, 10, 21, 21)), isTrue);
    expect(isImmediateBookingAvailable(DateTime(2026, 10, 21, 21, 1)), isFalse);
  });

  for (final now in [
    DateTime(2026, 10, 21, 7, 59),
    DateTime(2026, 10, 21, 21, 1),
    DateTime(2026, 12, 31, 23, 59),
  ]) {
    testWidgets('Ngoài giờ $now mặc định 08:00 ngày mai và modal gọn', (
      tester,
    ) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            bookingScheduleClockProvider.overrideWithValue(() => now),
          ],
          child: const MaterialApp(
            home: Scaffold(body: BookingScheduleButton()),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final container = ProviderScope.containerOf(
        tester.element(find.byType(BookingScheduleButton)),
      );
      final tomorrow = DateTime(now.year, now.month, now.day + 1, 8);
      expect(container.read(bookingDraftProvider).type, BookingType.scheduled);
      expect(container.read(bookingDraftProvider).scheduledAt, tomorrow);
      expect(
        find.text('Nếu không chọn ngày giờ, đơn sẽ được tính là đặt ngay'),
        findsNothing,
      );
      expect(
        find.text(
          'Đã ngoài khung giờ làm việc, đơn của bạn sẽ được xử lý vào ngày mai.',
        ),
        findsOneWidget,
      );
      expect(
        bookingTimeError(container.read(bookingDraftProvider), now),
        isNull,
      );
      await tester.tap(find.byIcon(Icons.calendar_month_outlined));
      await tester.pumpAndSettle();
      final wheels = tester
          .widgetList<ListWheelScrollView>(find.byType(ListWheelScrollView))
          .toList();
      expect(
        (wheels[0].controller! as FixedExtentScrollController).selectedItem,
        1,
      );
      expect(
        (wheels[1].controller! as FixedExtentScrollController).selectedItem,
        0,
      );
      expect(
        (wheels[2].controller! as FixedExtentScrollController).selectedItem,
        0,
      );
      expect(find.text('Đặt ngay'), findsNothing);
      expect(
        find.textContaining(RegExp(r'^\d{2}/\d{2}/\d{4} · ')),
        findsNothing,
      );
      expect(find.textContaining(RegExp(r'^T[2-7] ')), findsNothing);
      expect(
        find.textContaining(RegExp(r'^(Thứ [2-7]|Chủ nhật) ')),
        findsWidgets,
      );
      await tester.tap(find.byTooltip('Đóng'));
      await tester.pumpAndSettle();
      container
          .read(bookingDraftProvider.notifier)
          .setScheduledAt(DateTime(now.year, now.month, now.day + 3, 14, 30));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).scheduledAt!.hour, 14);
      await tester.tap(find.byTooltip('Xóa lịch hẹn'));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).scheduledAt, tomorrow);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('Ghi chú và lịch mặc định cập nhật khi qua giờ đặt ngay', (
    tester,
  ) async {
    var now = DateTime(2026, 10, 21, 20, 59);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [bookingScheduleClockProvider.overrideWithValue(() => now)],
        child: const MaterialApp(home: Scaffold(body: BookingScheduleButton())),
      ),
    );
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(BookingScheduleButton)),
    );
    expect(container.read(bookingDraftProvider).scheduledAt, isNull);
    now = DateTime(2026, 10, 21, 21, 1);
    await tester.pump(const Duration(minutes: 1));
    await tester.pumpAndSettle();
    expect(
      container.read(bookingDraftProvider).scheduledAt,
      DateTime(2026, 10, 22, 8),
    );
    expect(
      find.text(
        'Đã ngoài khung giờ làm việc, đơn của bạn sẽ được xử lý vào ngày mai.',
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Chỉ xổ ngày giờ khi bấm Hẹn lịch, chưa chọn vẫn đặt ngay', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          bookingScheduleClockProvider.overrideWithValue(() => _daytime),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(child: BookingScheduleButton()),
          ),
        ),
      ),
    );
    final container = ProviderScope.containerOf(
      tester.element(find.byType(BookingScheduleButton)),
    );
    final controller = container.read(bookingDraftProvider.notifier);
    controller.startService('service');
    controller.setAddress('address');
    await tester.pump();

    expect(find.byType(BookingScheduleSelector), findsNothing);
    expect(find.text('Đặt ngay'), findsNothing);
    expect(find.text('Đặt lịch hẹn'), findsNothing);
    expect(find.text('Đặt định kỳ'), findsNothing);
    final note = find.text(
      'Nếu không chọn ngày giờ, đơn sẽ được tính là đặt ngay',
    );
    expect(
      tester.getTopLeft(note).dy,
      lessThan(tester.getTopLeft(find.text('Hẹn lịch')).dy),
    );
    await tester.tap(find.byIcon(Icons.error_outline_rounded));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Đặt ngay: đơn được gửi để tìm thợ'),
      findsOneWidget,
    );
    Tooltip.dismissAllToolTips();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hẹn lịch'));
    await tester.pumpAndSettle();
    expect(find.byType(BookingScheduleSelector), findsOneWidget);
    expect(find.byType(ListWheelScrollView), findsNWidgets(3));
    var draft = container.read(bookingDraftProvider);
    expect(draft.type, BookingType.normal);
    expect(draft.scheduledAt, isNull);
    expect(
      jsonDecode(bookingProviderQuery(draft)!),
      isNot(contains('scheduledAt')),
    );

    await tester.tap(find.byTooltip('Đóng'));
    await tester.pumpAndSettle();
    expect(find.byType(BookingScheduleSelector), findsNothing);
    expect(container.read(bookingDraftProvider).type, BookingType.normal);

    await tester.tap(find.text('Hẹn lịch'));
    await tester.pumpAndSettle();
    final days =
        tester
                .widget<ListWheelScrollView>(
                  find.byKey(const ValueKey('schedule-Ngày')),
                )
                .controller!
            as FixedExtentScrollController;
    days.jumpToItem(1);
    await tester.pumpAndSettle();
    expect(container.read(bookingDraftProvider).scheduledAt, isNull);
    await tester.tap(find.text('Xác nhận'));
    await tester.pumpAndSettle();
    draft = container.read(bookingDraftProvider);
    expect(draft.type, BookingType.scheduled);
    expect(draft.scheduledAt, isNotNull);
    expect(
      jsonDecode(bookingProviderQuery(draft)!)['scheduledAt'],
      draft.scheduledAt!.toUtc().toIso8601String(),
    );
    expect(find.byType(BookingScheduleSelector), findsNothing);

    expect(find.text('Xóa lịch hẹn'), findsNothing);
    await tester.tap(find.byTooltip('Xóa lịch hẹn'));
    await tester.pumpAndSettle();
    draft = container.read(bookingDraftProvider);
    expect(draft.type, BookingType.normal);
    expect(draft.scheduledAt, isNull);
    expect(find.byType(BookingScheduleSelector), findsNothing);
    expect(find.byTooltip('Xóa lịch hẹn'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  for (final width in [320.0, 390.0]) {
    testWidgets('Ba vòng xoay giữ lịch khi hủy và chặn sau 21:00 ở $width', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = Size(width, 640);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            bookingScheduleClockProvider.overrideWithValue(() => _daytime),
          ],
          child: const MaterialApp(
            home: Scaffold(body: BookingScheduleButton()),
          ),
        ),
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(BookingScheduleButton)),
      );
      final controller = container.read(bookingDraftProvider.notifier);
      final now = _daytime;
      final initial = DateTime(now.year, now.month, now.day + 2, 14, 30);
      controller.setScheduledAt(initial);
      controller.setPreferredProvider('provider');
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.calendar_month_outlined));
      await tester.pumpAndSettle();
      final hours =
          tester
                  .widget<ListWheelScrollView>(
                    find.byKey(const ValueKey('schedule-Giờ')),
                  )
                  .controller!
              as FixedExtentScrollController;
      final minutes =
          tester
                  .widget<ListWheelScrollView>(
                    find.byKey(const ValueKey('schedule-Phút')),
                  )
                  .controller!
              as FixedExtentScrollController;
      hours.jumpToItem(13);
      await tester.pumpAndSettle();
      minutes.jumpToItem(1);
      await tester.pumpAndSettle();
      expect(find.text('Giờ thực hiện không được sau 21:00.'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      expect(container.read(bookingDraftProvider).scheduledAt, initial);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('Đóng'));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).scheduledAt, initial);
      expect(
        container.read(bookingDraftProvider).preferredProviderId,
        'provider',
      );
      await tester.tap(find.byIcon(Icons.calendar_month_outlined));
      await tester.pumpAndSettle();
      expect(find.text('Đặt ngay'), findsNothing);
      expect(find.text('Xác nhận'), findsOneWidget);
      await tester.tap(find.byTooltip('Đóng'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Xóa lịch hẹn'));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).scheduledAt, isNull);
      expect(container.read(bookingDraftProvider).type, BookingType.normal);
      expect(container.read(bookingDraftProvider).preferredProviderId, isNull);
      expect(tester.takeException(), isNull);
    });
  }

  test('Đổi và xóa lịch loại bỏ chuyên gia đã chọn', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final controller = container.read(bookingDraftProvider.notifier);
    controller.setPreferredProvider('provider');
    controller.setScheduledAt(DateTime(2026, 10, 22, 14, 30));
    expect(container.read(bookingDraftProvider).preferredProviderId, isNull);
    controller.setPreferredProvider('provider');
    controller.clearSchedule();
    expect(container.read(bookingDraftProvider).preferredProviderId, isNull);
  });
}
