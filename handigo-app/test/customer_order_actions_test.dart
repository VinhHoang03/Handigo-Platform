import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/account/domain/account_models.dart';
import 'package:handigo_app/features/account/presentation/account_screens.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/booking/data/booking_draft_store.dart';
import 'package:handigo_app/features/booking/presentation/booking_provider.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_payment_panel.dart';
import 'package:handigo_app/features/orders/presentation/order_rebook_button.dart';
import 'package:handigo_app/features/orders/presentation/order_reschedule_panel.dart';
import 'package:handigo_app/features/orders/presentation/order_reschedule_date_time_picker.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/service_catalog/domain/service_option.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';
import 'package:handigo_app/features/services/domain/service.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());

  final calls = <(String, String, Map<String, dynamic>?)>[];
  bool failPreview = false;
  bool warningRequired = false;

  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expect(authenticated, isTrue);
    calls.add((method, path, data));
    if (path.endsWith('/reschedule-preview')) {
      if (failPreview) {
        failPreview = false;
        throw const ApiException('Không thể kiểm tra lịch lúc này.');
      }
      return {
        'data': {
          'approvalRequired': true,
          'warningRequired': warningRequired,
          'providerMonthlyAppliedCount': warningRequired ? 3 : 0,
        },
      };
    }
    return {'data': <String, dynamic>{}};
  }
}

const _service = ServiceDetail(
  service: Service(
    id: 'service',
    name: 'Vệ sinh điều hòa',
    description: '',
    serviceType: 'fixed_price',
  ),
  options: [
    ServiceOption(
      id: 'available',
      name: 'Máy treo tường',
      price: 150000,
      allowsQuantity: true,
    ),
  ],
);

OrderDetail _scheduledOrder({String? initiatorRole}) {
  final tomorrow = DateTime.now().toUtc().add(const Duration(days: 2));
  return OrderDetail.fromJson({
    '_id': 'order',
    'orderType': 'scheduled',
    'status': 'accepted',
    'paymentStatus': 'paid',
    'paymentMethod': 'wallet',
    'scheduledAt': DateTime.utc(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      2,
    ).toIso8601String(),
    'updatedAt': '2026-11-01T08:00:00.000Z',
    'rescheduleEligibility': {
      'canRequest': initiatorRole == null,
      'minAdvanceMinutes': 60,
      'remainingCount': 1,
    },
    if (initiatorRole != null)
      'latestRescheduleRequest': {
        '_id': 'request',
        'status': 'pending',
        'initiatorRole': initiatorRole,
        'approvalRole': initiatorRole == 'customer' ? 'provider' : 'customer',
        'proposedScheduledAt': DateTime.utc(
          tomorrow.year,
          tomorrow.month,
          tomorrow.day,
          3,
        ).toIso8601String(),
        'reason': 'Cần điều chỉnh giờ hẹn',
      },
  });
}

Future<void> _mount(
  WidgetTester tester,
  _Api api,
  Widget child, {
  double textScale = 1,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 720);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(api.close);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        accountVouchersProvider.overrideWith(
          (ref) async => const [
            VoucherItem(
              code: 'SAVED10',
              name: 'Ưu đãi đã lưu',
              discountType: 'PERCENT',
              discountValue: 10,
            ),
          ],
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.customerModals(AppTheme.light),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _chooseNextRescheduleHour(WidgetTester tester) async {
  final wheel = find.byKey(const ValueKey('reschedule-Giờ'));
  await tester.ensureVisible(wheel);
  await tester.pumpAndSettle();
  await tester.drag(wheel, const Offset(0, -44));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('Bộ chọn dời lịch chuyển sang 21 giờ chỉ giữ phút 00', (
    tester,
  ) async {
    final api = _Api();
    var selected = DateTime.utc(2026, 11, 15, 13, 30);
    await _mount(
      tester,
      api,
      StatefulBuilder(
        builder: (context, setState) => OrderRescheduleDateTimePicker(
          value: selected,
          earliest: DateTime.utc(2026, 11, 15, 1),
          onChanged: (value) => setState(() => selected = value),
        ),
      ),
    );
    final hours = find.byKey(const ValueKey('reschedule-Giờ'));
    await tester.ensureVisible(hours);
    await tester.pumpAndSettle();
    await tester.drag(hours, const Offset(0, -44));
    await tester.pumpAndSettle();
    expect(selected, DateTime.utc(2026, 11, 15, 14));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Form dời lịch cuộn được trên màn hình nhỏ và chữ lớn', (
    tester,
  ) async {
    final api = _Api();
    await _mount(
      tester,
      api,
      OrderReschedulePanel(order: _scheduledOrder(), providerView: true),
      textScale: 1.6,
    );
    await tester.tap(find.text('Đề nghị dời lịch'));
    await tester.pumpAndSettle();
    final reason = find.widgetWithText(TextField, 'Lý do dời lịch');
    await tester.ensureVisible(reason);
    await tester.pumpAndSettle();
    await tester.enterText(reason, 'Tôi cần đổi thời gian làm việc');
    await tester.pumpAndSettle();
    expect(find.text('Gửi yêu cầu').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Đóng'));
    await tester.pumpAndSettle();
  });

  test('Giờ dời lịch làm tròn theo phút và chặn sau 21 giờ Việt Nam', () {
    final day = DateTime.utc(2026, 11, 15);
    expect(
      firstAvailableRescheduleTime(day, DateTime.utc(2026, 11, 15, 0, 59, 59)),
      DateTime.utc(2026, 11, 15, 1),
    );
    expect(
      firstAvailableRescheduleTime(day, DateTime.utc(2026, 11, 15, 14, 0, 1)),
      isNull,
    );
    expect(
      isAllowedRescheduleTime(
        DateTime.utc(2026, 11, 15, 14, 1),
        DateTime.utc(2026, 11, 15),
      ),
      isFalse,
    );
  });
  test('Bản nháp đặt lại quá hạn bị bỏ', () async {
    FlutterSecureStorage.setMockInitialValues({
      'handigo_rebook_customer/order': '{"expiresAt":0}',
    });
    const store = BookingDraftStore();
    expect(await store.readRebooking('customer', 'order'), isNull);
    expect(
      await const FlutterSecureStorage().read(
        key: 'handigo_rebook_customer/order',
      ),
      isNull,
    );
  });

  testWidgets('Đặt lại mở đúng bản nháp theo đơn và giữ bản nháp đặt mới', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    final api = _Api();
    addTearDown(api.close);
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(
            body: OrderRebookButton(
              orderId: 'order',
              order: OrderDetail(
                id: 'order',
                code: 'HDG-01',
                serviceName: 'Vệ sinh điều hòa',
                status: 'completed',
                paymentStatus: 'paid',
                paymentMethod: 'cash',
                serviceId: 'service',
                addressId: 'old-address',
                selectedOptions: [
                  {'optionId': 'available', 'quantity': 2},
                  {'optionId': 'retired', 'quantity': 5},
                ],
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/customer/bookings/new/:serviceId',
          builder: (_, state) {
            final session = state.extra as RebookingSession;
            return ProviderScope(
              overrides: [
                bookingDraftProvider.overrideWith(
                  () => BookingDraftController.rebooking(session),
                ),
              ],
              child: Consumer(
                builder: (_, ref, _) {
                  final draft = ref.watch(bookingDraftProvider);
                  return Scaffold(
                    body: Column(
                      children: [
                        Text('Đơn mới từ ${session.orderId}'),
                        Text(draft.problemDescription),
                        TextButton(
                          onPressed: () => ref
                              .read(bookingDraftProvider.notifier)
                              .setProblemDescription('Gọi trước khi đến'),
                          child: const Text('Sửa ghi chú'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            );
          },
        ),
      ],
    );
    addTearDown(router.dispose);
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(
          (ref) => AuthController(AuthRepository(api), api)
            ..user = const AppUser(
              id: 'customer',
              fullName: 'Khách hàng',
              email: '',
              role: UserRole.customer,
            ),
        ),
        serviceDetailProvider('service').overrideWith((ref) async => _service),
      ],
    );
    addTearDown(container.dispose);
    container.read(bookingDraftProvider.notifier).startService('other');
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Đặt lại dịch vụ'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(find.text('Đơn mới từ order'), findsOneWidget);
    expect(container.read(bookingDraftProvider).serviceId, 'other');
    await tester.tap(find.text('Sửa ghi chú'));
    await tester.pumpAndSettle();
    router.pop();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đặt lại dịch vụ'));
    await tester.pumpAndSettle();
    expect(find.text('Gọi trước khi đến'), findsOneWidget);
    final draft = await const BookingDraftStore().readRebooking(
      'customer',
      'order',
    );
    expect(draft?.selectedOptionIds, ['available']);
    expect(draft?.quantities, {'available': 2});
    expect(
      await const BookingDraftStore().readRebooking('customer', 'other-order'),
      isNull,
    );
    expect(
      await const BookingDraftStore().readRebooking('other-user', 'order'),
      isNull,
    );
  });

  testWidgets(
    'Kiểm tra lịch theo giờ Việt Nam rồi gửi yêu cầu có phiên bản đơn',
    (tester) async {
      final api = _Api()..failPreview = true;
      final order = _scheduledOrder();
      await _mount(tester, api, OrderReschedulePanel(order: order));
      await tester.tap(find.text('Yêu cầu dời lịch'));
      await tester.pumpAndSettle();
      final dialog = find.byType(AlertDialog);
      expect(
        DialogTheme.of(tester.element(dialog)).backgroundColor,
        Colors.white,
      );
      await _chooseNextRescheduleHour(tester);
      expect(find.text('Không thể kiểm tra lịch lúc này.'), findsOneWidget);
      await tester.ensureVisible(find.text('Kiểm tra lại lịch'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Kiểm tra lại lịch'));
      await tester.pumpAndSettle();
      final reason = find.widgetWithText(TextField, 'Lý do dời lịch');
      await tester.ensureVisible(reason);
      await tester.enterText(reason, 'Tôi bận công việc');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Gửi yêu cầu'));
      await tester.pumpAndSettle();
      final expected = order.scheduledAt!
          .add(const Duration(hours: 1))
          .toIso8601String();
      expect(
        api.calls
            .where((call) => call.$2.endsWith('/reschedule-preview'))
            .map((call) => call.$3!['scheduledAt']),
        [expected, expected],
      );
      expect(
        (api.calls.last.$1, api.calls.last.$2),
        ('POST', '/orders/order/reschedule-requests'),
      );
      expect(api.calls.last.$3, {
        'scheduledAt': expected,
        'reason': 'Tôi bận công việc',
        'expectedOrderUpdatedAt': '2026-11-01T08:00:00.000Z',
      });
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Khách hàng chỉ thu hồi yêu cầu do mình gửi hoặc trả lời đề nghị của thợ',
    (tester) async {
      final api = _Api();
      await _mount(
        tester,
        api,
        OrderReschedulePanel(order: _scheduledOrder(initiatorRole: 'provider')),
      );
      expect(find.text('Thu hồi yêu cầu'), findsNothing);
      await tester.tap(find.text('Từ chối'));
      await tester.pumpAndSettle();
      final submit = find.widgetWithText(FilledButton, 'Xác nhận từ chối');
      expect(tester.widget<FilledButton>(submit).onPressed, isNull);
      await tester.enterText(find.byType(TextField), 'Tôi không rảnh');
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(
        (api.calls.last.$1, api.calls.last.$2),
        ('PATCH', '/orders/order/reschedule-requests/request/respond'),
      );
      expect(api.calls.last.$3, {
        'decision': 'reject',
        'reason': 'Tôi không rảnh',
        'expectedOrderUpdatedAt': '2026-11-01T08:00:00.000Z',
      });
    },
  );

  testWidgets('Khách hàng thu hồi yêu cầu đang chờ thợ', (tester) async {
    final api = _Api();
    await _mount(
      tester,
      api,
      OrderReschedulePanel(order: _scheduledOrder(initiatorRole: 'customer')),
    );
    expect(find.text('Đồng ý lịch mới'), findsNothing);
    await tester.tap(find.text('Thu hồi yêu cầu'));
    await tester.pumpAndSettle();
    expect(api.calls.last, (
      'PATCH',
      '/orders/order/reschedule-requests/request/cancel',
      null,
    ));
  });

  testWidgets(
    'Thợ gửi đề nghị sau khi xác nhận cảnh báo dời lịch trong tháng',
    (tester) async {
      final api = _Api()..warningRequired = true;
      final order = _scheduledOrder();
      await _mount(
        tester,
        api,
        OrderReschedulePanel(order: order, providerView: true),
      );
      await tester.tap(find.text('Đề nghị dời lịch'));
      await tester.pumpAndSettle();
      await _chooseNextRescheduleHour(tester);
      expect(
        find.text(
          'Lịch phù hợp. Khách hàng cần đồng ý sau khi bạn gửi đề nghị.',
        ),
        findsOneWidget,
      );
      final reason = find.widgetWithText(TextField, 'Lý do dời lịch');
      await tester.ensureVisible(reason);
      await tester.enterText(reason, 'Cần điều chỉnh giờ làm việc');
      await tester.pumpAndSettle();
      final send = find.widgetWithText(FilledButton, 'Gửi yêu cầu');
      expect(tester.widget<FilledButton>(send).onPressed, isNull);
      await tester.ensureVisible(find.byType(CheckboxListTile));
      await tester.tap(find.byType(CheckboxListTile));
      await tester.pumpAndSettle();
      await tester.tap(send);
      await tester.pumpAndSettle();
      expect(api.calls.last.$2, '/orders/order/reschedule-requests');
      expect(api.calls.last.$3?['warningAcknowledged'], isTrue);
      expect(
        api.calls.last.$3?['expectedOrderUpdatedAt'],
        '2026-11-01T08:00:00.000Z',
      );
      expect(
        api.calls.last.$3?['scheduledAt'],
        order.scheduledAt!.add(const Duration(hours: 1)).toIso8601String(),
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Thợ chỉ thu hồi đề nghị của mình, phản hồi yêu cầu của khách', (
    tester,
  ) async {
    final api = _Api();
    await _mount(
      tester,
      api,
      OrderReschedulePanel(
        order: _scheduledOrder(initiatorRole: 'provider'),
        providerView: true,
      ),
    );
    expect(find.text('Đang chờ khách hàng phản hồi'), findsOneWidget);
    expect(find.text('Đồng ý lịch mới'), findsNothing);
    await tester.tap(find.text('Thu hồi yêu cầu'));
    await tester.pumpAndSettle();
    expect(
      api.calls.last.$2,
      '/orders/order/reschedule-requests/request/cancel',
    );
  });

  testWidgets('Thợ từ chối yêu cầu của khách cần lý do hợp lệ', (tester) async {
    final api = _Api();
    await _mount(
      tester,
      api,
      OrderReschedulePanel(
        order: _scheduledOrder(initiatorRole: 'customer'),
        providerView: true,
      ),
    );
    expect(find.text('Khách hàng yêu cầu dời lịch'), findsOneWidget);
    expect(find.text('Thu hồi yêu cầu'), findsNothing);
    await tester.tap(find.text('Từ chối'));
    await tester.pumpAndSettle();
    final submit = find.widgetWithText(FilledButton, 'Xác nhận từ chối');
    expect(tester.widget<FilledButton>(submit).onPressed, isNull);
    await tester.enterText(find.byType(TextField), 'Trùng lịch làm việc');
    await tester.pumpAndSettle();
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(api.calls.last.$3?['decision'], 'reject');
    expect(api.calls.last.$3?['reason'], 'Trùng lịch làm việc');
    expect(tester.takeException(), isNull);
  });

  testWidgets('Voucher đã lưu áp dụng vào đơn chờ thanh toán qua modal trắng', (
    tester,
  ) async {
    final api = _Api();
    await _mount(
      tester,
      api,
      const OrderPaymentPanel(
        order: OrderDetail(
          id: 'order',
          code: 'HDG-01',
          serviceName: 'Vệ sinh điều hòa',
          status: 'created',
          paymentStatus: 'unpaid',
          paymentMethod: 'wallet',
          totalAmount: 150000,
        ),
      ),
    );
    final container = ProviderScope.containerOf(
      tester.element(find.byType(OrderPaymentPanel)),
    );
    container.read(bookingDraftProvider.notifier).setVoucherCode('DRAFT5');
    await tester.tap(find.text('Áp dụng voucher'));
    await tester.pumpAndSettle();
    final dialog = find.byType(AlertDialog);
    expect(
      DialogTheme.of(tester.element(dialog)).backgroundColor,
      Colors.white,
    );
    await tester.tap(find.byTooltip('Chọn voucher'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('SAVED10 · Ưu đãi đã lưu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Áp dụng'));
    await tester.pumpAndSettle();
    expect((api.calls.last.$1, api.calls.last.$2), ('POST', '/vouchers/apply'));
    expect(api.calls.last.$3, {'orderId': 'order', 'code': 'SAVED10'});
    expect(container.read(bookingDraftProvider).voucherCode, 'DRAFT5');
    expect(tester.takeException(), isNull);
  });
}
