import '../../../core/network/api_client.dart';
import '../../providers/domain/featured_provider.dart';
import '../../services/domain/service.dart';
import '../../services/domain/service_category.dart';
import '../domain/customer_home_data.dart';

class CustomerHomeRepository {
  const CustomerHomeRepository(this._api);
  final ApiClient _api;

  Future<CustomerHomeData> load() async {
    final results = await Future.wait<dynamic>([
      _loadCategories(),
      _loadServices(),
      _loadProviders(),
      _loadUnreadCount(),
    ]);
    final unreadCount = results.length > 3 && results[3] is num
        ? (results[3] as num).toInt()
        : 0;
    return CustomerHomeData(
      categories: results[0] as List<ServiceCategory>,
      services: results[1] as List<Service>,
      providers: results[2] as List<FeaturedProvider>,
      unreadNotificationCount: unreadCount,
    );
  }

  Future<List<ServiceCategory>> _loadCategories() async {
    final response = await _api.request('/categories/active');
    final items = response['data'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(ServiceCategory.fromJson)
        .toList();
  }

  Future<List<Service>> _loadServices() async {
    final response = await _api.request('/services', query: {
      'page': 1,
      'limit': 6,
      'isActive': 'true',
    });
    final data = response['data'] as Map<String, dynamic>? ?? const {};
    final items = data['items'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(Service.fromJson)
        .toList();
  }

  Future<List<FeaturedProvider>> _loadProviders() async {
    final response = await _api.request('/providers/featured');
    final items = response['data'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(FeaturedProvider.fromJson)
        .toList();
  }

  Future<int> _loadUnreadCount() async {
    final response = await _api.request(
      '/notifications/unread-count',
      authenticated: true,
    );
    final data = response['data'] as Map<String, dynamic>? ?? const {};
    return (data['count'] as num?)?.toInt() ?? 0;
  }
}
