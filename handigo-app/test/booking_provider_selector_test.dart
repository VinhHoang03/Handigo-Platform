import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider_selector.dart';

const providers = <Map<String, dynamic>>[
  {
    'id': 'first',
    'user': {'fullName': 'Nguyễn Văn An'},
    'averageRating': 4.9,
    'totalCompletedOrders': 120,
    'distanceMeters': 250,
    'services': [
      {'name': 'Vệ sinh điều hòa'},
    ],
  },
  {
    'id': 'second',
    'user': {'fullName': 'Trần Minh Bình'},
    'averageRating': 4.8,
    'totalCompletedOrders': 60,
    'distanceMeters': 1400,
  },
];

void main() {
  Future<ProviderContainer> open(
    WidgetTester tester, {
    FutureOr<List<Map<String, dynamic>>> Function()? load,
    bool withAddress = true,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          bookingNearbyProviders.overrideWith(
            (ref, query) async => load == null ? providers : await load(),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(
            body: SingleChildScrollView(child: BookingProviderSelector()),
          ),
        ),
      ),
    );
    final container = ProviderScope.containerOf(
      tester.element(find.byType(BookingProviderSelector)),
    );
    container.read(bookingDraftProvider.notifier).startService('service');
    if (withAddress) {
      container.read(bookingDraftProvider.notifier).setAddress('address');
    }
    await tester.pumpAndSettle();
    return container;
  }

  Future<void> showList(WidgetTester tester) async {
    await tester.tap(find.text('Chọn thợ từ danh sách'));
    await tester.pumpAndSettle();
  }

  for (final width in [320.0, 390.0]) {
    testWidgets('Chọn thợ rồi đổi về điều phối tự động ở $width px', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = Size(width, 844);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final container = await open(tester);
      expect(container.read(bookingDraftProvider).preferredProviderId, isNull);
      expect(
        find.text('Hệ thống Handigo sẽ điều phối tự động'),
        findsOneWidget,
      );
      await showList(tester);
      expect(find.text('Nguyễn Văn An'), findsOneWidget);
      expect(find.text('Trần Minh Bình'), findsOneWidget);
      expect(find.text('Cách bạn 250 m'), findsOneWidget);
      await tester.tap(find.text('Trần Minh Bình'));
      await tester.pumpAndSettle();
      expect(
        container.read(bookingDraftProvider).preferredProviderId,
        'second',
      );
      expect(find.text('Trần Minh Bình'), findsOneWidget);
      expect(find.text('Chọn thợ phù hợp'), findsNothing);
      expect(find.text('Vệ sinh điều hòa'), findsNothing);
      expect(
        find.byKey(const ValueKey('booking-provider-dropdown-list')),
        findsOneWidget,
      );
      await tester.tap(find.text('Hệ thống Handigo sẽ điều phối tự động'));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).preferredProviderId, isNull);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets(
    'Không có thợ vẫn giữ lựa chọn tự động và hiển thị trạng thái trống',
    (tester) async {
      final container = await open(tester, load: () => []);
      await showList(tester);
      expect(
        find.text('Hiện tại chưa có thợ phù hợp, vui lòng đặt lịch lại sau'),
        findsOneWidget,
      );
      await tester.tap(find.text('Chọn thợ từ danh sách'));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).preferredProviderId, isNull);
    },
  );

  testWidgets(
    'Lỗi danh sách có thể thử lại, chọn xong đổi địa chỉ sẽ bỏ thợ cũ',
    (tester) async {
      var fail = true;
      final container = await open(
        tester,
        load: () {
          if (fail) throw Exception('Lỗi thử nghiệm');
          return providers;
        },
      );
      await showList(tester);
      expect(
        find.textContaining('Chưa tải được danh sách thợ'),
        findsOneWidget,
      );
      fail = false;
      await tester.tap(find.byTooltip('Thử lại'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chọn thợ từ danh sách'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nguyễn Văn An'));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).preferredProviderId, 'first');
      container.read(bookingDraftProvider.notifier).setAddress('new-address');
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).preferredProviderId, isNull);
      expect(
        find.text('Hệ thống Handigo sẽ điều phối tự động'),
        findsOneWidget,
      );
    },
  );

  testWidgets('Chưa có địa chỉ thì hướng dẫn chọn địa chỉ và lịch', (
    tester,
  ) async {
    await open(tester, withAddress: false);
    await showList(tester);
    expect(
      find.textContaining('Vui lòng chọn địa chỉ và thời gian'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets('Danh sách xổ tại chỗ, cuộn khi có hơn bốn thợ', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 1000);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final container = await open(
      tester,
      load: () => List.generate(
        7,
        (index) => {'id': 'provider-$index', 'fullName': 'Thợ số $index'},
      ),
    );
    await showList(tester);
    expect(find.byType(BottomSheet), findsNothing);
    expect(find.byIcon(Icons.check_circle_outline_rounded), findsOneWidget);
    final list = find.byKey(const ValueKey('booking-provider-dropdown-list'));
    final widget = tester.widget<ListView>(list);
    expect(tester.getSize(list).height, widget.itemExtent! * 4);
    expect(widget.controller!.position.maxScrollExtent, greaterThan(0));
    await tester.drag(list, const Offset(0, -450));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Thợ số 6'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thợ số 6'));
    await tester.pumpAndSettle();
    expect(
      container.read(bookingDraftProvider).preferredProviderId,
      'provider-6',
    );
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'Hai lựa chọn luôn hiện, đang tải có vòng xoay rồi không có thợ thì ẩn mũi tên',
    (tester) async {
      final pending = Completer<List<Map<String, dynamic>>>();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            bookingNearbyProviders.overrideWith((ref, query) => pending.future),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const Scaffold(
              body: SingleChildScrollView(child: BookingProviderSelector()),
            ),
          ),
        ),
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(BookingProviderSelector)),
      );
      container.read(bookingDraftProvider.notifier).startService('service');
      container.read(bookingDraftProvider.notifier).setAddress('address');
      await tester.pump();
      expect(
        find.text('Hệ thống Handigo sẽ điều phối tự động'),
        findsOneWidget,
      );
      expect(find.text('Chọn thợ từ danh sách'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_up_rounded), findsNothing);
      final card = tester.widget<Material>(
        find
            .ancestor(
              of: find.text('Hệ thống Handigo sẽ điều phối tự động'),
              matching: find.byType(Material),
            )
            .first,
      );
      expect(card.color, Colors.white);
      pending.complete([]);
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.byIcon(Icons.keyboard_arrow_up_rounded), findsNothing);
      expect(
        find.text('Hiện tại chưa có thợ phù hợp, vui lòng đặt lịch lại sau'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Tải lại trong card khi trống và chọn được thợ mới', (
    tester,
  ) async {
    var requests = 0;
    final pending = Completer<List<Map<String, dynamic>>>();
    final container = await open(
      tester,
      load: () {
        requests++;
        return requests == 1 ? <Map<String, dynamic>>[] : pending.future;
      },
    );
    expect(find.byTooltip('Tải lại'), findsOneWidget);
    expect(find.byIcon(Icons.keyboard_arrow_up_rounded), findsNothing);
    await tester.tap(find.byTooltip('Tải lại'));
    await tester.pump();
    await tester.pump();
    expect(requests, 2);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.byTooltip('Tải lại'), findsNothing);
    pending.complete(providers);
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.keyboard_arrow_up_rounded), findsOneWidget);
    expect(find.byTooltip('Tải lại'), findsNothing);
    await tester.tap(find.text('Chọn thợ từ danh sách'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nguyễn Văn An'));
    await tester.pumpAndSettle();
    expect(container.read(bookingDraftProvider).preferredProviderId, 'first');
    expect(tester.takeException(), isNull);
  });
}
