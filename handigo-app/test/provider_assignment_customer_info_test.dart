import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/provider/domain/provider_models.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/provider/data/provider_location_service.dart';
import 'package:handigo_app/features/provider/presentation/provider_assignment_customer_info.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';

class _Tracker extends ProviderLocationService {
  _Tracker(super.api);
  Position? position;
  bool failGps = false;
  int reads = 0;
  @override
  Future<void> synchronize({
    required bool Function() shouldUpload,
    bool useCachedPosition = false,
  }) async {
    reads++;
    await Future<void>.delayed(Duration.zero);
    if (failGps) throw const ApiException('Hãy bật GPS để xem khoảng cách.');
    if (shouldUpload()) move(10);
  }

  @override
  Position? get synchronizedPosition => position;
  void move(double latitude) {
    position = Position(
      latitude: latitude,
      longitude: 106,
      timestamp: DateTime.now(),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
    notifyListeners();
  }
}

AuthController _auth(ApiClient api) => AuthController(AuthRepository(api), api)
  ..user = const AppUser(
    id: 'provider',
    fullName: 'Thợ kiểm thử',
    email: 'tho@example.test',
    role: UserRole.provider,
    providerOnboardingStatus: 'APPROVED',
  )
  ..status = AuthStatus.authenticated;

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  int calls = 0;
  bool fail = false;
  String precision = 'place';
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expect(path, '/locations/geocode');
    expect(method, 'POST');
    expect(authenticated, isTrue);
    expect(data, {
      'fullAddress': '12 Nguyễn Văn Thoại',
      'ward': 'Hòa Hải',
      'province': 'Đà Nẵng',
    });
    calls++;
    if (fail) throw const ApiException('Không thể tra tọa độ.');
    return {
      'data': {'latitude': 10.01, 'longitude': 106, 'precision': precision},
    };
  }
}

OrderSummary _order() => OrderSummary.fromJson({
  '_id': 'order',
  'orderCode': 'HD-001',
  'status': 'pending',
  'serviceId': {'name': 'Sửa điện', 'serviceType': 'variable_price'},
  'customerId': {'fullName': 'Nguyễn An'},
  'addressId': {
    'fullAddress': 'Địa chỉ đã thay đổi',
    'latitude': 11,
    'longitude': 107,
  },
  'addressSnapshot': {
    'fullAddress': 'Địa chỉ lúc đặt',
    'latitude': 10.01,
    'longitude': 106,
  },
});

void main() {
  testWidgets(
    'Tự lấy GPS trước nhận đơn và cho thử lại khi GPS ban đầu bị tắt',
    (tester) async {
      final api = _Api();
      addTearDown(api.close);
      final tracker = _Tracker(api)..failGps = true;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith((ref) => _auth(api)),
            providerLocationServiceProvider.overrideWith((ref) => tracker),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: ProviderAssignmentCustomerInfo(
                orderId: 'order',
                order: _order(),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Hãy bật GPS để xem khoảng cách.'), findsOneWidget);
      tracker.failGps = false;
      await tester.tap(find.text('Thử lại khoảng cách'));
      await tester.pumpAndSettle();
      expect(find.text('Cách bạn khoảng 1,1 km'), findsOneWidget);
      expect(tracker.reads, 2);
      expect(api.calls, 0);
      expect(tester.takeException(), isNull);
    },
  );
  test('Đọc tên khách và tọa độ tại thời điểm đặt từ API danh sách đơn', () {
    final order = _order();
    expect(order.customerName, 'Nguyễn An');
    expect(order.serviceType, 'variable_price');
    expect((order.addressLatitude, order.addressLongitude), (10.01, 106));
  });

  testWidgets(
    'Tên khách, khoảng cách đường thẳng và cập nhật khi thợ di chuyển',
    (tester) async {
      final api = ApiClient(Dio(), CookieJar());
      addTearDown(api.close);
      final tracker = _Tracker(api)..move(10);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith((ref) => _auth(api)),
            providerLocationServiceProvider.overrideWith((ref) => tracker),
            providerAssignmentOrdersProvider.overrideWith(
              (ref) async => [_order()],
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: ProviderAssignmentCustomerInfo(orderId: 'order'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Khách hàng: Nguyễn An'), findsOneWidget);
      expect(find.text('Cách bạn khoảng 1,1 km'), findsOneWidget);
      tracker.move(10.005);
      await tester.pumpAndSettle();
      expect(
        find.textContaining(RegExp(r'Cách bạn khoảng 55[0-9] m')),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Thiếu tên hoặc vị trí không hiển thị khoảng cách giả', (
    tester,
  ) async {
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) => _auth(api)),
          providerAssignmentPositionProvider.overrideWith(
            (ref) async =>
                throw const ApiException('Bật GPS để xem khoảng cách.'),
          ),
          providerLocationServiceProvider.overrideWith((ref) => _Tracker(api)),
          providerAssignmentOrdersProvider.overrideWith((ref) async => []),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: ProviderAssignmentCustomerInfo(orderId: 'missing'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Khách hàng: Chưa có tên khách hàng'), findsOneWidget);
    expect(find.text('Bật GPS để xem khoảng cách.'), findsOneWidget);
    expect(find.text('Thử lại khoảng cách'), findsOneWidget);
    expect(find.textContaining('0 m'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  for (final orderType in ['immediate', 'scheduled']) {
    testWidgets(
      'Đơn $orderType ngoài 20 đơn gần nhất vẫn tính khoảng cách trước nhận và thử lại được',
      (tester) async {
        final api = _Api()..fail = true;
        addTearDown(api.close);
        final tracker = _Tracker(api)..move(10);
        final assignment = ProviderAssignment.fromJson({
          'id': 'assignment',
          'orderId': {
            'id': 'outside-recent',
            'orderCode': 'HD-NEW',
            'orderType': orderType,
            'serviceId': {'name': 'Sửa điện', 'serviceType': 'variable_price'},
            'addressId': {
              'fullAddress': '12 Nguyễn Văn Thoại',
              'ward': 'Hòa Hải',
              'province': 'Đà Nẵng',
            },
          },
        });
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authControllerProvider.overrideWith((ref) => _auth(api)),
              apiClientProvider.overrideWithValue(api),
              providerLocationServiceProvider.overrideWith((ref) => tracker),
              providerAssignmentOrdersProvider.overrideWith((ref) async => []),
            ],
            child: MaterialApp(
              home: Scaffold(
                body: ProviderAssignmentCustomerInfo(
                  orderId: assignment.orderId,
                  assignment: assignment,
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Không thể tra tọa độ.'), findsOneWidget);
        api.fail = false;
        await tester.tap(find.text('Thử lại khoảng cách'));
        await tester.pumpAndSettle();
        expect(find.text('Cách bạn khoảng 1,1 km'), findsOneWidget);
        expect(api.calls, 2);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Chỉ có tọa độ khu vực phải ghi rõ khoảng cách ước tính', (
    tester,
  ) async {
    final api = _Api()..precision = 'ward';
    addTearDown(api.close);
    final tracker = _Tracker(api)..move(10);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith((ref) => _auth(api)),
          apiClientProvider.overrideWithValue(api),
          providerLocationServiceProvider.overrideWith((ref) => tracker),
          providerAssignmentOrdersProvider.overrideWith((ref) async => []),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: ProviderAssignmentCustomerInfo(
              orderId: 'outside-recent',
              assignment: ProviderAssignment(
                id: 'a',
                orderId: 'outside-recent',
                orderCode: 'HD-NEW',
                serviceName: 'Sửa điện',
                fullAddress: '12 Nguyễn Văn Thoại',
                ward: 'Hòa Hải',
                province: 'Đà Nẵng',
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Đến khu vực khách khoảng 1,1 km (ước tính theo địa chỉ)'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });
}
