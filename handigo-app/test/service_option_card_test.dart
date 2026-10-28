import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/service_catalog/domain/service_option.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_option_selector.dart';
import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/shared/widgets/service_images.dart';

void main() {
  test(
    'Đọc ảnh option theo contract hiện có, tương thích khi không có ảnh',
    () {
      final data = {'_id': 'option', 'name': 'Tùy chọn', 'price': 180000};
      expect(ServiceOption.fromJson(data).image, isNull);
      expect(
        ServiceOption.fromJson({
          ...data,
          'image': 'https://example.com/option.jpg',
        }).image,
        'https://example.com/option.jpg',
      );
    },
  );

  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'Ảnh 16:9, thao tác thẳng hàng, chọn không nở card, chữ $scale',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(320, 900);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        final container = ProviderContainer();
        addTearDown(container.dispose);
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp(
              theme: AppTheme.light,
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(scale)),
                child: child!,
              ),
              home: const Scaffold(
                body: SingleChildScrollView(
                  child: ServiceOptionSelector(
                    detail: ServiceDetail(
                      service: Service(
                        id: 'service',
                        name: 'Dịch vụ',
                        description: '',
                        serviceType: 'fixed_price',
                      ),
                      options: [
                        ServiceOption(
                          id: 'option',
                          name: 'Điều hòa treo tường',
                          price: 180000,
                          description: 'Làm sạch và kiểm tra vận hành.',
                          allowsQuantity: true,
                          selectionMode: 'single',
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final card = find.byKey(const ValueKey('option-option'));
        final originalSize = tester.getSize(card);
        final image = tester.getSize(find.byType(ServiceCoverImage));
        expect(image.width / image.height, closeTo(16 / 9, .001));
        expect(
          tester.getTopLeft(find.byType(ServiceCoverImage)).dx,
          lessThan(tester.getTopLeft(find.text('Điều hòa treo tường')).dx),
        );
        final price = find.byKey(const ValueKey('option-price-option'));
        final quantity = find.byKey(const ValueKey('option-quantity-option'));
        final selection = find.byKey(const ValueKey('option-selection-option'));
        expect(
          tester.getCenter(price).dy,
          closeTo(tester.getCenter(quantity).dy, .1),
        );
        expect(
          tester.getCenter(selection).dy,
          closeTo(tester.getCenter(quantity).dy, .1),
        );
        expect(
          tester
              .widget<IconButton>(
                find.byWidgetPredicate(
                  (widget) =>
                      widget is IconButton && widget.tooltip == 'Tăng số lượng',
                ),
              )
              .onPressed,
          isNull,
        );
        await tester.tap(find.text('Điều hòa treo tường'));
        await tester.pumpAndSettle();
        expect(tester.getSize(card), originalSize);
        expect(find.byIcon(Icons.radio_button_checked), findsOneWidget);
        await tester.tap(find.byTooltip('Tăng số lượng'));
        await tester.pumpAndSettle();
        expect(container.read(bookingDraftProvider).quantities['option'], 2);
        expect(
          container.read(bookingDraftProvider).selectedOptionIds,
          contains('option'),
        );
        expect(tester.getSize(card), originalSize);
        container.read(bookingDraftProvider.notifier).setQuantity('option', 99);
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<IconButton>(
                find.byWidgetPredicate(
                  (widget) =>
                      widget is IconButton && widget.tooltip == 'Tăng số lượng',
                ),
              )
              .onPressed,
          isNull,
        );
        await tester.tap(find.byTooltip('Giảm số lượng'));
        await tester.pumpAndSettle();
        expect(container.read(bookingDraftProvider).quantities['option'], 98);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
