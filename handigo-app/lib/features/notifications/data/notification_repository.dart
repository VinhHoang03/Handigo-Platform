import '../../../core/network/api_client.dart';
import '../../../core/network/paged_result.dart';
import '../domain/notification_models.dart';

class NotificationRepository {
  const NotificationRepository(this._api);
  final ApiClient _api;
  Future<PagedResult<AppNotification>> list({int page = 1}) async {
    final response = await _api.request('/notifications', query: {'page': page, 'limit': 20}, authenticated: true);
    return PagedResult.fromJson(response['data'] as Map<String, dynamic>, AppNotification.fromJson);
  }
  Future<void> markRead(String id) async => _api.request('/notifications/$id/read', method: 'PATCH', authenticated: true);
  Future<void> markAllRead() async => _api.request('/notifications/read-all', method: 'PATCH', authenticated: true);
}
