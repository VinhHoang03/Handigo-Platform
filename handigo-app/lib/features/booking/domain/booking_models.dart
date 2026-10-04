enum BookingType { normal, urgent, scheduled, recurring }

enum PaymentMethod { wallet, bank, cash }

class Address {
  const Address({
    required this.id,
    required this.recipientName,
    required this.recipientPhone,
    required this.fullAddress,
    required this.province,
    required this.ward,
    required this.isDefault,
    this.latitude,
    this.longitude,
    this.note,
  });

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: (json['_id'] ?? json['id']) as String,
        recipientName: json['recipientName'] as String? ?? '',
        recipientPhone: json['recipientPhone'] as String? ?? '',
        fullAddress: json['fullAddress'] as String? ?? '',
        province: json['province'] as String? ?? '',
        ward: json['ward'] as String? ?? '',
        isDefault: json['isDefault'] as bool? ?? false,
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
        note: json['note'] as String?,
      );

  final String id;
  final String recipientName;
  final String recipientPhone;
  final String fullAddress;
  final String province;
  final String ward;
  final bool isDefault;
  final double? latitude;
  final double? longitude;
  final String? note;
}

class BookingPreview {
  const BookingPreview({
    required this.baseAmount,
    required this.bookingAmount,
    required this.immediateFee,
    required this.depositAmount,
    required this.minAdvanceMinutes,
  });

  factory BookingPreview.fromJson(Map<String, dynamic> json) => BookingPreview(
        baseAmount: (json['baseAmount'] as num?)?.toDouble() ?? 0,
        bookingAmount: (json['bookingAmount'] as num?)?.toDouble() ?? 0,
        immediateFee: (json['immediateFee'] as num?)?.toDouble() ?? 0,
        depositAmount: (json['depositAmount'] as num?)?.toDouble() ?? 0,
        minAdvanceMinutes: (json['minAdvanceMinutes'] as num?)?.toInt() ?? 0,
      );

  final double baseAmount;
  final double bookingAmount;
  final double immediateFee;
  final double depositAmount;
  final int minAdvanceMinutes;
}

class CreatedOrder {
  const CreatedOrder({required this.id, required this.orderCode, this.status});

  factory CreatedOrder.fromJson(Map<String, dynamic> json) => CreatedOrder(
        id: (json['_id'] ?? json['id']) as String,
        orderCode: json['orderCode'] as String? ?? '',
        status: json['status'] as String?,
      );

  final String id;
  final String orderCode;
  final String? status;
}

class PaymentResult {
  const PaymentResult({required this.status, this.checkoutUrl, this.paymentId});

  factory PaymentResult.fromJson(Map<String, dynamic> json) {
    final payment = json['payment'];
    return PaymentResult(
      status: payment is Map<String, dynamic>
          ? payment['status'] as String? ?? 'pending'
          : 'pending',
      checkoutUrl: json['checkoutUrl'] as String?,
      paymentId: payment is Map<String, dynamic>
          ? (payment['_id'] ?? payment['id']) as String?
          : null,
    );
  }

  final String status;
  final String? checkoutUrl;
  final String? paymentId;
}

String bookingTypeValue(BookingType type) => type.name;
String paymentMethodValue(PaymentMethod method) => method.name;
