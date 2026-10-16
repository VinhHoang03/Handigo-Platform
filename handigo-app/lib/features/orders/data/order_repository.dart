import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../auth/domain/app_user.dart';
import '../domain/order_summary.dart';

class OrderRepository {
  const OrderRepository(this._api);
  final ApiClient _api;

  Future<PagedResult<OrderSummary>> list(AppUser user, {int page = 1, String? status, String? search}) async {
    if (!user.canViewOrders) {
      throw const ApiException('Hồ sơ nhà cung cấp cần được duyệt để xem công việc.', statusCode: 403);
    }
    final response = await _api.request(
      user.role == UserRole.provider ? '/orders/provider' : '/orders',
      query: {'page': page, 'limit': 20, if (status != null) 'status': status, if (search != null && search.isNotEmpty) 'search': search}, authenticated: true,
    );
    return PagedResult.fromJson(response['data'] as Map<String, dynamic>, OrderSummary.fromJson);
  }

  Future<OrderDetail> detail(String id) async {
    final response = await _api.request('/orders/$id', authenticated: true);
    return OrderDetail.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<CancellationPreview> cancellationPreview(String id) async {
    final response = await _api.request('/orders/$id/cancellation-preview', authenticated: true);
    return CancellationPreview.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<void> cancel(String id, String reason) async {
    await _api.request('/orders/$id/cancel', method: 'PATCH', data: {'reason': reason}, authenticated: true);
  }

  Future<RepairQuotation?> quotation(String id) async {
    final response = await _api.request('/orders/$id/quotation', authenticated: true);
    final data = response['data'];
    return data is Map<String, dynamic> ? RepairQuotation.fromJson(data) : null;
  }

  Future<void> confirmQuotation(String id) async => _api.request('/orders/quotations/$id/confirm', method: 'POST', authenticated: true);

  Future<void> rejectQuotation(String id, String reason) async => _api.request(
    '/orders/quotations/$id/reject', method: 'POST', data: {'rejectionReason': reason}, authenticated: true,
  );
}
