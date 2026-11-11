import 'dart:convert';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/realtime_connection.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/booking/domain/booking_models.dart';
import 'package:handigo_app/features/booking/presentation/booking_payos_panel.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/booking/presentation/booking_policy_panel.dart';
import 'package:handigo_app/features/orders/data/order_repository.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/features/service_catalog/data/service_catalog_repository.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_screens.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/services/domain/service.dart';

final _png = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=',
);

class _Auth extends ChangeNotifier implements AuthController {
  @override
  get user => const AppUser(
    id: 'customer',
    fullName: 'Khách hàng',
    email: 'customer@example.test',
    role: UserRole.customer,
  );
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Orders implements OrderRepository {
  String status = 'pending';
  String orderStatus = 'created';
  String type = 'full';
  DateTime dueAt = DateTime.now().add(const Duration(minutes: 10));
  @override
  Future<OrderDetail> detail(String id) async => OrderDetail.fromJson({
    '_id': id,
    'status': orderStatus,
    'paymentStatus': status == 'paid' ? 'paid' : 'unpaid',
    'paymentMethod': 'bank',
    'paymentDueAt': dueAt.toIso8601String(),
    'pricing': {'totalPaidAmount': 999999},
  });
  @override
  Future<List<Map<String, dynamic>>> payments(String id) async => [
    {
      '_id': 'payment',
      'method': 'payos',
      'status': status,
      'paymentType': type,
      'amount': 20000,
    },
  ];
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Payments implements ServiceCatalogRepository {
  _Payments(this.orders);
  final _Orders orders;
  int qrLoads = 0;
  int reconciliations = 0;
  bool confirmOnReconcile = true;
  bool failReconcile = false;
  @override
  Future<Uint8List> paymentQr(String paymentId) async {
    expect(paymentId, 'payment');
    qrLoads++;
    return _png;
  }

  @override
  Future<PaymentResult> reconcilePayment(String orderId) async {
    reconciliations++;
    if (failReconcile) throw Exception('Lỗi mạng kiểm thử');
    if (confirmOnReconcile) orders.status = 'paid';
    return PaymentResult(status: orders.status, paymentId: 'payment');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _CheckoutPayments extends _Payments {
  _CheckoutPayments(super.orders);
  int createdOrders = 0, createdPayments = 0;
  @override
  dynamic noSuchMethod(Invocation invocation) {
    switch (invocation.memberName) {
      case #addresses:
        return Future.value(const <Address>[
          Address(
            id: 'address',
            recipientName: 'Nguyễn An',
            recipientPhone: '0901234567',
            fullAddress: '45 Lê Hữu Trác',
            province: 'Đà Nẵng',
            ward: 'An Hải',
            isDefault: true,
          ),
        ]);
      case #bookingPolicies:
        return Future.value(<String, dynamic>{'paymentHoldMinutes': 15});
      case #nearbyProviders:
        return Future.value(<Map<String, dynamic>>[
          {'id': 'provider'},
        ]);
      case #preview:
        return Future.value(
          const BookingPreview(
            baseAmount: 20000,
            bookingAmount: 20000,
            immediateFee: 0,
            depositAmount: 0,
            minAdvanceMinutes: 0,
            discountedAmount: 20000,
          ),
        );
      case #createOrder:
        createdOrders++;
        return Future.value(const CreatedOrder(id: 'order', orderCode: 'HD1'));
      case #createPayment:
        createdPayments++;
        return Future.value(
          const PaymentResult(
            status: 'pending',
            paymentId: 'payment',
            checkoutUrl: 'https://pay.payos.vn/test',
          ),
        );
      default:
        return super.noSuchMethod(invocation);
    }
  }
}

Future<void> _open(
  WidgetTester tester,
  _Orders orders,
  _Payments payments, {
  VoidCallback? onPaid,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 900);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        realtimeConnectionProvider.overrideWithValue(null),
        authControllerProvider.overrideWith((ref) => _Auth()),
        orderRepositoryProvider.overrideWithValue(orders),
        serviceCatalogRepositoryProvider.overrideWithValue(payments),
      ],
      child: MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: SingleChildScrollView(
            child: BookingPayosPanel(orderId: 'order', onPaid: onPaid),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (_) async => null,
        );
  });

  testWidgets('Bấm thanh toán giữ bước 2, cuộn tới QR và chỉ tạo một đơn', (
    tester,
  ) async {
    final orders = _Orders();
    final payments = _CheckoutPayments(orders);
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final container = ProviderContainer(
      overrides: [
        realtimeConnectionProvider.overrideWithValue(null),
        authControllerProvider.overrideWith((ref) => _Auth()),
        orderRepositoryProvider.overrideWithValue(orders),
        serviceCatalogRepositoryProvider.overrideWithValue(payments),
      ],
    );
    addTearDown(container.dispose);
    final draft = container.read(bookingDraftProvider.notifier);
    draft.startService('service');
    draft.setAddress('address');
    draft.setPaymentMethod(PaymentMethod.bank);
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    draft.setScheduledAt(
      DateTime(tomorrow.year, tomorrow.month, tomorrow.day, 10),
    );
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.light,
          home: const BookingScreen(
            detail: ServiceDetail(
              service: Service(
                id: 'service',
                name: 'Vệ sinh nhà',
                description: '',
                serviceType: 'fixed_price',
              ),
              options: [],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Tiếp tục'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.byType(BookingPolicyConsent), 200);
    await tester.tap(find.byType(Checkbox));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Thanh toán ngay'));
    await tester.pumpAndSettle();
    expect(find.byType(BookingPayosPanel), findsOneWidget);
    expect(find.byType(Image), findsOneWidget);
    final qrRect = tester.getRect(find.byType(Image));
    expect(qrRect.center.dy, inInclusiveRange(80, 740));
    expect(find.text('Xác nhận & Thanh toán'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Thanh toán ngay'), findsNothing);
    expect(payments.createdOrders, 1);
    expect(payments.createdPayments, 1);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  for (final type in ['full', 'inspection_deposit']) {
    testWidgets('QR dùng số tiền giao dịch $type, không lấy tổng tiền đơn', (
      tester,
    ) async {
      final orders = _Orders()..type = type;
      final payments = _Payments(orders)..confirmOnReconcile = false;
      await _open(tester, orders, payments);
      expect(find.text('20.000 đ'), findsOneWidget);
      expect(find.byType(Image), findsOneWidget);
      await tester.pump(const Duration(seconds: 16));
      await tester.pumpAndSettle();
      expect(payments.qrLoads, 1);
      expect(payments.reconciliations, greaterThan(0));
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }

  testWidgets(
    'Ẩn QR khi hết hạn hoặc đơn bị hủy, kể cả giao dịch đã trả tiền',
    (tester) async {
      final orders = _Orders()
        ..dueAt = DateTime.now().subtract(const Duration(minutes: 1));
      final payments = _Payments(orders);
      var completed = false;
      await _open(tester, orders, payments, onPaid: () => completed = true);
      expect(find.byType(Image), findsNothing);
      expect(payments.qrLoads, 0);
      expect(find.textContaining('Đã hết thời gian'), findsOneWidget);
      orders.orderStatus = 'cancelled';
      await tester.tap(find.text('Kiểm tra thanh toán'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Đơn hàng đã hủy'), findsOneWidget);
      expect(completed, isFalse);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('Đối soát thành công gọi kết quả một lần và ẩn QR', (
    tester,
  ) async {
    final orders = _Orders();
    final payments = _Payments(orders);
    var completions = 0;
    await _open(tester, orders, payments, onPaid: () => completions++);
    await tester.tap(find.text('Kiểm tra thanh toán'));
    await tester.pumpAndSettle();
    expect(payments.reconciliations, 1);
    expect(completions, 1);
    expect(find.byType(Image), findsNothing);
    await tester.pump(const Duration(seconds: 16));
    expect(completions, 1);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'Tự đối soát sau lỗi mạng, hiện dấu tick và dừng khi đã trả tiền',
    (tester) async {
      final orders = _Orders();
      final payments = _Payments(orders)..failReconcile = true;
      var completions = 0;
      await _open(tester, orders, payments, onPaid: () => completions++);
      expect(find.byIcon(Icons.check_circle_rounded), findsNothing);
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(payments.reconciliations, 1);
      expect(completions, 0);
      expect(find.byIcon(Icons.check_circle_rounded), findsNothing);

      payments.failReconcile = false;
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();
      expect(payments.reconciliations, 2);
      expect(completions, 1);
      expect(find.text('Đã xác nhận thanh toán thành công.'), findsOneWidget);
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
      expect(find.byType(Image), findsNothing);
      expect(find.text('Kiểm tra thanh toán'), findsNothing);
      await tester.pump(const Duration(seconds: 15));
      expect(payments.reconciliations, 2);
      expect(completions, 1);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'Tạm dừng đối soát khi ứng dụng chạy nền và kiểm tra khi trở lại',
    (tester) async {
      final orders = _Orders();
      final payments = _Payments(orders);
      await _open(tester, orders, payments);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(seconds: 10));
      expect(payments.reconciliations, 0);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(payments.reconciliations, 1);
      expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  test('Tải ảnh QR với xác thực và làm mới token khi hết phiên', () async {
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    final api = ApiClient(dio, CookieJar())..setToken('old');
    addTearDown(api.close);
    var attempts = 0;
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (options.path == '/auth/refresh-token') {
            handler.resolve(
              Response(requestOptions: options, data: {'token': 'new'}),
            );
            return;
          }
          expect(options.path, '/payments/payment/qr');
          expect(options.responseType, ResponseType.bytes);
          attempts++;
          if (attempts == 1) {
            expect(options.headers['Authorization'], 'Bearer old');
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(requestOptions: options, statusCode: 401),
                type: DioExceptionType.badResponse,
              ),
            );
          } else {
            expect(options.headers['Authorization'], 'Bearer new');
            handler.resolve(
              Response<List<int>>(requestOptions: options, data: _png),
            );
          }
        },
      ),
    );
    expect(await api.paymentQr('payment'), _png);
    expect(attempts, 2);
  });
}
