import 'dart:async';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/service_catalog/presentation/add_booking_address_sheet.dart';

class _Location extends GeolocatorPlatform {
  LocationPermission permission = LocationPermission.whileInUse;
  int reads = 0;
  @override
  Future<bool> isLocationServiceEnabled() async => true;
  @override
  Future<LocationPermission> checkPermission() async => permission;
  @override
  Future<Position> getCurrentPosition({
    LocationSettings? locationSettings,
  }) async {
    reads++;
    return Position(
      latitude: 16.05,
      longitude: 108.2,
      timestamp: DateTime.now(),
      accuracy: 100,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
  }
}

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  bool fail = false;
  int requests = 0;
  ApiException? rejection;
  Completer<void>? pending;
  Map<String, dynamic>? lastQuery;
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expect(path, '/locations/reverse-geocode');
    requests++;
    lastQuery = query;
    if (pending != null) await pending!.future;
    if (rejection != null) throw rejection!;
    if (fail) throw const ApiException('Không tra được địa chỉ');
    return {
      'data': {
        'fullAddress': '45 Lê Hữu Trác',
        'ward': 'An Hải',
        'province': 'Đà Nẵng',
      },
    };
  }
}

void main() {
  late _Location location;
  late GeolocatorPlatform original;
  Map<String, String>? result;
  setUp(() {
    original = GeolocatorPlatform.instance;
    location = _Location();
    GeolocatorPlatform.instance = location;
    result = null;
  });
  tearDown(() => GeolocatorPlatform.instance = original);

  Future<void> open(WidgetTester tester, _Api api) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [apiClientProvider.overrideWithValue(api)],
        child: MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async {
                  result = await showModalBottomSheet<Map<String, String>>(
                    context: context,
                    isScrollControlled: true,
                    showDragHandle: false,
                    builder: (_) => const AddBookingAddressSheet(),
                  );
                },
                child: const Text('Mở'),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Mở'));
    await tester.pumpAndSettle();
  }

  testWidgets('Mở ngay bản đồ và vừa khung bán kính 500 m quanh GPS', (
    tester,
  ) async {
    await open(tester, _Api());
    expect(find.byType(TextField), findsNothing);
    expect(find.byIcon(Icons.add_location_alt_rounded), findsOneWidget);
    expect(find.byType(FlutterMap), findsOneWidget);
    final map = tester
        .widget<FlutterMap>(find.byType(FlutterMap))
        .mapController!;
    final camera = map.camera;
    const center = LatLng(16.05, 108.2);
    const distance = Distance();
    for (final bearing in [0, 90, 180, 270]) {
      expect(
        camera.visibleBounds.contains(
          distance.offset(center, 500, bearing.toDouble()),
        ),
        isTrue,
      );
    }
    expect(distance(camera.center, center), lessThan(2));
    final left = tester.getRect(find.text('Lấy vị trí hiện tại'));
    final right = tester.getRect(find.text('Chọn vị trí này'));
    expect(left.center.dy, closeTo(right.center.dy, 1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Hai nút không tràn trên màn hình 320 px', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 700);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await open(tester, _Api());
    final left = tester.getRect(
      find.widgetWithText(OutlinedButton, 'Lấy vị trí hiện tại'),
    );
    final right = tester.getRect(
      find.widgetWithText(FilledButton, 'Chọn vị trí này'),
    );
    expect(left.width, closeTo(right.width, 1));
    expect(left.center.dy, closeTo(right.center.dy, 1));
    expect(left.left, greaterThanOrEqualTo(0));
    expect(right.right, lessThanOrEqualTo(320));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Không ghim sẵn, chọn GPS và lưu lại địa chỉ đã tra', (
    tester,
  ) async {
    final api = _Api();
    await open(tester, api);
    expect(find.byIcon(Icons.location_pin), findsNothing);
    expect(find.byType(CircleLayer), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(find.text('Chưa chọn vị trí'), findsOneWidget);
    await tester.tap(find.text('Lấy vị trí hiện tại'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.location_pin), findsOneWidget);
    expect(find.text('45 Lê Hữu Trác, An Hải, Đà Nẵng'), findsOneWidget);
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('selected-address')))
          .style
          ?.color,
      Colors.black,
    );
    expect(location.reads, 1);
    await tester.tap(find.text('Chọn vị trí này'));
    await tester.pumpAndSettle();
    expect(result?['latitude'], '16.05');
    expect(result?['longitude'], '108.2');
    expect(tester.takeException(), isNull);
  });

  testWidgets('Tra địa chỉ lỗi giữ ghim và cho thử lại', (tester) async {
    final api = _Api()..fail = true;
    await open(tester, api);
    await tester.tap(find.text('Lấy vị trí hiện tại'));
    await tester.pumpAndSettle();
    expect(find.text('Không tra được địa chỉ'), findsOneWidget);
    api.fail = false;
    await tester.tap(find.text('Chọn vị trí này'));
    await tester.pumpAndSettle();
    expect(result?['latitude'], '16.05');
    expect(tester.takeException(), isNull);
  });

  testWidgets('Hiện nguyên nhân geo với mã HTTP và mã lỗi riêng', (
    tester,
  ) async {
    final api = _Api()
      ..rejection = const ApiException(
        'Dịch vụ xác định địa chỉ chưa được cấu hình.',
        statusCode: 503,
        code: 'GEO_NOT_CONFIGURED',
      );
    await open(tester, api);
    await tester.tap(find.text('Lấy vị trí hiện tại'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('HTTP 503 · GEO_NOT_CONFIGURED'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.location_pin), findsOneWidget);
    expect(result, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Quyền bị chặn cho phép lấy lại GPS', (tester) async {
    location.permission = LocationPermission.deniedForever;
    await open(tester, _Api());
    expect(
      find.textContaining('cài đặt ứng dụng hoặc trình duyệt'),
      findsOneWidget,
    );
    location.permission = LocationPermission.whileInUse;
    await tester.tap(find.text('Lấy vị trí hiện tại'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.location_pin), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Chạm mới ghim và tự căn giữa; GPS dùng lại cache', (
    tester,
  ) async {
    await open(tester, _Api());
    await tester.drag(find.byType(FlutterMap), const Offset(80, 0));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.location_pin), findsNothing);
    final rect = tester.getRect(find.byType(FlutterMap));
    await tester.tapAt(rect.center + const Offset(60, 45));
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pumpAndSettle();
    final map = tester
        .widget<FlutterMap>(find.byType(FlutterMap))
        .mapController!;
    final marker = tester
        .widget<MarkerLayer>(find.byType(MarkerLayer))
        .markers
        .single;
    expect(const Distance()(marker.point, map.camera.center), lessThan(1));
    expect(location.reads, 1);
    await tester.tap(find.text('Lấy vị trí hiện tại'));
    await tester.pumpAndSettle();
    expect(
      const Distance()(map.camera.center, const LatLng(16.05, 108.2)),
      lessThan(2),
    );
    expect(location.reads, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Chọn GPS dùng địa chỉ tải sẵn, không gọi lại và không loading', (
    tester,
  ) async {
    final api = _Api();
    await open(tester, api);
    expect(api.requests, 1);
    await tester.tap(find.text('Lấy vị trí hiện tại'));
    await tester.pump();
    expect(find.text('45 Lê Hữu Trác, An Hải, Đà Nẵng'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(api.requests, 1);
    expect(location.reads, 1);
    await tester.pumpAndSettle();
  });

  testWidgets(
    'Chọn GPS khi địa chỉ đang tải vẫn ghim ngay và không gọi trùng',
    (tester) async {
      final api = _Api()..pending = Completer<void>();
      await open(tester, api);
      expect(api.requests, 1);
      await tester.tap(find.text('Lấy vị trí hiện tại'));
      await tester.pump();
      expect(find.byIcon(Icons.location_pin), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(api.requests, 1);
      expect(location.reads, 1);
      api.pending!.complete();
      await tester.pumpAndSettle();
      expect(find.text('45 Lê Hữu Trác, An Hải, Đà Nẵng'), findsOneWidget);
    },
  );

  testWidgets('Loading vòng tròn ở giữa khi chọn điểm mới trên bản đồ', (
    tester,
  ) async {
    final api = _Api();
    await open(tester, api);
    api.pending = Completer<void>();
    await tester.tapAt(
      tester.getCenter(find.byType(FlutterMap)) + const Offset(60, 40),
    );
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    final spinner = find.byType(CircularProgressIndicator);
    expect(spinner, findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(
      tester.getCenter(spinner),
      tester.getCenter(find.byType(FlutterMap)),
    );
    api.pending!.complete();
    await tester.pumpAndSettle();
    expect(spinner, findsNothing);
    expect(tester.takeException(), isNull);
  });
}
