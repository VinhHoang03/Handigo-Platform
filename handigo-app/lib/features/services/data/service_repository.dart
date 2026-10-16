import '../../../core/network/api_client.dart';
import '../../../core/network/paged_result.dart';
import '../domain/service.dart';

class ServiceRepository {
  const ServiceRepository(this._api);
  final ApiClient _api;

  Future<PagedResult<Service>> list({int page = 1}) async {
    final response = await _api.request('/services', query: {
      'page': page, 'limit': 20, 'isActive': 'true',
    });
    return PagedResult.fromJson(response['data'] as Map<String, dynamic>, Service.fromJson);
  }
}
