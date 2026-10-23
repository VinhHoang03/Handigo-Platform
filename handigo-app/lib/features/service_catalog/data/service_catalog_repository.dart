import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/paged_result.dart';
import '../../booking/domain/booking_models.dart';
import '../../services/domain/service.dart';
import '../../services/domain/service_category.dart';
import '../domain/service_detail.dart';
import '../domain/service_option.dart';
import '../domain/service_review.dart';

class ServiceCatalogRepository {
  const ServiceCatalogRepository(this._api);
  final ApiClient _api;

  Future<String> uploadAttachment(XFile file) =>
      _api.uploadOrderAttachment(file, purpose: 'order_problem');

  Future<Map<String, dynamic>> bookingPolicies() async =>
      (await _api.request(
            '/orders/booking-policies',
            authenticated: true,
          ))['data']
          as Map<String, dynamic>;

  Future<List<Map<String, dynamic>>> nearbyProviders(
    Map<String, dynamic> query,
  ) async {
    final response = await _api.request(
      '/providers/nearby',
      query: query,
      authenticated: true,
    );
    return (response['data'] as List)
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  Future<PagedResult<ServiceReview>> reviews(ServiceReviewQuery query) async {
    final response = await _api.request(
      '/services/${query.serviceId}/feedback',
      query: {
        'page': query.page,
        'limit': query.positiveOnly ? 4 : 10,
        'sort': query.positiveOnly ? 'rating' : 'newest',
        if (query.positiveOnly) 'positiveOnly': 'true',
        if (query.rating != null) 'rating': query.rating,
        if (query.hasImages) 'hasImages': 'true',
        if (query.keyword.isNotEmpty) 'keyword': query.keyword,
        'optionId': ?query.optionId,
      },
    );
    return PagedResult.fromJson(
      response['data'] as Map<String, dynamic>,
      ServiceReview.fromJson,
    );
  }

  Future<List<ServiceCategory>> categories() async {
    final response = await _api.request('/categories/active');
    final data = response['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(ServiceCategory.fromJson)
        .toList();
  }

  Future<PagedResult<Service>> services({
    String? categoryId,
    int page = 1,
  }) async {
    final response = await _api.request(
      '/services',
      query: {
        'page': page,
        'limit': 50,
        'isActive': 'true',
        if (categoryId != null) 'categoryId': categoryId,
      },
    );
    return PagedResult.fromJson(
      response['data'] as Map<String, dynamic>,
      Service.fromJson,
    );
  }

  Future<ServiceDetail> detail(String serviceId) async {
    final results = await Future.wait([
      _api.request('/services/$serviceId'),
      _api.request('/services/$serviceId/options'),
    ]);
    final optionData = results[1]['data'];
    final options = optionData is List
        ? optionData
              .whereType<Map<String, dynamic>>()
              .map(ServiceOption.fromJson)
              .toList()
        : <ServiceOption>[];
    return ServiceDetail.fromJson(
      results[0]['data'] as Map<String, dynamic>,
      options,
    );
  }

  Future<List<Address>> addresses() async {
    final response = await _api.request('/addresses', authenticated: true);
    final data = response['data'];
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(Address.fromJson)
        .toList();
  }

  Future<Address> createAddress({
    required String recipientName,
    required String recipientPhone,
    required String fullAddress,
    required String province,
    required String ward,
    double? latitude,
    double? longitude,
  }) async {
    final response = await _api.request(
      '/addresses',
      method: 'POST',
      authenticated: true,
      data: {
        'recipientName': recipientName,
        'recipientPhone': recipientPhone,
        'fullAddress': fullAddress,
        'province': province,
        'ward': ward,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
      },
    );
    return Address.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<BookingPreview> preview({
    required String serviceId,
    required BookingType type,
    required List<Map<String, dynamic>> selectedOptions,
    String? voucherCode,
    int? uniformQuantity,
  }) async {
    final response = await _api.request(
      '/orders/preview',
      method: 'POST',
      authenticated: true,
      data: {
        'serviceId': serviceId,
        'orderType': bookingTypeValue(type),
        'selectedOptions': selectedOptions,
        if (uniformQuantity != null) 'uniformQuantity': uniformQuantity,
        if (voucherCode != null && voucherCode.isNotEmpty)
          'voucherCode': voucherCode,
      },
    );
    return BookingPreview.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<CreatedOrder> createOrder({
    required String serviceId,
    required List<Map<String, dynamic>> selectedOptions,
    required String addressId,
    required BookingType type,
    required PaymentMethod paymentMethod,
    DateTime? scheduledAt,
    String? recurrenceUnit,
    int? recurrenceCount,
    String? problemDescription,
    List<String> attachments = const [],
    String? voucherCode,
    String? preferredProviderId,
    int? uniformQuantity,
    double? expectedBookingAmount,
    double? expectedFinalAmount,
  }) async {
    final response = await _api.request(
      '/orders',
      method: 'POST',
      authenticated: true,
      data: {
        'serviceId': serviceId,
        'selectedOptions': selectedOptions,
        'selectedOptionIds': selectedOptions
            .map((item) => item['optionId'])
            .toList(),
        'addressId': addressId,
        if (preferredProviderId != null)
          'preferredProviderId': preferredProviderId,
        if (uniformQuantity != null) 'uniformQuantity': uniformQuantity,
        if (expectedBookingAmount != null)
          'expectedBookingAmount': expectedBookingAmount,
        if (expectedFinalAmount != null)
          'expectedFinalAmount': expectedFinalAmount,
        'orderType': bookingTypeValue(type),
        'paymentMethod': paymentMethodValue(paymentMethod),
        if (scheduledAt != null &&
            [BookingType.scheduled, BookingType.recurring].contains(type))
          'scheduledAt': scheduledAt.toUtc().toIso8601String(),
        if (type == BookingType.recurring && recurrenceUnit != null)
          'recurrenceUnit': recurrenceUnit,
        if (type == BookingType.recurring && recurrenceCount != null)
          'recurrenceCount': recurrenceCount,
        if (problemDescription != null && problemDescription.trim().isNotEmpty)
          'problemDescription': problemDescription.trim(),
        if (attachments.isNotEmpty) 'customerAttachments': attachments,
        if (voucherCode != null && voucherCode.trim().isNotEmpty)
          'voucherCode': voucherCode.trim().toUpperCase(),
      },
    );
    return CreatedOrder.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<PaymentResult> createPayment({
    required String orderId,
    required PaymentMethod method,
    bool inspectionRequired = false,
    double? expectedAmount,
  }) async {
    final response = await _api.request(
      '/payments/create',
      method: 'POST',
      authenticated: true,
      data: {
        'orderId': orderId,
        'method': switch (method) {
          PaymentMethod.bank => 'PAYOS',
          PaymentMethod.wallet => 'WALLET',
          PaymentMethod.cash => 'CASH',
        },
        'paymentType': inspectionRequired ? 'INSPECTION_DEPOSIT' : 'FULL',
        if (expectedAmount != null) 'expectedAmount': expectedAmount,
      },
    );
    return PaymentResult.fromJson(response['data'] as Map<String, dynamic>);
  }

  Future<PaymentResult> reconcilePayment(String orderId) async {
    final response = await _api.request(
      '/payments/order/$orderId/reconcile',
      method: 'POST',
      authenticated: true,
    );
    final data = response['data'];
    if (data is! Map<String, dynamic>)
      throw const FormatException('Phản hồi đối soát thanh toán không hợp lệ.');
    final payment = data['payment'];
    if (payment is Map<String, dynamic>)
      return PaymentResult.fromJson({'payment': payment});
    return PaymentResult.fromJson(data);
  }

  Future<Map<String, dynamic>> applyVoucher({
    required String orderId,
    required String code,
  }) => _api.request(
    '/vouchers/apply',
    method: 'POST',
    authenticated: true,
    data: {'orderId': orderId, 'code': code.trim().toUpperCase()},
  );

  Future<Map<String, dynamic>> removeVoucher(String orderId) => _api.request(
    '/vouchers/remove',
    method: 'POST',
    authenticated: true,
    data: {'orderId': orderId},
  );
}
