import 'dart:io';
import 'dart:ui' as ui;
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/core/network/realtime_connection.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_detail_overview.dart';
import 'package:handigo_app/features/orders/presentation/order_followup_panel.dart';
import 'package:handigo_app/features/orders/presentation/order_payment_panel.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/features/orders/presentation/tracking_screen.dart';
import 'package:handigo_app/shared/widgets/provider_avatar.dart';
import 'package:handigo_app/shared/widgets/service_images.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async => throw const ApiException('Chuyên gia chưa chia sẻ vị trí.');
}

OrderDetail _order(
  String status, {
  bool pending = false,
  bool ready = true,
}) => OrderDetail.fromJson({
  '_id': 'order',
  'orderCode': 'ORD-862989D702F6',
  'serviceId': {'_id': 'service', 'name': 'Sửa chữa điều hòa'},
  'status': status,
  'paymentStatus': 'unpaid',
  'paymentMethod': 'cash',
  'hasPendingAssignment': pending,
  'readyForMatching': ready,
  'providerId': ['accepted', 'in_progress'].contains(status)
      ? {
          '_id': 'provider',
          'averageRating': 4.8,
          'userId': {'fullName': 'Anh Minh'},
        }
      : null,
  'addressSnapshot': {
    'fullAddress':
        '12 Nguyễn Văn Linh, Phường Tân Phong, Thành phố Hồ Chí Minh',
  },
  'createdAt': '2026-10-23T08:07:51Z',
  'updatedAt': '2026-10-23T08:11:51Z',
  'statusHistory': [
    {'status': 'created', 'createdAt': '2026-10-23T08:07:51Z'},
    if (['accepted', 'in_progress', 'completed'].contains(status))
      {'status': 'accepted', 'createdAt': '2026-10-23T08:08:51Z'},
    if (['in_progress', 'completed'].contains(status))
      {'status': 'in_progress', 'createdAt': '2026-10-23T08:09:51Z'},
    if (status == 'completed')
      {'status': 'completed', 'createdAt': '2026-10-23T08:11:51Z'},
    if (status == 'cancelled')
      {
        'status': 'cancelled',
        'createdAt': '2026-10-23T08:11:51Z',
        'note':
            'Không tìm thấy thợ phù hợp trong bán kính 10 km sau thời gian tìm kiếm.',
      },
  ],
});

Future<ProviderContainer> _show(
  WidgetTester tester,
  OrderDetail Function() current, {
  Size size = const Size(390, 844),
  double scale = 1,
  RepairQuotation? quotation,
}) async {
  FlutterSecureStorage.setMockInitialValues({});
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  final api = _Api();
  addTearDown(api.close);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        realtimeConnectionProvider.overrideWithValue(null),
        orderDetailProvider('order').overrideWith((ref) async => current()),
        orderQuotationProvider('order').overrideWith((ref) async => quotation),
        orderPaymentsProvider('order').overrideWith((ref) async => []),
        orderFeedbackContextProvider('order').overrideWith((ref) async => {}),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: const OrderDetailScreen(orderId: 'order'),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(
    tester.element(find.byType(OrderDetailScreen)),
  );
}

void main() {
  test(
    'Chi tiết dùng cùng nhãn trạng thái với danh sách và đọc tọa độ, lý do hủy',
    () {
      expect(
        customerOrderStatusLabel(_order('created', ready: false).summary),
        'Chờ thanh toán',
      );
      expect(
        customerOrderStatusLabel(_order('created').summary),
        'Đang tìm thợ',
      );
      expect(
        customerOrderStatusLabel(_order('created', pending: true).summary),
        'Chờ xác nhận',
      );
      expect(customerOrderStatusLabel(_order('accepted').summary), 'Chờ xử lý');
      expect(
        customerOrderStatusLabel(_order('in_progress').summary),
        'Đang xử lý',
      );
      final order = OrderDetail.fromJson({
        '_id': 'old',
        'status': 'cancelled',
        'cancellation': {
          'reason': 'Khách đổi kế hoạch',
          'cancelledAt': '2026-10-23T08:00:00Z',
        },
        'addressSnapshot': {'latitude': 10.7, 'longitude': 106.7},
        'serviceId': {'coverImage': '/images/service.png'},
      });
      expect(order.serviceImage, '/images/service.png');
      expect(order.cancellationReason, 'Khách đổi kế hoạch');
      expect(order.addressLatitude, 10.7);
      expect(order.cancelledAt, DateTime.utc(2026, 10, 23, 8));
      final quotation = RepairQuotation.fromJson({
        'quotation': {
          'id': 'quote',
          'status': 'saved',
          'finalAmount': 500000,
          'paidDeposit': 100000,
          'remainingDirectPaymentAmount': 400000,
        },
      });
      expect(quotation.paidDeposit, 100000);
      expect(quotation.remainingDirectPaymentAmount, 400000);
    },
  );

  for (final status in [
    'created',
    'accepted',
    'in_progress',
    'completed',
    'cancelled',
  ]) {
    testWidgets(
      'Chi tiết $status hiển thị gọn và không nhúng bản đồ theo dõi',
      (tester) async {
        await _show(tester, () => _order(status));
        final tracking = find.byType(OrderTrackingScreen);
        expect(tracking, findsNothing);
        expect(find.byType(ServiceCoverImage), findsOneWidget);
        expect(
          find.text('Nhắn tin với thợ'),
          ['accepted', 'in_progress'].contains(status)
              ? findsOneWidget
              : findsNothing,
        );
        expect(find.text('Lịch hẹn: Đã xác nhận'), findsNothing);
        await tester.scrollUntilVisible(
          find.byType(OrderProgressTimeline),
          300,
        );
        expect(find.byType(OrderProgressTimeline), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Tải lại dữ liệu cập nhật tiến độ khi đơn đã hủy', (
    tester,
  ) async {
    var current = _order('created');
    final container = await _show(tester, () => current);
    current = _order('accepted');
    container.invalidate(orderDetailProvider('order'));
    await tester.pumpAndSettle();
    expect(find.byType(OrderTrackingScreen), findsNothing);
    await tester.scrollUntilVisible(find.text('Chuyên gia đã nhận đơn'), 300);
    await tester.pumpAndSettle();
    current = _order('cancelled');
    container.invalidate(orderDetailProvider('order'));
    await tester.pumpAndSettle();
    expect(find.byType(OrderTrackingScreen), findsNothing);
    await tester.scrollUntilVisible(find.text('Đơn hàng đã hủy'), 300);
    await tester.pumpAndSettle();
    expect(find.text('Đơn hàng đã hủy'), findsOneWidget);
    expect(
      find.text(
        'Lý do hủy: Không tìm thấy thợ phù hợp trong bán kính 10 km sau thời gian tìm kiếm.',
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Tiêu đề đơn căn trạng thái cùng tên và không có nút cập nhật vị trí',
    (tester) async {
      await _show(tester, () => _order('accepted'));
      final overview = find.byType(OrderDetailOverview);
      final serviceName = find.descendant(
        of: overview,
        matching: find.text('Sửa chữa điều hòa'),
      );
      final status = find.descendant(
        of: overview,
        matching: find.text('Chờ xử lý'),
      );
      final code = find.descendant(
        of: overview,
        matching: find.text('Mã đơn: ORD-862989D702F6'),
      );
      expect(serviceName, findsOneWidget);
      expect(status, findsOneWidget);
      expect(code, findsOneWidget);
      expect(
        tester.getCenter(serviceName).dy,
        closeTo(tester.getCenter(status).dy, 1),
      );
      expect(
        tester.getTopLeft(code).dy,
        greaterThan(tester.getTopLeft(serviceName).dy),
      );
      expect(find.text('Cập nhật vị trí'), findsNothing);
      expect(
        find.descendant(of: overview, matching: find.text('Chưa thanh toán')),
        findsNothing,
      );
      expect(
        find.descendant(
          of: find.byType(OrderPaymentPanel),
          matching: find.text('Chưa thanh toán · Tiền mặt'),
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  for (final width in [320.0, 390.0]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('Thẻ tiến độ không tràn, rộng $width, chữ $scale', (
        tester,
      ) async {
        await _show(
          tester,
          () => _order('cancelled'),
          size: Size(width, 844),
          scale: scale,
        );
        await tester.scrollUntilVisible(find.text('Đơn hàng đã hủy'), 300);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets(
    'Thanh toán hiển thị option một hàng và chỉ hiện voucher có dữ liệu',
    (tester) async {
      final order = OrderDetail.fromJson({
        '_id': 'order',
        'status': 'accepted',
        'selectedOptionsSnapshot': [
          {
            'name': 'Vệ sinh máy',
            'price': 120000,
            'quantity': 2,
            'subtotal': 240000,
          },
        ],
        'pricing': {
          'baseAmount': 240000,
          'immediateFee': 20000,
          'promotionDiscountAmount': 10000,
          'voucherDiscountAmount': 30000,
          'totalPaidAmount': 220000,
        },
      });
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: OrderPaymentSummary(order: order)),
        ),
      );
      expect(find.text('Vệ sinh máy 120.000đ × 2'), findsOneWidget);
      expect(find.text('240.000đ'), findsOneWidget);
      expect(
        tester.getCenter(find.text('Vệ sinh máy 120.000đ × 2')).dy,
        closeTo(tester.getCenter(find.text('240.000đ')).dy, 1),
      );
      expect(find.text('Voucher'), findsOneWidget);
      expect(find.text('−30.000đ'), findsOneWidget);
      expect(find.textContaining('Ưu đãi hệ thống'), findsNothing);
      expect(find.text('Số tiền cần thanh toán'), findsOneWidget);
      expect(find.text('220.000đ'), findsOneWidget);
      expect(
        tester.getTopRight(find.text('240.000đ')).dx,
        closeTo(tester.getTopRight(find.text('220.000đ')).dx, 1),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: OrderPaymentSummary(order: _order('cancelled'))),
        ),
      );
      expect(find.text('Voucher'), findsNothing);
    },
  );

  testWidgets('Báo giá trừ cọc đã trả một lần và chỉ cho xem', (tester) async {
    final order = OrderDetail.fromJson({
      '_id': 'order',
      'status': 'accepted',
      'inspectionRequired': true,
      'depositPaidAt': '2026-10-23T08:00:00Z',
      'pricing': {
        'baseAmount': 120000,
        'voucherDiscountAmount': 20000,
        'totalPaidAmount': 100000,
      },
    });
    const quotation = RepairQuotation(
      id: 'quote',
      status: 'pending',
      finalAmount: 500000,
      items: [
        QuotationItem(title: 'Thay linh kiện', quantity: 2, unitPrice: 250000),
      ],
    );
    await _show(tester, () => order, quotation: quotation);
    expect(find.text('Đã thanh toán cọc'), findsOneWidget);
    expect(find.text('100.000đ'), findsOneWidget);
    expect(find.text('Số tiền cần thanh toán'), findsOneWidget);
    expect(find.text('400.000đ'), findsOneWidget);
    await tester.scrollUntilVisible(find.byType(OrderQuotationSection), 300);
    await tester.pumpAndSettle();
    expect(find.text('Báo giá của thợ'), findsOneWidget);
    expect(find.text('250.000 đ × 2 = 500.000 đ'), findsOneWidget);
    expect(
      find.descendant(
        of: find.byType(OrderQuotationSection),
        matching: find.byType(ButtonStyleButton),
      ),
      findsNothing,
    );
    expect(
      tester.getTopLeft(find.byType(OrderQuotationSection)).dy,
      greaterThan(tester.getTopLeft(find.byType(OrderProgressTimeline)).dy),
    );
    expect(tester.takeException(), isNull);
  });

  for (final status in ['created', 'in_progress', 'cancelled']) {
    testWidgets('Menu tác vụ $status chỉ cho hủy khi được phép', (
      tester,
    ) async {
      await _show(tester, () => _order(status));
      await tester.tap(find.byIcon(Icons.more_vert));
      await tester.pumpAndSettle();
      expect(
        find.text('Hủy đơn'),
        status == 'created' ? findsOneWidget : findsNothing,
      );
      expect(find.text('Báo cáo đơn hàng'), findsOneWidget);
      await tester.tap(find.text('Báo cáo đơn hàng'));
      await tester.pumpAndSettle();
      expect(find.text('Báo cáo vấn đề'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('Thẻ hủy có ngày tạo, thời điểm hủy và lý do theo ảnh mẫu', (
    tester,
  ) async {
    final key = GlobalKey();
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Center(
            child: RepaintBoundary(
              key: key,
              child: SizedBox(
                width: 390,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: OrderProgressTimeline(order: _order('cancelled')),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Đã tạo đơn hàng'), findsOneWidget);
    expect(find.textContaining('23/10/2026'), findsNWidgets(2));
    if (const bool.fromEnvironment('ORDER_DETAIL_PREVIEW')) {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File(
          '.dart_tool/order-progress-cancelled.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }
  });
  testWidgets(
    'Thông tin gọn, có thợ, điểm đánh giá và nút nhắn tin ngay cạnh',
    (tester) async {
      await _show(tester, () => _order('accepted'));
      expect(find.text('Địa chỉ thực hiện'), findsNothing);
      expect(find.text('Theo dõi đơn'), findsNothing);
      expect(find.text('Nhắn tin với nhà cung cấp'), findsNothing);
      expect(find.text('Anh Minh'), findsOneWidget);
      expect(find.text('4.8/5'), findsOneWidget);
      expect(find.text('Nhắn tin với thợ'), findsOneWidget);
      expect(find.byType(ProviderAvatar), findsOneWidget);
      expect(find.textContaining('Thời gian đặt:'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
