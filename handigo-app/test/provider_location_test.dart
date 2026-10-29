import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/provider/data/provider_location_service.dart';

class _Location extends GeolocatorPlatform {
  bool enabled = true;
  LocationPermission permission = LocationPermission.whileInUse;
  LocationPermission requestedPermission = LocationPermission.whileInUse;
  int requests = 0;
  int reads = 0, subscriptions = 0;
  double latitude = 10.8, accuracy = 5;
  DateTime Function() now = DateTime.now;
  Completer<Position>? pendingPosition;
  final positions = StreamController<Position>.broadcast();
  LocationSettings? streamSettings;
  @override
  Stream<Position> getPositionStream({LocationSettings? locationSettings}) {
    subscriptions++;
    streamSettings = locationSettings;
    return positions.stream;
  }

  @override
  Future<bool> isLocationServiceEnabled() async => enabled;
  @override
  Future<LocationPermission> checkPermission() async => permission;
  @override
  Future<LocationPermission> requestPermission() async {
    requests++;
    return requestedPermission;
  }

  @override
  Future<Position> getCurrentPosition({
    LocationSettings? locationSettings,
  }) async {
    reads++;
    return pendingPosition == null ? sample() : await pendingPosition!.future;
  }

  Position sample({double? lat, double? precision, DateTime? timestamp}) =>
      Position(
        longitude: 106.7,
        latitude: lat ?? latitude,
        timestamp: timestamp ?? now(),
        accuracy: precision ?? accuracy,
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
  Map<String, dynamic>? payload;
  final uploads = <Map<String, dynamic>>[];
  bool fail = false;
  Completer<void>? response;
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expectSync(path, '/locations/me');
    expectSync(method, 'PUT');
    expectSync(authenticated, isTrue);
    if (fail) throw const ApiException('Lỗi kết nối thử nghiệm');
    await response?.future;
    payload = data;
    uploads.add(Map.of(data!));
    return {'data': {}};
  }
}

void main() {
  late _Location location;
  late _Api api;
  late ProviderLocationService service;
  setUp(() {
    final previous = GeolocatorPlatform.instance;
    location = _Location();
    GeolocatorPlatform.instance = location;
    addTearDown(() => GeolocatorPlatform.instance = previous);
    addTearDown(location.positions.close);
    api = _Api();
    addTearDown(api.close);
    service = ProviderLocationService(api);
    addTearDown(() => service.dispose());
  });

  test('Lấy GPS và gửi tọa độ đúng API có xác thực', () async {
    await service.synchronize(shouldUpload: () => true);
    expect(api.payload, {'latitude': 10.8, 'longitude': 106.7});
  });
  test(
    'Tải lại thủ công nhận vị trí có sai số lớn hơn ngưỡng theo dõi di chuyển',
    () async {
      location.accuracy = 100;
      await service.synchronize(shouldUpload: () => true);
      expect(api.payload, {'latitude': 10.8, 'longitude': 106.7});
    },
  );

  test('Tải lại thủ công lưu mẫu mới dù di chuyển dưới 25m', () async {
    await service.synchronize(shouldUpload: () => true);
    location.latitude = 10.80005;
    await service.synchronize(shouldUpload: () => true);
    expect(api.payload!['latitude'], 10.80005);
  });

  testWidgets('Tải lại thủ công chờ lượt tự động rồi đo một mẫu mới', (
    tester,
  ) async {
    final pending = Completer<Position>();
    location.pendingPosition = pending;
    service.start(shouldUpload: () => true);
    await tester.pump();
    final reload = service.synchronize(shouldUpload: () => true);
    location.pendingPosition = null;
    location.latitude = 10.9;
    pending.complete(location.sample(lat: 10.8));
    await tester.pump();
    await reload;
    expect(location.reads, 2);
    expect(api.payload!['latitude'], 10.9);
    service.stop();
  });

  testWidgets('Mẫu GPS chính xác thay thế mốc tải lại có sai số lớn', (
    tester,
  ) async {
    var now = DateTime.now();
    location.now = () => now;
    service.dispose();
    service = ProviderLocationService(api, now: () => now);
    location.accuracy = 100;
    await service.synchronize(shouldUpload: () => true);
    service.start(shouldUpload: () => true);
    await tester.pump();
    now = now.add(const Duration(seconds: 5));
    location.positions.add(location.sample(lat: 10.80005, precision: 5));
    await tester.pump();
    expect(api.uploads.length, 2);
    expect(api.payload!['latitude'], 10.80005);
    now = now.add(const Duration(seconds: 5));
    location.positions.add(location.sample(lat: 10.9, precision: 100));
    await tester.pump();
    expect(api.uploads.length, 2);
    service.stop();
  });
  test('Xin quyền khi chưa cấp rồi lưu vị trí', () async {
    location.permission = LocationPermission.denied;
    await service.synchronize(shouldUpload: () => true);
    expect(location.requests, 1);
    expect(api.payload, isNotNull);
  });
  test('GPS tắt không gửi vị trí và báo lỗi rõ ràng', () async {
    location.enabled = false;
    await expectLater(
      service.synchronize(shouldUpload: () => true),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'thông báo',
          contains('bật vị trí'),
        ),
      ),
    );
    expect(api.payload, isNull);
  });
  for (final permission in [
    LocationPermission.denied,
    LocationPermission.deniedForever,
  ]) {
    test('Quyền $permission không gửi tọa độ', () async {
      location.permission = permission;
      location.requestedPermission = permission;
      await expectLater(
        service.synchronize(shouldUpload: () => true),
        throwsA(isA<ApiException>()),
      );
      expect(api.payload, isNull);
    });
  }
  test('Không gửi GPS nếu đã rời phiên tài khoản', () async {
    await service.synchronize(shouldUpload: () => false);
    expect(api.payload, isNull);
  });
  test('Phân biệt lấy GPS thành công với lưu máy chủ thất bại', () async {
    api.fail = true;
    await expectLater(
      service.synchronize(shouldUpload: () => true),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'thông báo',
          contains('chưa lưu được'),
        ),
      ),
    );
  });

  testWidgets('Chỉ đổi tọa độ khi đi đủ 25m tính từ lần gửi thành công', (
    tester,
  ) async {
    var now = DateTime.now();
    location.now = () => now;
    service.dispose();
    service = ProviderLocationService(api, now: () => now);
    service.start(shouldUpload: () => true);
    await tester.pump();
    expect(location.streamSettings!.distanceFilter, 25);
    expect(service.error, isNull, reason: service.error?.message);
    expect(api.uploads.length, 1);
    for (final offset in [0.00005, 0.0001, 0.00015, 0.0002]) {
      now = now.add(const Duration(seconds: 5));
      location.positions.add(location.sample(lat: 10.8 + offset));
      await tester.pump();
    }
    expect(api.uploads.length, 1);
    now = now.add(const Duration(seconds: 5));
    location.positions.add(location.sample(lat: 10.80025));
    await tester.pump();
    expect(api.uploads.length, 2);
    expect(api.payload!['latitude'], 10.80025);
    expect(location.subscriptions, 1);
    service.stop();
  });

  testWidgets(
    'Đứng yên 30 giây đo lại và gửi tín hiệu hoạt động, giữ mốc tọa độ',
    (tester) async {
      var now = DateTime.now();
      location.now = () => now;
      service.dispose();
      service = ProviderLocationService(api, now: () => now);
      service.start(shouldUpload: () => true);
      await tester.pump();
      expect(location.reads, 1);
      now = now.add(const Duration(seconds: 29));
      await tester.pump(const Duration(seconds: 29));
      expect(location.reads, 1);
      now = now.add(const Duration(seconds: 1));
      location.latitude = 10.8001;
      await tester.pump(const Duration(seconds: 1));
      expect(location.reads, 2);
      expect(api.uploads.length, 2);
      expect(api.payload!['latitude'], 10.8);
      service.stop();
    },
  );

  testWidgets('Không gửi mẫu sai số lớn hoặc đã cũ; phục hồi khi GPS tốt', (
    tester,
  ) async {
    service.start(shouldUpload: () => true);
    await tester.pump();
    location.positions.add(location.sample(lat: 10.81, precision: 100));
    await tester.pump();
    expect(api.uploads.length, 1);
    expect(service.error, isNotNull);
    location.positions.add(
      location.sample(
        lat: 10.81,
        timestamp: DateTime.now().subtract(const Duration(minutes: 2)),
      ),
    );
    await tester.pump();
    expect(api.uploads.length, 1);
    location.positions.add(location.sample());
    await tester.pump();
    expect(service.error, isNull);
    service.stop();
  });

  testWidgets('Không lấy GPS chồng nhau và không gửi sau khi tắt nhận việc', (
    tester,
  ) async {
    location.pendingPosition = Completer<Position>();
    service.start(shouldUpload: () => true);
    await tester.pump();
    final refresh = service.check(force: true);
    await tester.pump();
    expect(location.reads, 1);
    service.stop();
    location.pendingPosition!.complete(location.sample());
    await tester.pump();
    await refresh;
    expect(api.uploads, isEmpty);
    expect(location.positions.hasListener, isFalse);
    await tester.pump(const Duration(seconds: 60));
    expect(location.reads, 1);
  });

  testWidgets('Lưu thất bại không đổi mốc; mẫu sau vẫn thử gửi lại', (
    tester,
  ) async {
    var now = DateTime.now();
    location.now = () => now;
    service.dispose();
    service = ProviderLocationService(api, now: () => now);
    service.start(shouldUpload: () => true);
    await tester.pump();
    now = now.add(const Duration(seconds: 5));
    api.fail = true;
    location.positions.add(location.sample(lat: 10.8003));
    await tester.pump();
    expect(api.uploads.length, 1);
    expect(service.error, isNotNull);
    api.fail = false;
    location.positions.add(location.sample(lat: 10.8003));
    await tester.pump();
    expect(api.uploads.length, 2);
    expect(service.error, isNull);
    service.stop();
  });

  testWidgets(
    'Bật lại khi lượt đo cũ chưa xong vẫn đo mới và không gửi mẫu cũ',
    (tester) async {
      final pending = Completer<Position>();
      location.pendingPosition = pending;
      service.start(shouldUpload: () => true);
      await tester.pump();
      expect(location.reads, 1);
      service.stop();
      service.start(shouldUpload: () => true);
      await tester.pump();
      expect(location.reads, 1);
      location.pendingPosition = null;
      pending.complete(location.sample(lat: 10.9));
      await tester.pump();
      expect(location.reads, 2);
      expect(api.uploads.length, 1);
      expect(api.payload!['latitude'], 10.8);
      service.stop();
    },
  );

  testWidgets('Mất luồng GPS tự kết nối lại sau 30 giây', (tester) async {
    var now = DateTime.now();
    location.now = () => now;
    service.dispose();
    service = ProviderLocationService(api, now: () => now);
    service.start(shouldUpload: () => true);
    await tester.pump();
    location.positions.addError(StateError('Mất tín hiệu thử nghiệm'));
    await tester.pump();
    expect(service.error, isNotNull);
    now = now.add(const Duration(seconds: 30));
    await tester.pump(const Duration(seconds: 30));
    expect(location.subscriptions, 2);
    expect(location.reads, 2);
    expect(service.error, isNull);
    service.stop();
  });
}
