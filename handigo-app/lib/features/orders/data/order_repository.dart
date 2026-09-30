import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../auth/domain/app_user.dart';
import '../domain/order_summary.dart';

class OrderRepository {
  const OrderRepository(this._api);
  final ApiClient _api;

  Future<PagedResult<OrderSummary>> list(AppUser user, {int page = 1}) async {
    if (!user.canViewOrders) {
      throw const ApiException('Hồ sơ nhà cung cấp cần được duyệt để xem công việc.', statusCode: 403);
    }
    final response = await _api.request(
      user.role == UserRole.provider ? '/orders/provider' : '/orders',
      query: {'page': page, 'limit': 20}, authenticated: true,
    );
    return PagedResult.fromJson(response['data'] as Map<String, dynamic>, OrderSummary.fromJson);
  }
}
