import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/booking/presentation/booking_policy_panel.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/service_catalog/data/service_catalog_repository.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/service_catalog/domain/service_option.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_screens.dart';
import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/shared/widgets/booking_details_summary.dart';

class _Repository implements ServiceCatalogRepository {
  List<Map<String, dynamic>>? previewOptions;
  @override
  Future<List<Address>> addresses() async => const [
    Address(
      id: 'address',
      recipientName: 'Nguyễn An',
      recipientPhone: '0901234567',
      fullAddress: '45 Đường Lê Hữu Trác, Phường An Hải, Thành phố Đà Nẵng',
      province: 'Đà Nẵng',
      ward: 'An Hải',
      isDefault: true,
      placeId: 'map-place',
    ),
  ];
  @override
  Future<Map<String, dynamic>> bookingPolicies() async => {
    'paymentHoldMinutes': 15,
  };
  @override
  Future<List<Map<String, dynamic>>> nearbyProviders(
    Map<String, dynamic> query,
  ) async => [
    {
      'id': 'provider',
      'user': {'fullName': 'Thợ Minh'},
    },
  ];
  @override
  Future<BookingPreview> preview({
    required String serviceId,
    required BookingType type,
    required List<Map<String, dynamic>> selectedOptions,
    String? voucherCode,
    int? uniformQuantity,
  }) async {
    previewOptions = selectedOptions;
    return const BookingPreview(
      baseAmount: 300000,
      bookingAmount: 300000,
      immediateFee: 0,
      depositAmount: 0,
      minAdvanceMinutes: 0,
      discountedAmount: 270000,
      voucherDiscountAmount: 30000,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> openPolicy(WidgetTester tester) async {
  final rich = find.byWidgetPredicate(
    (widget) =>
        widget is RichText &&
        widget.text.toPlainText().startsWith('Tôi đã đọc và đồng ý với '),
  );
  final paragraph = tester.renderObject<RenderParagraph>(rich);
  final text = paragraph.text.toPlainText();
  final offset = text.indexOf('chính sách Handigo');
  final box = paragraph
      .getBoxesForSelection(
        TextSelection(baseOffset: offset, extentOffset: text.length),
      )
      .first;
  await tester.tapAt(paragraph.localToGlobal(box.toRect().center));
  await tester.pumpAndSettle();
}

void main() {
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'Xác nhận hiển thị đủ thông tin, chính sách tách riêng, chữ $scale',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(320, 800);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        final repository = _Repository();
        final container = ProviderContainer(
          overrides: [
            serviceCatalogRepositoryProvider.overrideWithValue(repository),
          ],
        );
        addTearDown(container.dispose);
        final controller = container.read(bookingDraftProvider.notifier);
        controller.startService('service');
        controller.setAddress('address');
        controller.toggleOption('option');
        controller.setQuantity('option', 3);
        final now = DateTime.now();
        final appointment = DateTime(now.year, now.month, now.day + 1, 10, 30);
        controller.setScheduledAt(appointment);
        controller.setPreferredProvider('provider');
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
              home: const BookingScreen(
                detail: ServiceDetail(
                  service: Service(
                    id: 'service',
                    name: 'Vệ sinh điều hòa',
                    description: '',
                    serviceType: 'fixed_price',
                  ),
                  options: [
                    ServiceOption(
                      id: 'option',
                      name: 'Vệ sinh tiêu chuẩn',
                      price: 100000,
                      allowsQuantity: true,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Tiếp tục'));
        await tester.pumpAndSettle();
        expect(find.text('Xác nhận & Thanh toán'), findsOneWidget);
        final summary = tester.widget<BookingDetailsSummary>(
          find.byType(BookingDetailsSummary),
        );
        expect(summary.address, '45 Lê Hữu Trác, An Hải, Đà Nẵng');
        expect(summary.contact, contains('0901234567'));
        expect(summary.scheduledAt, appointment);
        expect(summary.placedAt, isNotNull);
        expect(summary.isPreview, isTrue);
        expect(summary.providerName, 'Thợ Minh');
        expect(summary.options, [(name: 'Vệ sinh tiêu chuẩn', quantity: 3)]);
        expect(repository.previewOptions, [
          {'optionId': 'option', 'quantity': 3},
        ]);
        expect(find.text('270.000đ'), findsOneWidget);
        expect(find.byType(ExpansionTile), findsNothing);
        await tester.scrollUntilVisible(
          find.byType(BookingPolicyConsent),
          250,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        await openPolicy(tester);
        expect(find.byType(AlertDialog), findsOneWidget);
        expect(find.text('Chính sách Handigo'), findsOneWidget);
        expect(
          find.descendant(
            of: find.byType(AlertDialog),
            matching: find.byType(BookingDetailsSummary),
          ),
          findsNothing,
        );
        await tester.tap(find.byTooltip('Đóng chính sách'));
        await tester.pumpAndSettle();
        expect(tester.widget<Checkbox>(find.byType(Checkbox)).value, isFalse);
        await tester.tap(find.byType(Checkbox));
        await tester.pumpAndSettle();
        expect(tester.widget<Checkbox>(find.byType(Checkbox)).value, isTrue);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'Đơn đã tạo dùng thời gian thực tế, không hiện lịch hẹn hoặc thợ khi thiếu',
    (tester) async {
      final placed = DateTime(2026, 10, 23, 9, 15);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: BookingDetailsSummary(
              address: '45 Lê Hữu Trác, An Hải, Đà Nẵng',
              placedAt: placed,
            ),
          ),
        ),
      );
      expect(find.text('Thời gian đặt'), findsOneWidget);
      expect(find.text('09:15 · 23/10/2026'), findsOneWidget);
      expect(find.text('Lịch hẹn'), findsNothing);
      expect(find.text('Thợ thực hiện'), findsNothing);
    },
  );
}
