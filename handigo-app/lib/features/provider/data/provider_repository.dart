import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/paged_result.dart';
import '../../orders/domain/order_summary.dart';
import '../../account/domain/account_models.dart';
import '../domain/provider_models.dart';

class ProviderRepository {
  const ProviderRepository(this._api);
  final ApiClient _api;

  Future<ProviderOverview> overview() async {
    final response = await _api.request(
      '/dashboard/overview',
      authenticated: true,
    );
    return ProviderOverview.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<ProviderOverview> setAvailability(String status) async {
    final response = await _api.request(
      '/dashboard/provider/availability',
      method: 'PATCH',
      data: {'availabilityStatus': status},
      authenticated: true,
    );
    final current = await overview();
    final data = response['data'] is Map<String, dynamic>
        ? response['data'] as Map<String, dynamic>
        : {};
    return ProviderOverview.fromJson({..._overviewJson(current), ...data});
  }

  Future<PagedResult<OrderSummary>> orders({
    String? status,
    int page = 1,
    String? search,
  }) async {
    final response = await _api.request(
      '/orders/provider',
      query: {
        'page': page,
        'limit': 50,
        'status': ?status,
        if (search != null && search.isNotEmpty) 'search': search,
      },
      authenticated: true,
    );
    return PagedResult.fromJson(
      response['data'] as Map<String, dynamic>,
      OrderSummary.fromJson,
    );
  }

  Future<List<OrderSummary>> recentOrders() async {
    final response = await _api.request(
      '/orders/provider/recent',
      query: {'limit': 20},
      authenticated: true,
    );
    final items = (response['data'] as Map<String, dynamic>)['items'] as List;
    return items.whereType<Map<String, dynamic>>().map((order) {
      final address = order['addressId'];
      if (address is! Map<String, dynamic>) return OrderSummary.fromJson(order);
      final fullAddress = address['addressLine'] ?? address['fullAddress'];
      if (fullAddress is! String) return OrderSummary.fromJson(order);
      final placeId = address['placeId'];
      return OrderSummary.fromJson({
        ...order,
        'addressId': {
          ...address,
          'addressLine': formatAssignmentAddress(
            fullAddress,
            fromMap:
                placeId is String &&
                placeId.isNotEmpty &&
                !placeId.startsWith('agent-area:'),
          ),
        },
      });
    }).toList();
  }

  Future<List<ProviderAssignment>> pendingAssignments() async {
    final response = await _api.request(
      '/orders/assignments/pending',
      authenticated: true,
    );
    final raw = response['data'];
    return (raw is List ? raw : const [])
        .whereType<Map<String, dynamic>>()
        .map(ProviderAssignment.fromJson)
        .toList();
  }

  Future<void> acceptAssignment(String id) async => _api.request(
    '/orders/assignments/$id/accept',
    method: 'POST',
    authenticated: true,
  );
  Future<void> rejectAssignment(String id, String reason) async => _api.request(
    '/orders/assignments/$id/reject',
    method: 'POST',
    data: {'rejectReason': reason},
    authenticated: true,
  );
  Future<void> startOrder(String id) async =>
      _api.request('/orders/$id/start', method: 'POST', authenticated: true);
  Future<void> completeOrder(
    String id,
    List<String> evidence,
    String note, {
    RepairQuotation? quotation,
  }) async => _api.request(
    '/orders/$id/complete',
    method: 'POST',
    data: {
      'completionEvidenceImages': evidence,
      if (note.trim().isNotEmpty) 'completionNote': note.trim(),
      if (quotation != null) 'expectedQuotationId': quotation.id,
      if (quotation != null) 'expectedQuotationRevision': quotation.revision,
    },
    authenticated: true,
  );
  Future<void> updateExpectedEnd(String id, DateTime value) async =>
      _api.request(
        '/orders/$id/expected-end',
        method: 'PATCH',
        data: {'expectedEndAt': value.toUtc().toIso8601String()},
        authenticated: true,
      );

  Future<void> createQuotation(
    String id,
    List<Map<String, dynamic>> items, {
    String? note,
  }) async => _api.request(
    '/orders/$id/quotations',
    method: 'POST',
    data: {
      'items': items,
      if (note != null && note.trim().isNotEmpty) 'inspectionNote': note.trim(),
    },
    authenticated: true,
  );
  Future<String> uploadEvidence(XFile file) => _api.uploadOrderAttachment(file);

  Future<Map<String, dynamic>> assistQuotation(
    String orderId,
    Map<String, dynamic> snapshot,
  ) async {
    final response = await _api.request(
      '/orders/$orderId/quotation-agent/assist',
      method: 'POST',
      authenticated: true,
      receiveTimeout: const Duration(seconds: 85),
      data: snapshot,
    );
    if (response['data'] is! Map<String, dynamic>) {
      throw const FormatException('Kết quả phân tích báo giá không hợp lệ.');
    }
    return response['data'] as Map<String, dynamic>;
  }

  Future<List<QuotationItem>> scanQuotation(String orderId, XFile file) async {
    final data = await _api.uploadImages(
      '/orders/quotation-items/scan-image',
      [file],
      field: 'image',
      data: {'orderId': orderId},
    );
    if (data is! Map || data['items'] is! List)
      throw const FormatException('Kết quả đọc ảnh báo giá không hợp lệ.');
    return (data['items'] as List)
        .whereType<Map<String, dynamic>>()
        .map(QuotationItem.fromJson)
        .toList();
  }

  Future<void> saveQuotation(
    String orderId,
    Map<String, dynamic> payload, {
    RepairQuotation? current,
  }) async {
    await _api.request(
      current == null
          ? '/orders/$orderId/quotations'
          : '/orders/$orderId/quotation',
      method: current == null ? 'POST' : 'PATCH',
      authenticated: true,
      data: {
        ...payload,
        if (current != null) 'quotationId': current.id,
        if (current != null) 'expectedRevision': current.revision,
      },
    );
  }

  Future<void> confirmQuotationPayment(
    String orderId,
    RepairQuotation quotation,
  ) async {
    await _api.request(
      '/orders/$orderId/quotation/payment/confirm',
      method: 'POST',
      authenticated: true,
      data: {
        'quotationId': quotation.id,
        'expectedRevision': quotation.revision,
      },
    );
  }

  Future<Map<String, dynamic>> profile() async =>
      (await _api.request('/providers/me', authenticated: true))['data']
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async =>
      (await _api.request(
            '/providers/me',
            method: 'PATCH',
            data: data,
            authenticated: true,
          ))['data']
          as Map<String, dynamic>;
  Future<Map<String, dynamic>> createCertificate(
    Map<String, dynamic> data,
  ) async =>
      (await _api.request(
            '/providers/me/certificates',
            method: 'POST',
            data: data,
            authenticated: true,
          ))['data']
          as Map<String, dynamic>;
  Future<void> deleteCertificate(String id) async {
    await _api.request(
      '/providers/me/certificates/$id',
      method: 'DELETE',
      authenticated: true,
    );
  }

  Future<WalletInfo> wallet() async => WalletInfo.fromJson(
    (await _api.request('/wallets/me', authenticated: true))['data']
        as Map<String, dynamic>,
  );
  Future<PagedResult<WalletTransactionItem>> walletTransactions() async {
    final data =
        (await _api.request(
              '/wallets/me/transactions',
              query: {'page': 1, 'limit': 20},
              authenticated: true,
            ))['data']
            as Map<String, dynamic>;
    return PagedResult.fromJson(data, WalletTransactionItem.fromJson);
  }

  Future<PagedResult<Map<String, dynamic>>> withdrawals() async {
    final data =
        (await _api.request(
              '/withdrawals/me',
              query: {'page': 1, 'limit': 20},
              authenticated: true,
            ))['data']
            as Map<String, dynamic>;
    return PagedResult.fromJson(data, (item) => item);
  }

  Future<void> withdraw(double amount, String bankAccountId) async {
    await _api.request(
      '/withdrawals',
      method: 'POST',
      data: {'amount': amount, 'bankAccountId': bankAccountId},
      authenticated: true,
    );
  }

  Future<List<Map<String, dynamic>>> bankAccounts() async {
    final data = (await _api.request(
      '/bank-accounts',
      authenticated: true,
    ))['data'];
    return (data as List<dynamic>? ?? [])
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }

  Future<Map<String, dynamic>> createBankAccount(
    Map<String, dynamic> data,
  ) async =>
      (await _api.request(
            '/bank-accounts',
            method: 'POST',
            data: data,
            authenticated: true,
          ))['data']
          as Map<String, dynamic>;
  Future<void> setDefaultBankAccount(String id) async {
    await _api.request(
      '/bank-accounts/$id/default',
      method: 'PATCH',
      authenticated: true,
    );
  }

  Future<void> deleteBankAccount(String id) async {
    await _api.request(
      '/bank-accounts/$id',
      method: 'DELETE',
      authenticated: true,
    );
  }

  Future<PagedResult<Map<String, dynamic>>> feedbacks() async {
    final data =
        (await _api.request(
              '/feedback/provider/me',
              query: {'page': 1, 'limit': 20},
              authenticated: true,
            ))['data']
            as Map<String, dynamic>;
    return PagedResult.fromJson(data, (item) => item);
  }

  Map<String, dynamic> _overviewJson(ProviderOverview value) => {
    'walletBalance': value.walletBalance,
    'monthlyEarnings': value.monthlyEarnings,
    'completedOrders': value.completedOrders,
    'averageRating': value.averageRating,
    'availabilityStatus': value.availabilityStatus,
    'pendingWithdrawals': value.pendingWithdrawals,
    'pendingBalance': value.pendingBalance,
  };
}
