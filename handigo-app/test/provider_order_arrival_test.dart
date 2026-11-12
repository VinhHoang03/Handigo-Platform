import 'dart:async';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/features/provider/data/provider_location_service.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_detail_screen.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';
import 'package:handigo_app/features/provider/presentation/slide_to_start_order.dart';
import 'package:handigo_app/features/provider/presentation/completion_screen.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  final events = <String>[];
  bool arrived = false, confirmed = true, rejectArrival = false;
  String status = 'accepted', orderType = 'immediate';
  String paymentStatus = 'unpaid', paymentMethod = 'cash';
  bool rejectCash = false;
  Map<String, dynamic>? cashConfirmation;
  Map<String, dynamic>? cancellation;
  Map<String, dynamic>? rescheduleRequest;
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
    if (path == '/feedback/provider/orders/order') return {'data': null};
    if (path == '/orders/order/cash-payment/confirm' && method == 'POST') {
      cashConfirmation = data;
      events.add('cash');
      if (rejectCash) {
        throw const ApiException(
          'Số tiền thanh toán đã thay đổi. Vui lòng tải lại đơn hàng.',
        );
      }
      paymentStatus = 'paid';
      return {'data': {}};
    }
    if (path == '/orders/order/reschedule-requests/request/respond' &&
        method == 'PATCH') {
      events.add('reschedule:${data?['decision']}');
      rescheduleRequest = {...?rescheduleRequest, 'status': 'applied'};
      return {'data': <String, dynamic>{}};
    }
    if (method == 'POST' && path == '/orders/order/arrival') {
      events.add('arrival');
      if (rejectArrival) {
        throw const ApiException(
          'Bạn cần ở gần địa chỉ khách để xác nhận đã đến nơi.',
        );
      }
      arrived = true;
      return {'data': {}};
    }
    if (method == 'POST' && path == '/orders/order/start') {
      events.add('start');
      status = 'in_progress';
      return {'data': {}};
    }
    if (method == 'PATCH' && path == '/orders/order/cancel') {
      cancellation = data;
      status = 'cancelled';
      return {'data': {}};
    }
    expect(path, '/orders/order');
    return {
      'data': {
        'id': 'order',
        'orderCode': 'HD-001',
        'status': status,
        'paymentStatus': paymentStatus,
        'paymentMethod': paymentMethod,
        'pricing': {
          'baseAmount': 120000,
          'bookingAmount': 120000,
          'voucherDiscountAmount': 12000,
          'totalPaidAmount': 108000,
        },
        'orderType': orderType,
        if (rescheduleRequest != null) ...{
          'scheduledAt': DateTime.now()
              .toUtc()
              .add(const Duration(days: 2))
              .toIso8601String(),
          'rescheduleEligibility': {
            'canRequest': false,
            'remainingCount': 1,
            'minAdvanceMinutes': 60,
          },
          'latestRescheduleRequest': rescheduleRequest,
        },
        'bookingStatus': confirmed ? 'confirmed' : 'awaiting_payment',
        'serviceId': {'name': 'Vệ sinh máy lạnh', 'serviceType': 'fixed_price'},
        'providerId': {
          '_id': 'provider',
          'userId': {'fullName': 'Nguyễn An'},
        },
        if (arrived)
          'arrival': {
            'providerId': 'provider',
            'arrivedAt': '2026-11-03T01:00:00Z',
          },
      },
    };
  }
}

class _Tracker extends ProviderLocationService {
  _Tracker(this.api) : super(api);
  final _Api api;
  bool fail = false;
  Completer<void>? pending;
  @override
  Future<void> synchronize({
    required bool Function() shouldUpload,
    bool useCachedPosition = false,
  }) async {
    api.events.add('gps');
    if (fail) throw const ApiException('Vui lòng bật GPS.');
    await pending?.future;
    expect(shouldUpload(), isTrue);
  }
}

Future<void> _show(WidgetTester tester, _Api api, _Tracker tracker) async {
  addTearDown(api.close);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authControllerProvider.overrideWith(
          (ref) => AuthController(AuthRepository(api), api)
            ..user = const AppUser(
              id: 'user',
              fullName: 'Nguyễn An',
              email: 'an@example.test',
              role: UserRole.provider,
              providerOnboardingStatus: 'APPROVED',
            )
            ..status = AuthStatus.authenticated,
        ),
        providerLocationServiceProvider.overrideWith((ref) => tracker),
        orderQuotationProvider('order').overrideWith((ref) async => null),
      ],
      child: const MaterialApp(
        home: ProviderOrderDetailScreen(orderId: 'order'),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _swipe(WidgetTester tester) => tester.drag(
  find.byKey(const ValueKey('start-order-slide-handle')),
  Offset(tester.getSize(find.byType(SlideToStartOrder)).width, 0),
);

void main() {
  for (final method in ['wallet', 'bank']) {
    testWidgets(
      'Khách trả $method sau nghiệm thu: cập nhật đơn sẽ ẩn xác nhận tiền mặt',
      (tester) async {
        final api = _Api()..status = 'completed';
        await _show(tester, api, _Tracker(api));
        expect(find.text('Xác nhận đã nhận tiền mặt'), findsOneWidget);
        api.paymentMethod = method;
        api.paymentStatus = 'paid';
        final container = ProviderScope.containerOf(
          tester.element(find.byType(ProviderOrderDetailScreen)),
        );
        container.invalidate(orderDetailProvider('order'));
        await tester.pumpAndSettle();
        expect(find.text('Xác nhận đã nhận tiền mặt'), findsNothing);
        expect(api.cashConfirmation, isNull);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'Tiền mặt đơn cố định: quay lại không gửi, xác nhận số tiền sau voucher và cập nhật đã trả',
    (tester) async {
      final api = _Api()..status = 'completed';
      await _show(tester, api, _Tracker(api));
      final button = find.text('Xác nhận đã nhận tiền mặt');
      await tester.ensureVisible(button);
      await tester.tap(button);
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.textContaining(RegExp(r'108\.000\s*đ')),
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Quay lại'));
      await tester.pumpAndSettle();
      expect(api.cashConfirmation, isNull);
      await tester.tap(button);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Đã nhận đủ'));
      await tester.pumpAndSettle();
      expect(api.cashConfirmation, {'expectedAmount': 108000.0});
      expect(api.events, ['cash']);
      expect(find.text('Đã xác nhận nhận tiền mặt'), findsOneWidget);
      expect(button, findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Xác nhận tiền mặt lỗi giữ nút để thử lại', (tester) async {
    final api = _Api()
      ..status = 'completed'
      ..rejectCash = true;
    await _show(tester, api, _Tracker(api));
    final button = find.text('Xác nhận đã nhận tiền mặt');
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Đã nhận đủ'));
    await tester.pumpAndSettle();
    expect(api.paymentStatus, 'unpaid');
    expect(button, findsOneWidget);
    expect(find.text('Đã xác nhận nhận tiền mặt'), findsNothing);
    expect(
      find.text('Số tiền thanh toán đã thay đổi. Vui lòng tải lại đơn hàng.'),
      findsOneWidget,
    );
  });

  testWidgets('Đơn trả qua ví không hiển thị xác nhận tiền mặt', (
    tester,
  ) async {
    final api = _Api()
      ..status = 'completed'
      ..paymentMethod = 'wallet'
      ..paymentStatus = 'paid';
    await _show(tester, api, _Tracker(api));
    expect(find.text('Xác nhận đã nhận tiền mặt'), findsNothing);
  });

  testWidgets(
    'Chi tiết công việc của thợ hiển thị và chấp nhận yêu cầu dời lịch của khách',
    (tester) async {
      final api = _Api()
        ..orderType = 'scheduled'
        ..rescheduleRequest = {
          '_id': 'request',
          'status': 'pending',
          'initiatorRole': 'customer',
          'approvalRole': 'provider',
          'reason': 'Khách muốn đổi giờ hẹn',
          'proposedScheduledAt': DateTime.now()
              .toUtc()
              .add(const Duration(days: 3))
              .toIso8601String(),
        };
      await _show(tester, api, _Tracker(api));
      final accept = find.text('Đồng ý lịch mới');
      await tester.scrollUntilVisible(accept.hitTestable(), 120);
      await tester.pumpAndSettle();
      expect(find.text('Khách hàng yêu cầu dời lịch'), findsOneWidget);
      expect(find.text('Thu hồi yêu cầu'), findsNothing);
      await tester.tap(accept);
      await tester.pumpAndSettle();
      expect(api.events, ['reschedule:accept']);
      expect(find.text('Lịch hẹn đã được cập nhật.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Hoàn tất nghiệm thu chỉ mở khi vuốt đủ sang phải', (
    tester,
  ) async {
    final api = _Api()..status = 'in_progress';
    await _show(tester, api, _Tracker(api));
    await tester.tap(find.text('Hoàn tất & nghiệm thu'));
    await tester.pumpAndSettle();
    expect(find.byType(CompletionScreen), findsNothing);
    await tester.drag(
      find.byKey(const ValueKey('start-order-slide-handle')),
      const Offset(60, 0),
    );
    await tester.pumpAndSettle();
    expect(find.byType(CompletionScreen), findsNothing);
    await _swipe(tester);
    await tester.pumpAndSettle();
    expect(find.byType(CompletionScreen), findsOneWidget);
    expect(api.events, isEmpty);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
  for (final type in ['immediate', 'scheduled']) {
    testWidgets(
      'Đơn $type: xác nhận GPS rồi đến nơi, sau đó mới bắt đầu thực hiện',
      (tester) async {
        final api = _Api()..orderType = type;
        final tracker = _Tracker(api)..pending = Completer<void>();
        await _show(tester, api, tracker);
        expect(find.text('Trượt để bắt đầu xử lý'), findsNothing);
        expect(find.text('Đã đến nơi'), findsOneWidget);
        expect(find.text('Hủy đơn dịch vụ'), findsNothing);
        await _swipe(tester);
        await tester.pump();
        expect(api.events, ['gps']);
        expect(
          tester.widget<SlideToStartOrder>(find.byType(SlideToStartOrder)).busy,
          isTrue,
        );
        tracker.pending!.complete();
        await tester.pumpAndSettle();
        expect(api.events, ['gps', 'arrival']);
        expect(find.text('Đã đến nơi'), findsNothing);
        expect(find.text('Bắt đầu thực hiện'), findsOneWidget);
        await tester.tap(find.text('Bắt đầu thực hiện'));
        await tester.pumpAndSettle();
        expect(api.events, ['gps', 'arrival', 'start']);
        expect(find.text('Hoàn tất & nghiệm thu'), findsOneWidget);
        expect(find.text('Hủy đơn dịch vụ'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('GPS lỗi không gọi đến nơi và không bắt đầu đơn', (tester) async {
    final api = _Api();
    final tracker = _Tracker(api)..fail = true;
    await _show(tester, api, tracker);
    await _swipe(tester);
    await tester.pumpAndSettle();
    expect(api.events, ['gps']);
    expect(find.text('Vui lòng bật GPS.'), findsOneWidget);
    expect(find.text('Đã đến nơi'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Máy chủ từ chối đến nơi không tự ghi nhận đã đến hoặc cho bắt đầu',
    (tester) async {
      final api = _Api()..rejectArrival = true;
      await _show(tester, api, _Tracker(api));
      await _swipe(tester);
      await tester.pumpAndSettle();
      expect(api.arrived, isFalse);
      expect(find.text('Đã đến nơi'), findsOneWidget);
      expect(find.text('Bắt đầu thực hiện'), findsNothing);
      expect(
        find.text('Bạn cần ở gần địa chỉ khách để xác nhận đã đến nơi.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Lịch hẹn chưa xác nhận không được đánh dấu đến nơi', (
    tester,
  ) async {
    final api = _Api()
      ..orderType = 'scheduled'
      ..confirmed = false;
    await _show(tester, api, _Tracker(api));
    expect(
      tester.widget<SlideToStartOrder>(find.byType(SlideToStartOrder)).enabled,
      isFalse,
    );
    expect(api.events, isEmpty);
  });

  testWidgets('Nút hủy đơn yêu cầu lý do và chỉ hủy khi xác nhận', (
    tester,
  ) async {
    final api = _Api();
    await _show(tester, api, _Tracker(api));
    expect(find.text('Hủy đơn dịch vụ'), findsNothing);
    await tester.tap(find.byTooltip('Tác vụ đơn hàng'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hủy đơn'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tiếp tục hủy đơn'));
    await tester.pumpAndSettle();
    expect(find.text('Vui lòng chọn lý do hủy đơn.'), findsOneWidget);
    expect(api.cancellation, isNull);
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Không thể đến địa chỉ khách hàng').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tiếp tục hủy đơn'));
    await tester.pumpAndSettle();
    expect(find.text('Xác nhận hủy đơn?'), findsOneWidget);
    expect(api.cancellation, isNull);
    await tester.tap(find.text('Quay lại'));
    await tester.pumpAndSettle();
    expect(find.text('Không thể đến địa chỉ khách hàng'), findsOneWidget);
    await tester.tap(find.text('Tiếp tục hủy đơn'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Xác nhận hủy'));
    await tester.pumpAndSettle();
    expect(api.cancellation, {'reason': 'Không thể đến địa chỉ khách hàng'});
    expect(find.text('Đã đến nơi'), findsNothing);
    expect(find.text('Hủy đơn dịch vụ'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'Lý do khác cần giải thích; quay lại giữ nội dung và đóng không hủy đơn',
    (tester) async {
      final api = _Api();
      await _show(tester, api, _Tracker(api));
      await tester.tap(find.byTooltip('Tác vụ đơn hàng'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hủy đơn'));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lý do khác').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Tiếp tục hủy đơn'));
      await tester.pumpAndSettle();
      expect(
        find.text('Vui lòng nhập giải thích ít nhất 10 ký tự.'),
        findsOneWidget,
      );
      await tester.enterText(
        find.byType(TextFormField),
        'Khách hàng cần thay đổi kế hoạch',
      );
      await tester.tap(find.text('Tiếp tục hủy đơn'));
      await tester.pumpAndSettle();
      expect(
        find.text('Lý do khác: Khách hàng cần thay đổi kế hoạch'),
        findsOneWidget,
      );
      expect(api.cancellation, isNull);
      await tester.tap(find.text('Quay lại'));
      await tester.pumpAndSettle();
      expect(find.text('Khách hàng cần thay đổi kế hoạch'), findsOneWidget);
      await tester.tap(find.text('Đóng'));
      await tester.pumpAndSettle();
      expect(api.cancellation, isNull);
      expect(find.byType(AlertDialog), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  test('Xác nhận đến nơi phải thuộc đúng thợ hiện tại trên đơn', () {
    final order = OrderDetail.fromJson({
      'id': 'order',
      'providerId': {'_id': 'new-provider'},
      'arrival': {
        'providerId': 'old-provider',
        'arrivedAt': '2026-11-03T01:00:00Z',
      },
    });
    expect(order.hasArrived, isFalse);
  });
}
