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
import 'package:handigo_app/shared/widgets/map_surface.dart';

class _Location extends GeolocatorPlatform {
  LocationPermission permission = LocationPermission.whileInUse;
  Completer<Position>? pending;
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
    if (pending != null) return pending!.future;
    return position();
  }

  Position position() => Position(
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

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  int requests = 0;
  ApiException? rejection;
  Completer<void>? pending;
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
    expect(authenticated, isTrue);
    requests++;
    final hold = pending;
    if (hold != null) await hold.future;
    if (rejection != null) throw rejection!;
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

  Future<void> open(WidgetTester tester, _Api api, {bool ready = true}) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          mapReadyProvider.overrideWith((ref) async => ready),
          mapViewBuilderProvider.overrideWithValue(
            (map) => const SizedBox.expand(key: ValueKey('map-view')),
          ),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async {
                  result = await showModalBottomSheet<Map<String, String>>(
                    context: context,
                    isScrollControlled: true,
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

  FlutterMap map(WidgetTester tester) =>
      tester.widget<MapSurface>(find.byType(MapSurface)).map;

  testWidgets('Không ghim sẵn; GPS chỉ tải trước địa chỉ', (tester) async {
    final api = _Api();
    await open(tester, api);
    expect(find.byType(TextField), findsNothing);
    expect(find.byIcon(Icons.location_pin), findsNothing);
    expect(find.text('Chưa chọn vị trí'), findsOneWidget);
    expect(location.reads, 1);
    expect(api.requests, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Chọn GPS lưu đúng tọa độ và dùng địa chỉ tải sẵn', (
    tester,
  ) async {
    final api = _Api();
    await open(tester, api);
    await tester.tap(find.text('Lấy vị trí hiện tại'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.location_pin), findsOneWidget);
    expect(find.text('45 Lê Hữu Trác, An Hải, Đà Nẵng'), findsOneWidget);
    expect(api.requests, 1);
    expect(location.reads, 1);
    await tester.tap(find.text('Chọn vị trí này'));
    await tester.pumpAndSettle();
    expect(result?['latitude'], '16.05');
    expect(result?['longitude'], '108.2');
  });

  testWidgets(
    'Kéo bản đồ chọn đúng tâm khi dừng, khóa xác nhận trong lúc di chuyển',
    (tester) async {
      await open(tester, _Api());
      final configuration = map(tester);
      configuration.options.onPositionChanged!(
        MapCamera(
          crs: const Epsg3857(),
          center: const LatLng(16.06, 108.21),
          zoom: 18,
          rotation: 0,
          nonRotatedSize: const Size(400, 400),
        ),
        true,
      );
      await tester.pump();
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Chọn vị trí này'),
            )
            .onPressed,
        isNull,
      );
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chọn vị trí này'));
      await tester.pumpAndSettle();
      expect(result?['latitude'], '16.06');
      expect(result?['longitude'], '108.21');
    },
  );

  testWidgets('Phản hồi địa chỉ cũ không ghi đè ghim mới', (tester) async {
    final api = _Api();
    await open(tester, api);
    final first = api.pending = Completer<void>();
    map(tester).options.onTap!(
      const TapPosition(Offset.zero, Offset.zero),
      const LatLng(16.1, 108.1),
    );
    await tester.pump();
    api.pending = null;
    map(tester).options.onTap!(
      const TapPosition(Offset.zero, Offset.zero),
      const LatLng(16.2, 108.2),
    );
    await tester.pumpAndSettle();
    first.complete();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn vị trí này'));
    await tester.pumpAndSettle();
    expect(result?['latitude'], '16.2');
  });

  testWidgets('GPS đến muộn không ghi đè điểm người dùng đã chạm', (
    tester,
  ) async {
    final gps = location.pending = Completer<Position>();
    await open(tester, _Api());
    map(tester).options.onTap!(
      const TapPosition(Offset.zero, Offset.zero),
      const LatLng(16.2, 108.25),
    );
    await tester.pumpAndSettle();
    gps.complete(location.position());
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn vị trí này'));
    await tester.pumpAndSettle();
    expect(result?['longitude'], '108.25');
  });

  testWidgets('Tra địa chỉ lỗi giữ ghim và cho thử lại', (tester) async {
    final api = _Api();
    await open(tester, api);
    api.rejection = const ApiException('Không tra được địa chỉ');
    map(tester).options.onTap!(
      const TapPosition(Offset.zero, Offset.zero),
      const LatLng(16.3, 108.3),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Không tra được địa chỉ'), findsOneWidget);
    expect(find.byIcon(Icons.location_pin), findsOneWidget);
    api.rejection = null;
    await tester.tap(find.text('Chọn vị trí này'));
    await tester.pumpAndSettle();
    expect(result?['latitude'], '16.3');
  });

  testWidgets('Quyền GPS bị chặn vẫn chọn điểm trên bản đồ được', (
    tester,
  ) async {
    location.permission = LocationPermission.deniedForever;
    await open(tester, _Api());
    expect(
      find.textContaining('cài đặt ứng dụng hoặc trình duyệt'),
      findsOneWidget,
    );
    map(tester).options.onTap!(
      const TapPosition(Offset.zero, Offset.zero),
      const LatLng(16.3, 108.3),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chọn vị trí này'));
    await tester.pumpAndSettle();
    expect(result, isNotNull);
  });

  testWidgets(
    'Thiếu cấu hình bản đồ không lấy GPS hoặc cho xác nhận điểm chưa thấy',
    (tester) async {
      await open(tester, _Api(), ready: false);
      expect(find.textContaining('Bản đồ chưa sẵn sàng'), findsOneWidget);
      expect(location.reads, 0);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Chọn vị trí này'),
            )
            .onPressed,
        isNull,
      );
    },
  );

  testWidgets('Màn hình 320 px giữ đủ hai nút chọn vị trí', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 700);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await open(tester, _Api());
    expect(find.byType(TextField), findsNothing);
    expect(
      tester
          .getRect(find.widgetWithText(FilledButton, 'Chọn vị trí này'))
          .right,
      lessThanOrEqualTo(320),
    );
    expect(tester.takeException(), isNull);
  });
}
