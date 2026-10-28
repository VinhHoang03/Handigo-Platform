import '../../../core/network/api_client.dart';
import 'package:geolocator/geolocator.dart';
import '../../services/domain/service.dart';
import '../../services/domain/service_category.dart';
import '../domain/customer_home_data.dart';

class CustomerHomeRepository {
  const CustomerHomeRepository(this._api);
  final ApiClient _api;

  Future<CustomerHomeData> load({Position? currentPosition}) async {
    final results = await Future.wait<dynamic>([
      _loadCategories(),
      _loadServices(),
      _loadUnreadCount(),
      _loadOptional(_loadVouchers),
      _loadOptional(_loadNews),
    ]);
    final unreadCount = results.length > 2 && results[2] is num
        ? (results[2] as num).toInt()
        : 0;
    return CustomerHomeData(
      categories: results[0] as List<ServiceCategory>,
      services: results[1] as List<Service>,
      providers: const [],
      unreadNotificationCount: unreadCount,
      vouchers: results[3] as List<HomeVoucher>,
      news: results[4] as List<HomeNewsArticle>,
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
    final response = await _api.request(
      '/services',
      query: {'page': 1, 'limit': 6, 'isActive': 'true'},
    );
    final data = response['data'] as Map<String, dynamic>? ?? const {};
    final items = data['items'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(Service.fromJson)
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

  Future<List<HomeVoucher>> _loadVouchers() async {
    final response = await _api.request(
      '/vouchers/available',
      authenticated: true,
    );
    final data = response['data'];
    final items = data is List<dynamic>
        ? data
        : data is Map<String, dynamic>
        ? data['items'] as List<dynamic>? ?? const []
        : const <dynamic>[];
    return items
        .whereType<Map<String, dynamic>>()
        .map(HomeVoucher.fromJson)
        .take(6)
        .toList();
  }

  Future<List<HomeNewsArticle>> _loadNews() async {
    final response = await _api.request('/news');
    final items = response['data'] as List<dynamic>? ?? const [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(HomeNewsArticle.fromJson)
        .take(4)
        .toList();
  }

  Future<List<T>> _loadOptional<T>(Future<List<T>> Function() loader) async {
    try {
      return await loader();
    } catch (_) {
      return <T>[];
    }
  }
}
