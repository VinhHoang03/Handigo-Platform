import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/features/provider/data/provider_repository.dart';

class _LocationApi extends ApiClient {
  _LocationApi() : super(Dio(), CookieJar());
  Object? coordinates = [106.7, 10.8];
  final paths = <String>[];

  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    paths.add(path);
    expect(authenticated, isTrue);
    if (path == '/locations/me') {
      expect(method, 'GET');
      return {
        'data': {
          'coordinates': {'coordinates': coordinates},
        },
      };
    }
    expect(path, '/locations/reverse-geocode');
    expect(method, 'GET');
    expect(query, {'latitude': 10.8, 'longitude': 106.7});
    return {
      'data': {'fullAddress': '  Phường Tân Phong, TP. Hồ Chí Minh  '},
    };
  }
}

void main() {
  test(
    'Địa chỉ làm việc dùng tọa độ đã lưu và đúng contract tra ngược',
    () async {
      final api = _LocationApi();
      addTearDown(api.close);
      expect(
        await ProviderRepository(api).workingAddress(),
        'Phường Tân Phong, TP. Hồ Chí Minh',
      );
      expect(api.paths, ['/locations/me', '/locations/reverse-geocode']);
    },
  );

  test('Thiếu tọa độ hợp lệ không tra ngược hoặc tạo địa chỉ giả', () async {
    final api = _LocationApi();
    addTearDown(api.close);
    for (final value in [
      null,
      <double>[],
      [106.7],
      ['106.7', 10.8],
    ]) {
      api.coordinates = value;
      expect(await ProviderRepository(api).workingAddress(), isNull);
    }
    expect(api.paths, everyElement('/locations/me'));
  });
}
