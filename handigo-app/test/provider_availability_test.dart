import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/features/provider/data/provider_repository.dart';
import 'package:handigo_app/features/provider/domain/provider_models.dart';

class _AvailabilityApi extends ApiClient {
  _AvailabilityApi() : super(Dio(), CookieJar());
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
    expect(path, '/dashboard/provider/availability');
    expect(method, 'PATCH');
    expect(authenticated, isTrue);
    expect(data, {'availabilityStatus': 'online'});
    return {
      'data': {'availabilityStatus': 'online'},
    };
  }
}

void main() {
  test(
    'Đổi nhận việc tái sử dụng tổng quan hiện có, không chờ GET thừa',
    () async {
      final api = _AvailabilityApi();
      addTearDown(api.close);
      final current = ProviderOverview.fromJson({
        'availabilityStatus': 'offline',
        'walletBalance': 100000,
        'monthlyEarnings': 500000,
      });
      final result = await ProviderRepository(
        api,
      ).setAvailability('online', current: current);
      expect(api.paths, ['/dashboard/provider/availability']);
      expect(result.availabilityStatus, 'online');
      expect(result.walletBalance, 100000);
      expect(result.monthlyEarnings, 500000);
    },
  );
}
