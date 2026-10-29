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
import 'package:handigo_app/features/provider/data/provider_repository.dart';
import 'package:handigo_app/features/provider/domain/provider_models.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/provider/presentation/provider_assignment_gate.dart';
import 'package:handigo_app/features/provider/presentation/provider_assignment_sound.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';

class _Sound implements AssignmentAlertSound {
  int plays = 0, stops = 0;
  bool enabled = true;
  @override
  Future<bool> play() async {
    plays++;
    return enabled;
  }

  @override
  Future<void> stop() async {
    stops++;
  }

  @override
  void dispose() {}
}

class _Repository extends ProviderRepository {
  _Repository(super.api);
  List<ProviderAssignment> pending = [];
  int accepts = 0, rejects = 0;
  bool fail = false;
  Completer<void>? response;
  List<OrderSummary> recent = [];
  bool failAddress = false;
  @override
  Future<List<OrderSummary>> recentOrders() async {
    if (failAddress) throw const ApiException('Không tải được địa chỉ.');
    return recent;
  }

  @override
  Future<void> acceptAssignment(String id) async {
    accepts++;
    await _respond(id);
  }

  @override
  Future<void> rejectAssignment(String id, String reason) async {
    rejects++;
    await _respond(id);
  }

  Future<void> _respond(String id) async {
    if (fail) throw const ApiException('Đề nghị không còn khả dụng.');
    await response?.future;
    pending.removeWhere((item) => item.id == id);
  }
}

class _Harness {
  final api = ApiClient(Dio(), CookieJar());
  late final repository = _Repository(api);
  final events = StreamController<AssignmentRealtimeEvent>.broadcast();
  final sound = _Sound();
  DateTime now = DateTime(2030, 10, 21, 10);

  ProviderAssignment item(
    String id, {
    int seconds = 60,
    DateTime? scheduledAt,
  }) => ProviderAssignment(
    id: id,
    orderId: 'order-$id',
    orderCode: 'HD-$id',
    serviceName: 'Vệ sinh máy lạnh $id',
    addressLabel: '12 Nguyễn Văn Thoại, Hòa Hải, Đà Nẵng',
    scheduledAt: scheduledAt,
    orderType: scheduledAt == null ? 'immediate' : 'scheduled',
    totalAmount: 200000,
    serviceType: 'fixed_price',
    responseDeadline: now.add(Duration(seconds: seconds)),
  );
  Map<String, dynamic> payload(ProviderAssignment item) => {
    'assignmentId': item.id,
    'assignment': {
      '_id': item.id,
      'status': 'pending',
      'responseDeadline': item.responseDeadline!.toIso8601String(),
      'orderId': {
        '_id': item.orderId,
        'orderCode': item.orderCode,
        'serviceId': {
          'name': item.serviceName,
          'serviceType': item.serviceType,
        },
        'addressId': {
          'fullAddress': item.addressLabel,
          'ward': 'Hòa Hải',
          'province': 'Đà Nẵng',
        },
        'scheduledAt': item.scheduledAt?.toIso8601String(),
        'orderType': item.orderType,
        'pricing': {'totalPaidAmount': 200000},
      },
    },
  };

  Future<void> show(
    WidgetTester tester, {
    UserRole role = UserRole.provider,
    double scale = 1,
  }) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(api.close);
    addTearDown(events.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            (ref) => AuthController(AuthRepository(api), api)
              ..user = AppUser(
                id: 'provider',
                fullName: 'Đối tác kiểm thử',
                email: 'test@example.test',
                role: role,
                providerOnboardingStatus: 'APPROVED',
              )
              ..status = AuthStatus.authenticated,
          ),
          assignmentRealtimeEventsProvider.overrideWith((ref) => events.stream),
          assignmentAlertSoundProvider.overrideWithValue(sound),
          assignmentNowProvider.overrideWithValue(() => now),
          providerRepositoryProvider.overrideWithValue(repository),
          providerAssignmentsProvider.overrideWith(
            (ref) async => List.of(repository.pending),
          ),
        ],
        child: MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: ProviderAssignmentGate(child: child!),
          ),
          home: const Scaffold(body: Center(child: Text('Màn hình đang xem'))),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> incoming(
    WidgetTester tester,
    ProviderAssignment item, {
    String name = 'assignment:new',
  }) async {
    repository.pending.add(item);
    events.add((name: name, data: payload(item)));
    await tester.pumpAndSettle();
  }

  Future<void> clear(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
  }
}

void main() {
  test('Rút gọn địa chỉ bản đồ, bỏ mã bưu chính và quốc gia', () {
    expect(
      formatAssignmentAddress(
        '45, Đường Lê Hữu Trác, Phường An Hải, Thành phố Đà Nẵng, 02363, Việt Nam',
        fromMap: true,
      ),
      '45 Lê Hữu Trác, An Hải, Đà Nẵng',
    );
    expect(
      formatAssignmentAddress(
        '45 Đường Lê Hữu Trác, Phường An Hải, Thành phố Đà Nẵng',
        fromMap: true,
      ),
      '45 Lê Hữu Trác, An Hải, Đà Nẵng',
    );
  });

  test('Giữ chữ Đường nhập tay và số nhà dài', () {
    expect(
      formatAssignmentAddress(
        '45 Đường Lê Hữu Trác, Phường An Hải, Thành phố Đà Nẵng',
      ),
      '45 Đường Lê Hữu Trác, An Hải, Đà Nẵng',
    );
    expect(
      formatAssignmentAddress('12345, Đường số 2, Phường An Hải, Đà Nẵng'),
      '12345 Đường số 2, An Hải, Đà Nẵng',
    );
    expect(formatAssignmentAddress('12345'), '12345');
  });

  testWidgets('Bổ sung số nhà và tên đường từ đơn gần đây', (tester) async {
    final h = _Harness();
    h.repository.pending.add(
      ProviderAssignment(
        id: 'address',
        orderId: 'order-address',
        orderCode: 'HD-address',
        serviceName: 'Vệ sinh máy lạnh',
        addressLabel: 'Hòa Hải, Đà Nẵng',
        responseDeadline: h.now.add(const Duration(minutes: 1)),
      ),
    );
    h.repository.recent = [
      const OrderSummary(
        id: 'order-address',
        code: 'HD-address',
        serviceName: 'Vệ sinh máy lạnh',
        status: 'pending',
        addressLabel: '12 Nguyễn Văn Thoại, Hòa Hải, Đà Nẵng',
      ),
    ];
    await h.show(tester);
    expect(find.text('12 Nguyễn Văn Thoại, Hòa Hải, Đà Nẵng'), findsOneWidget);
    expect(find.text('Hòa Hải, Đà Nẵng'), findsNothing);
    await h.clear(tester);
  });

  testWidgets('Giữ địa chỉ ban đầu khi không tải được đơn gần đây', (
    tester,
  ) async {
    final h = _Harness();
    h.repository.failAddress = true;
    h.repository.pending.add(h.item('address'));
    await h.show(tester);
    expect(find.text(h.item('address').addressLabel!), findsOneWidget);
    expect(find.text('Đồng ý'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await h.clear(tester);
  });

  testWidgets(
    'Socket mở popup ở màn bất kỳ, có thông tin và âm báo, không lặp khi nhận trùng',
    (tester) async {
      final h = _Harness();
      await h.show(tester);
      final item = h.item('1');
      await h.incoming(tester, item);
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.text('Vệ sinh máy lạnh 1'), findsOneWidget);
      expect(find.text('Mã đơn: HD-1', findRichText: true), findsOneWidget);
      expect(find.textContaining('Giá trị đơn hàng: 200.000'), findsOneWidget);
      expect(find.text('Còn 01:00'), findsOneWidget);
      expect(find.text('Bạn có đơn hàng mới'), findsOneWidget);
      expect(find.text('Thời gian thực hiện: Bây giờ'), findsOneWidget);
      expect(find.text('Đồng ý'), findsOneWidget);
      expect(find.text(item.addressLabel!), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(FilledButton),
          matching: find.textContaining('200.000'),
        ),
        findsOneWidget,
      );
      expect(h.sound.plays, 1);
      h.events.add((name: 'assignment:new', data: h.payload(item)));
      await tester.pumpAndSettle();
      expect(h.sound.plays, 1);
      await h.clear(tester);
    },
  );

  testWidgets('Đơn hẹn lịch hiện đủ giờ và ngày thực hiện', (tester) async {
    final h = _Harness();
    await h.show(tester);
    await h.incoming(
      tester,
      h.item('scheduled', scheduledAt: DateTime(2030, 10, 22, 14, 30)),
    );
    expect(find.text('Thời gian thực hiện: 14:30 22/10/2030'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await h.clear(tester);
  });

  testWidgets('Yêu cầu khách chọn trực tiếp và từ chối đóng popup', (
    tester,
  ) async {
    final h = _Harness();
    await h.show(tester);
    await h.incoming(tester, h.item('direct'), name: 'direct-request:new');
    await tester.tap(find.text('Từ chối'));
    await tester.pumpAndSettle();
    expect(h.repository.rejects, 1);
    expect(find.byType(AlertDialog), findsNothing);
    await h.clear(tester);
  });

  testWidgets('Giữ đơn đang xem khi nhiều đơn tới, nhận đơn không gửi trùng', (
    tester,
  ) async {
    final h = _Harness();
    await h.show(tester);
    await h.incoming(tester, h.item('1'));
    await h.incoming(tester, h.item('2'));
    expect(find.text('Mã đơn: HD-1', findRichText: true), findsOneWidget);
    h.repository.response = Completer<void>();
    await tester.tap(find.text('Đồng ý'));
    await tester.pump();
    expect(h.repository.accepts, 1);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    h.repository.response!.complete();
    await tester.pumpAndSettle();
    expect(find.text('Mã đơn: HD-2', findRichText: true), findsOneWidget);
    expect(h.sound.plays, 2);
    await h.clear(tester);
  });

  testWidgets('Đếm ngược theo hạn server và tự đóng khi hết hạn', (
    tester,
  ) async {
    final h = _Harness();
    await h.show(tester);
    await h.incoming(tester, h.item('short', seconds: 2));
    h.now = h.now.add(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Còn 00:01'), findsOneWidget);
    h.now = h.now.add(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(h.repository.accepts, 0);
    await h.clear(tester);
  });

  testWidgets('Đóng bằng socket không mở lại bởi dữ liệu API cũ', (
    tester,
  ) async {
    final h = _Harness();
    await h.show(tester);
    await h.incoming(tester, h.item('1'));
    h.events.add((name: 'assignment:closed', data: {'assignmentId': '1'}));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(h.sound.stops, greaterThan(0));
    await h.clear(tester);
  });

  testWidgets('Khôi phục đơn chờ sau khi mở app và hiển thị lỗi phản hồi', (
    tester,
  ) async {
    final h = _Harness();
    h.repository.pending.add(h.item('restored'));
    h.repository.fail = true;
    await h.show(tester);
    expect(
      find.text('Mã đơn: HD-restored', findRichText: true),
      findsOneWidget,
    );
    await tester.tap(find.text('Đồng ý'));
    await tester.pumpAndSettle();
    expect(find.text('Đề nghị không còn khả dụng.'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNotNull,
    );
    await h.clear(tester);
  });

  testWidgets('Khách hàng không nhận popup provider', (tester) async {
    final h = _Harness();
    h.repository.pending.add(h.item('1'));
    await h.show(tester, role: UserRole.customer);
    expect(find.byType(AlertDialog), findsNothing);
    expect(h.sound.plays, 0);
    await h.clear(tester);
  });

  testWidgets(
    'Popup gọn trên màn nhỏ, chữ lớn; có bật âm khi trình duyệt chặn',
    (tester) async {
      final h = _Harness();
      h.sound.enabled = false;
      await h.show(tester, scale: 2);
      await h.incoming(tester, h.item('1'));
      expect(find.text('Bật âm báo'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await h.clear(tester);
    },
  );
}
