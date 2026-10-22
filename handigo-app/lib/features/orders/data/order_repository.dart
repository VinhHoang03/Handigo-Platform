import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../auth/domain/app_user.dart';
import '../domain/order_summary.dart';

class OrderRepository {
  const OrderRepository(this._api);
  final ApiClient _api;

  Future<PagedResult<OrderSummary>> list(
    AppUser user, {
    int page = 1,
    String? status,
    String? search,
  }) async {
    if (!user.canViewOrders) {
      throw const ApiException(
        'Hồ sơ nhà cung cấp cần được duyệt để xem công việc.',
        statusCode: 403,
      );
    }
    final response = await _api.request(
      user.role == UserRole.provider ? '/orders/provider' : '/orders',
      query: {
        'page': page,
        'limit': 20,
        if (status != null) 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      },
      authenticated: true,
    );
    return PagedResult.fromJson(
      response['data'] as Map<String, dynamic>,
      OrderSummary.fromJson,
    );
  }

  Future<OrderDetail> detail(String id) async {
    final response = await _api.request('/orders/$id', authenticated: true);
    return OrderDetail.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<CancellationPreview> cancellationPreview(
    String id, {
    bool series = false,
  }) async {
    final response = await _api.request(
      '/orders/$id/cancellation-preview',
      query: {'scope': series ? 'series' : 'single'},
      authenticated: true,
    );
    return CancellationPreview.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<void> cancel(
    String id,
    String reason, {
    CancellationPreview? preview,
    bool series = false,
  }) async {
    await _api.request(
      '/orders/$id/${series ? 'cancel-series' : 'cancel'}',
      method: 'PATCH',
      data: {
        'reason': reason,
        if (preview != null && !series)
          'confirmedExpectation': preview.expectation,
        if (preview != null && series) 'confirmedExpectations': preview.items,
      },
      authenticated: true,
    );
  }

  Future<List<OrderSummary>> series(String id) async {
    final response = await _api.request(
      '/orders/$id/series',
      authenticated: true,
    );
    return ((response['data'] as Map)['items'] as List)
        .whereType<Map<String, dynamic>>()
        .map(OrderSummary.fromJson)
        .toList();
  }

  Future<void> respondToReassignment(String id, bool accept) async {
    await _api.request(
      '/orders/$id/reassignment-response',
      method: 'PATCH',
      authenticated: true,
      data: {'decision': accept ? 'accept' : 'decline'},
    );
  }

  Future<void> selectReplacement(String id, String providerId) async {
    await _api.request(
      '/orders/$id/appointment-provider',
      method: 'PATCH',
      authenticated: true,
      data: {'providerId': providerId},
    );
  }

  Future<List<Map<String, dynamic>>> payments(String id) async {
    final response = await _api.request(
      '/payments/order/$id',
      authenticated: true,
    );
    return ((response['data'] as Map)['payments'] as List? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<RepairQuotation?> quotation(String id) async {
    final response = await _api.request(
      '/orders/$id/quotation',
      authenticated: true,
    );
    final data = response['data'];
    return data is Map<String, dynamic> ? RepairQuotation.fromJson(data) : null;
  }

  Future<void> confirmQuotation(String id) async => _api.request(
    '/orders/quotations/$id/confirm',
    method: 'POST',
    authenticated: true,
  );

  Future<void> rejectQuotation(String id, String reason) async => _api.request(
    '/orders/quotations/$id/reject',
    method: 'POST',
    data: {'rejectionReason': reason},
    authenticated: true,
  );
}
