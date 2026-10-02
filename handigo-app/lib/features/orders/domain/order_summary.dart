class OrderSummary {
  const OrderSummary({required this.id, required this.code, required this.serviceName,
    required this.status, this.scheduledAt, this.addressLabel, this.serviceImage,
    this.providerName, this.providerAvatar, this.totalAmount});
  factory OrderSummary.fromJson(Map<String, dynamic> json) {
    final service = json['serviceId'];
    final provider = json['providerId'];
    final providerUser = provider is Map<String, dynamic> ? provider['userId'] : null;
    final pricing = json['pricing'];
    return OrderSummary(
      id: (json['_id'] ?? json['id']) as String,
      code: json['orderCode'] as String? ?? '',
      serviceName: service is Map<String, dynamic>
          ? service['name'] as String? ?? 'Dịch vụ' : 'Dịch vụ',
      status: json['status'] as String? ?? 'created',
      scheduledAt: _date(json['scheduledAt']),
      addressLabel: json['addressId'] is Map<String, dynamic>
          ? ((json['addressId'] as Map<String, dynamic>)['addressLine'] ?? (json['addressId'] as Map<String, dynamic>)['fullAddress']) as String?
          : null,
      serviceImage: service is Map<String, dynamic> ? service['image'] as String? : null,
      providerName: providerUser is Map<String, dynamic> ? providerUser['fullName'] as String? : null,
      providerAvatar: providerUser is Map<String, dynamic> ? providerUser['avatar'] as String? : null,
      totalAmount: pricing is Map<String, dynamic> ? (pricing['totalPaidAmount'] as num?)?.toDouble() : null,
    );
  }
  final String id;
  final String code;
  final String serviceName;
  final String status;
  final DateTime? scheduledAt;
  final String? addressLabel;
  final String? serviceImage;
  final String? providerName;
  final String? providerAvatar;
  final double? totalAmount;
}

class OrderDetail {
  const OrderDetail({required this.id, required this.code, required this.serviceName,
    required this.status, required this.paymentStatus, required this.paymentMethod,
    this.orderType, this.scheduledAt, this.problemDescription, this.totalAmount,
    this.providerName, this.addressLabel, this.hasAdditionalQuotation = false,
    this.currentQuotationId});

  factory OrderDetail.fromJson(Map<String, dynamic> json) {
    final service = json['serviceId'];
    final provider = json['providerId'];
    final address = json['addressId'];
    final pricing = json['pricing'];
    final providerUser = provider is Map<String, dynamic> ? provider['userId'] : null;
    return OrderDetail(
      id: (json['_id'] ?? json['id']) as String,
      code: json['orderCode'] as String? ?? '',
      serviceName: service is Map<String, dynamic> ? (service['name'] as String? ?? 'Dịch vụ') : 'Dịch vụ',
      status: json['status'] as String? ?? 'created',
      paymentStatus: json['paymentStatus'] as String? ?? 'unpaid',
      paymentMethod: json['paymentMethod'] as String? ?? '',
      orderType: json['orderType'] as String?,
      scheduledAt: _date(json['scheduledAt']),
      problemDescription: json['problemDescription'] as String?,
      totalAmount: pricing is Map<String, dynamic> ? (pricing['totalPaidAmount'] as num?)?.toDouble() : null,
      providerName: providerUser is Map<String, dynamic> ? providerUser['fullName'] as String? : null,
      addressLabel: address is Map<String, dynamic> ? ((address['addressLine'] ?? address['fullAddress'] ?? address['label']) as String?) : null,
      hasAdditionalQuotation: json['hasAdditionalQuotation'] as bool? ?? false,
      currentQuotationId: _stringValue(json['currentQuotationId']),
    );
  }

  final String id;
  final String code;
  final String serviceName;
  final String status;
  final String paymentStatus;
  final String paymentMethod;
  final String? orderType;
  final DateTime? scheduledAt;
  final String? problemDescription;
  final double? totalAmount;
  final String? providerName;
  final String? addressLabel;
  final bool hasAdditionalQuotation;
  final String? currentQuotationId;
}

class CancellationPreview {
  const CancellationPreview({required this.paidAmount, required this.refundAmount,
    required this.cancellationFee, this.policyReason});
  factory CancellationPreview.fromJson(Map<String, dynamic> json) => CancellationPreview(
    paidAmount: _number(json['paidAmount']), refundAmount: _number(json['refundAmount']),
    cancellationFee: _number(json['cancellationFee']), policyReason: json['policyReason'] as String?,
  );
  final double paidAmount;
  final double refundAmount;
  final double cancellationFee;
  final String? policyReason;
}

class RepairQuotation {
  const RepairQuotation({required this.id, required this.status, required this.finalAmount,
    this.rejectionReason, this.items = const []});
  factory RepairQuotation.fromJson(Map<String, dynamic> json) {
    final quotation = json['quotation'] is Map<String, dynamic>
        ? json['quotation'] as Map<String, dynamic> : json;
    final rawItems = json['items'] is List ? json['items'] as List : const [];
    return RepairQuotation(
      id: (quotation['_id'] ?? quotation['id']) as String,
      status: quotation['status'] as String? ?? 'pending',
      finalAmount: _number(quotation['finalAmount'] ?? quotation['totalAmount']),
      rejectionReason: quotation['rejectionReason'] as String?,
      items: rawItems.whereType<Map<String, dynamic>>().map(QuotationItem.fromJson).toList(),
    );
  }
  final String id;
  final String status;
  final double finalAmount;
  final String? rejectionReason;
  final List<QuotationItem> items;
}

class QuotationItem {
  const QuotationItem({required this.title, required this.quantity, required this.unitPrice});
  factory QuotationItem.fromJson(Map<String, dynamic> json) => QuotationItem(
    title: json['title'] as String? ?? 'Hạng mục', quantity: (json['quantity'] as num?)?.toInt() ?? 1,
    unitPrice: _number(json['unitPrice']),
  );
  final String title;
  final int quantity;
  final double unitPrice;
}

DateTime? _date(dynamic value) => value is String ? DateTime.tryParse(value) : null;
String? _stringValue(dynamic value) => value is String ? value : value?.toString();
double _number(dynamic value) => (value as num?)?.toDouble() ?? 0;
