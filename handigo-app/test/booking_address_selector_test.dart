import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/service_catalog/presentation/booking_address_card.dart';
import 'package:handigo_app/features/service_catalog/presentation/booking_address_selector.dart';

const addresses = [
  Address(
    id: 'first',
    recipientName: 'Khách hàng có họ tên dài',
    recipientPhone: '0900000001',
    fullAddress: '45 Đường Lê Hữu Trác',
    province: 'Thành phố Đà Nẵng',
    ward: 'Phường An Hải',
    isDefault: true,
    placeId: 'map-place',
  ),
  Address(
    id: 'second',
    recipientName: 'Khách hàng thứ hai',
    recipientPhone: '0900000002',
    fullAddress: '12 Đường số 2',
    province: 'Đà Nẵng',
    ward: 'An Hải',
    isDefault: false,
  ),
];

void main() {
  for (final width in [320.0, 390.0]) {
    testWidgets('Chọn và thêm địa chỉ trong modal ở chiều rộng $width', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = Size(width, 844);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      var additions = 0;
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light,
            home: Scaffold(
              body: BookingAddressSelector(
                addresses: addresses,
                onAddAddress: () => additions++,
              ),
            ),
          ),
        ),
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(BookingAddressSelector)),
      );
      container.read(bookingDraftProvider.notifier).startService('service');
      container.read(bookingDraftProvider.notifier).setAddress('first');
      await tester.pumpAndSettle();
      expect(find.text('Đổi'), findsOneWidget);
      await tester.tap(find.text('Đổi'));
      await tester.pumpAndSettle();

      final dialog = find.byType(AlertDialog);
      expect(tester.widget<AlertDialog>(dialog).backgroundColor, Colors.white);
      expect(tester.getSize(dialog).width, greaterThan(width - 64));
      final cards = find.descendant(
        of: dialog,
        matching: find.byType(BookingAddressCard),
      );
      expect(cards, findsNWidgets(2));
      for (final card in tester.widgetList<BookingAddressCard>(cards)) {
        expect(card.action, isNull);
        expect(card.selected, card.address.id == 'first');
      }
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Khách hàng thứ hai'));
      await tester.pumpAndSettle();
      expect(container.read(bookingDraftProvider).addressId, 'second');
      expect(find.text('Đổi'), findsOneWidget);
      expect(find.text('12 Đường số 2, An Hải, Đà Nẵng'), findsOneWidget);

      await tester.tap(find.text('Đổi'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Thêm địa chỉ'));
      await tester.pumpAndSettle();
      expect(additions, 1);
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('Đổi'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
