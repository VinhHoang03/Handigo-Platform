import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../orders/domain/order_summary.dart';
import '../../account/domain/account_models.dart';
import '../../services/domain/service_category.dart';
import '../domain/provider_models.dart';
import '../domain/provider_income.dart';
import '../domain/provider_rewards.dart';
import '../../account/data/account_repository.dart';

class ProviderRepository {
  const ProviderRepository(this._api);
  final ApiClient _api;

  Future<ProviderRewardWeek> rewardWeek(String weekStart) async {
    final response = await _api.request(
      '/providers/me/rewards',
      authenticated: true,
      query: {'weekStart': weekStart},
    );
    return ProviderRewardWeek.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<ProviderRewardHistory> rewardHistory(String? before) async {
    final response = await _api.request(
      '/providers/me/rewards/history',
      authenticated: true,
      query: {'before': ?before},
    );
    return ProviderRewardHistory.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<({double latitude, double longitude, bool approximate})>
  assignmentCoordinates(String address, String ward, String province) async {
    final response = await _api.request(
      '/locations/geocode',
      method: 'POST',
      authenticated: true,
      data: {'fullAddress': address, 'ward': ward, 'province': province},
    );
    final data = response['data'];
    final lat = data is Map ? data['latitude'] : null;
    final lon = data is Map ? data['longitude'] : null;
    if (lat is! num ||
        lon is! num ||
        !lat.isFinite ||
        !lon.isFinite ||
        lat.abs() > 90 ||
        lon.abs() > 180) {
      throw const ApiException(
        'Chưa tra được tọa độ địa chỉ khách. Vui lòng thử lại.',
      );
    }
    return (
      latitude: lat.toDouble(),
      longitude: lon.toDouble(),
      approximate: data['precision'] != 'place',
    );
  }

  Future<ProviderIncomeSummary> income(ProviderIncomeRange range) async {
    Map<String, dynamic>? summary;
    final entries = <ProviderFinanceEntry>[];
    for (var page = 1; ; page++) {
      final response = await _api.request(
        '/dashboard/earnings',
        authenticated: true,
        query: {
          'fromDate': range.fromDate,
          'toDate': range.toDate,
          'page': page,
          'limit': 100,
        },
      );
      final data = response['data'] as Map<String, dynamic>;
      summary ??= data;
      final transactions = data['recentTransactions'] as Map<String, dynamic>;
      final result = PagedResult.fromJson(
        transactions,
        ProviderFinanceEntry.fromJson,
      );
      entries.addAll(result.items);
      if (page >= result.totalPages) break;
    }
    return ProviderIncomeSummary.fromJson(summary, entries);
  }

  Future<PagedResult<ProviderFinanceEntry>> financeHistory({
    int page = 1,
    String? type,
    bool withdrawal = false,
  }) async {
    final response = await _api.request(
      withdrawal ? '/withdrawals/me' : '/wallets/me/transactions',
      authenticated: true,
      query: {
        'page': page,
        'limit': 20,
        if (!withdrawal) 'groupSettlements': 'true',
        if (!withdrawal && type != null) 'type': type,
      },
    );
    return PagedResult.fromJson(
      response['data'] as Map<String, dynamic>,
      withdrawal
          ? ProviderFinanceEntry.withdrawal
          : ProviderFinanceEntry.fromJson,
    );
  }

  Future<Map<String, dynamic>> deposit(double amount) =>
      AccountRepository(_api).deposit(amount);

  Future<ProviderFinanceEntry> syncDeposit(String orderCode) async {
    final response = await _api.request(
      '/wallets/me/deposit/$orderCode/sync',
      method: 'PATCH',
      authenticated: true,
    );
    return ProviderFinanceEntry.fromJson(
      response['data'] as Map<String, dynamic>,
    );
  }

  Future<String?> workingAddress({double? latitude, double? longitude}) async {
    if (latitude != null && longitude != null) {
      return _resolveWorkingAddress(latitude, longitude);
    }
    final response = await _api.request('/locations/me', authenticated: true);
    final location = response['data'];
    if (location is! Map) return null;
    final point = location['coordinates'];
    final coordinates = point is Map ? point['coordinates'] : null;
    if (coordinates is! List ||
        coordinates.length != 2 ||
        coordinates.any((value) => value is! num)) {
      return null;
    }
    return _resolveWorkingAddress(
      (coordinates[1] as num).toDouble(),
      (coordinates[0] as num).toDouble(),
    );
  }

  Future<String?> _resolveWorkingAddress(
    double latitude,
    double longitude,
  ) async {
    final address = await _api.request(
      '/locations/reverse-geocode',
      query: {'latitude': latitude, 'longitude': longitude},
      authenticated: true,
    );
    final data = address['data'];
    if (data is! Map) return null;
    final label = data['fullAddress'];
    return label is String && label.trim().isNotEmpty ? label.trim() : null;
  }

  Future<({int count, DateTime? latestAt})> notificationBadge(
    DateTime? openedAt,
  ) async {
    var count = 0;
    DateTime? latestAt;
    for (var page = 1; ; page++) {
      final response = await _api.request(
        '/notifications',
        authenticated: true,
        query: {'page': page, 'limit': 100, 'isRead': 'false'},
      );
      final data = response['data'] as Map<String, dynamic>;
      final items = (data['items'] as List).whereType<Map>();
      final pagination = data['pagination'] as Map;
      for (final item in items) {
        final createdAt = DateTime.tryParse('${item['createdAt']}');
        latestAt ??= createdAt;
        if (openedAt != null &&
            createdAt != null &&
            !createdAt.isAfter(openedAt)) {
          return (count: count, latestAt: latestAt);
        }
        if (openedAt == null || createdAt?.isAfter(openedAt) == true) count++;
      }
      if (openedAt == null) {
        return (
          count: (pagination['total'] as num?)?.toInt() ?? count,
          latestAt: latestAt,
        );
      }
      if (page >= ((pagination['totalPages'] as num?)?.toInt() ?? 1)) break;
    }
    return (count: count, latestAt: latestAt);
  }

  Future<({int count, DateTime? latestAt})> messageBadge(
    String userId,
    DateTime? openedAt,
  ) async {
    var count = 0;
    DateTime? latestAt;
    for (var page = 1; ; page++) {
      final response = await _api.request(
        '/chat/conversations',
        authenticated: true,
        query: {'page': page, 'limit': 50},
      );
      final data = response['data'] as Map<String, dynamic>;
      for (final item in (data['items'] as List).whereType<Map>()) {
        final message = item['lastMessage'];
        if (message is! Map) continue;
        final sentAt = DateTime.tryParse('${message['sentAt']}');
        if (sentAt == null) continue;
        latestAt ??= sentAt;
        if (openedAt != null && !sentAt.isAfter(openedAt)) continue;
        final sender = message['senderId'];
        final senderId = sender is Map ? sender['_id'] ?? sender['id'] : sender;
        final seenAt = DateTime.tryParse('${item['providerLastSeenAt']}');
        if (senderId != null &&
            senderId.toString() != userId &&
            (seenAt == null || sentAt.isAfter(seenAt))) {
          count++;
        }
      }
      final pagination = data['pagination'] as Map;
      if (page >= ((pagination['totalPages'] as num?)?.toInt() ?? 1)) break;
    }
    return (count: count, latestAt: latestAt);
  }

  Future<ProviderOverview> overview() async {
    final response = await _api.request(
      '/dashboard/overview',
      authenticated: true,
    );
    return ProviderOverview.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<ProviderOverview> setAvailability(
    String status, {
    ProviderOverview? current,
  }) async {
    final response = await _api.request(
      '/dashboard/provider/availability',
      method: 'PATCH',
      data: {'availabilityStatus': status},
      authenticated: true,
    );
    final previous = current ?? await overview();
    final data = response['data'] is Map<String, dynamic>
        ? response['data'] as Map<String, dynamic>
        : {};
    return ProviderOverview.fromJson({..._overviewJson(previous), ...data});
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
  Future<void> arriveOrder(String id) async =>
      _api.request('/orders/$id/arrival', method: 'POST', authenticated: true);

  Future<void> checkNoShowEligibility(String id) async {
    final response = await _api.request(
      '/orders/$id/customer-no-show/eligibility',
      authenticated: true,
    );
    final data = response['data'];
    if (data is! Map || data['eligible'] != true) {
      throw const ApiException(
        'Chưa đủ điều kiện báo khách không có mặt. Vui lòng thử lại sau.',
      );
    }
  }

  Future<String> uploadNoShowEvidence(
    String id,
    String kind,
    XFile file,
  ) async {
    final data = await _api.uploadImages(
      '/orders/$id/customer-no-show/evidence',
      [file],
      field: 'image',
      data: {'kind': kind},
      receiveTimeout: const Duration(seconds: 85),
    );
    if (data is! Map ||
        data['id'] is! String ||
        (data['id'] as String).isEmpty) {
      throw const ApiException(
        'Phản hồi tải bằng chứng không hợp lệ. Vui lòng thử lại.',
      );
    }
    return data['id'] as String;
  }

  Future<void> reportCustomerNoShow(
    String id,
    String description,
    List<String> arrivalIds,
    List<String> contactIds,
  ) async {
    await _api.request(
      '/orders/$id/customer-no-show',
      method: 'POST',
      authenticated: true,
      receiveTimeout: const Duration(seconds: 85),
      data: {
        'description': description,
        'arrivalEvidenceIds': arrivalIds,
        'contactEvidenceIds': contactIds,
        'contactedCustomer': true,
      },
    );
  }

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
    if (data is! Map || data['items'] is! List) {
      throw const FormatException('Kết quả đọc ảnh báo giá không hợp lệ.');
    }
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

  Future<void> confirmCashPayment(String orderId, double expectedAmount) async {
    await _api.request(
      '/orders/$orderId/cash-payment/confirm',
      method: 'POST',
      authenticated: true,
      data: {'expectedAmount': expectedAmount},
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
  Future<WalletSummary> walletSummary() async => WalletSummary.fromJson(
    (await _api.request('/wallets/me/summary', authenticated: true))['data']
        as Map<String, dynamic>,
  );
  Future<PagedResult<WalletTransactionItem>> walletTransactions() async {
    final data =
        (await _api.request(
              '/wallets/me/transactions',
              query: {'page': 1, 'limit': 20, 'groupSettlements': true},
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
              query: {'page': 1, 'limit': 50},
              authenticated: true,
            ))['data']
            as Map<String, dynamic>;
    return PagedResult.fromJson(data, (item) => item);
  }

  Future<List<String>> uploadFeedbackReplyImages(List<XFile> files) async {
    final data = await _api.uploadImages('/feedback/provider/images', files);
    if (data is! List) {
      throw const ApiException('Phản hồi tải ảnh không hợp lệ.');
    }
    return data.whereType<String>().toList();
  }

  Future<Map<String, dynamic>> replyToFeedback({
    required String feedbackId,
    required String content,
    List<String> images = const [],
  }) async =>
      (await _api.request(
            '/feedback/$feedbackId/reply',
            method: 'PUT',
            data: {'content': content.trim(), 'images': images},
            authenticated: true,
          ))['data']
          as Map<String, dynamic>;

  Future<List<ServiceCategory>> suggestionCategories() async {
    final response = await _api.request('/categories/active');
    final data = response['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(ServiceCategory.fromJson)
        .toList();
  }

  Future<void> createServiceSuggestion({
    required String serviceName,
    String? categoryId,
    String? categoryName,
    String? description,
  }) async {
    await _api.request(
      '/service-suggestions',
      method: 'POST',
      authenticated: true,
      data: {
        'suggestionType': 'service',
        'suggestedServiceName': serviceName.trim(),
        'suggestedCategoryName': categoryName?.trim().isNotEmpty == true
            ? categoryName!.trim()
            : null,
        'categoryId': categoryId?.trim().isNotEmpty == true
            ? categoryId!.trim()
            : null,
        'description': description?.trim().isNotEmpty == true
            ? description!.trim()
            : null,
      },
    );
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
