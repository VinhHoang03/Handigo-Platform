import '../../../shared/utils/address_format.dart';

class AddressItem {
  const AddressItem({
    required this.id,
    required this.addressLabel,
    required this.recipientName,
    required this.recipientPhone,
    required this.fullAddress,
    required this.province,
    required this.ward,
    this.isDefault = false,
    this.note,
    this.placeId,
  });
  factory AddressItem.fromJson(Map<String, dynamic> json) => AddressItem(
    id: _id(json),
    addressLabel: '${json['addressLabel'] ?? ''}',
    recipientName: '${json['recipientName'] ?? ''}',
    recipientPhone: '${json['recipientPhone'] ?? ''}',
    fullAddress: '${json['fullAddress'] ?? json['addressLine'] ?? ''}',
    province: '${json['province'] ?? ''}',
    ward: '${json['ward'] ?? ''}',
    isDefault: json['isDefault'] == true,
    note: json['note'] as String?,
    placeId: json['placeId'] as String?,
  );
  final String id,
      addressLabel,
      recipientName,
      recipientPhone,
      fullAddress,
      province,
      ward;
  final bool isDefault;
  final String? note;
  final String? placeId;

  String get displayAddress => formatAddress(
    fullAddress,
    ward: ward,
    province: province,
    fromMap: isMapAddress(placeId),
  );
}

class WalletInfo {
  const WalletInfo({
    this.balance = 0,
    this.pendingBalance = 0,
    this.currency = 'VND',
  });
  factory WalletInfo.fromJson(Map<String, dynamic> json) => WalletInfo(
    balance: _num(json['balance']),
    pendingBalance: _num(json['pendingBalance']),
    currency: '${json['currency'] ?? 'VND'}',
  );
  final double balance, pendingBalance;
  final String currency;
}

class WalletTransactionItem {
  const WalletTransactionItem({
    required this.id,
    required this.type,
    required this.amount,
    required this.direction,
    this.status,
    this.description,
    this.createdAt,
  });
  factory WalletTransactionItem.fromJson(Map<String, dynamic> json) =>
      WalletTransactionItem(
        id: _id(json),
        type: '${json['type'] ?? ''}',
        amount: _num(json['amount']),
        direction: '${json['direction'] ?? ''}',
        status: json['status'] as String?,
        description: json['description'] as String?,
        createdAt: json['createdAt'] as String?,
      );
  final String id, type, direction;
  final double amount;
  final String? status, description, createdAt;
}

class PaymentHistoryItem {
  const PaymentHistoryItem({
    required this.id,
    required this.amount,
    required this.method,
    required this.status,
    this.createdAt,
  });

  factory PaymentHistoryItem.fromJson(Map<String, dynamic> json) =>
      PaymentHistoryItem(
        id: _id(json),
        amount: _num(json['amount']),
        method: '${json['method'] ?? ''}',
        status: '${json['status'] ?? ''}',
        createdAt: json['createdAt'] as String?,
      );

  final String id, method, status;
  final double amount;
  final String? createdAt;
}

class VoucherItem {
  const VoucherItem({
    required this.code,
    required this.name,
    this.description,
    this.discountType,
    this.discountValue = 0,
    this.minOrderAmount = 0,
    this.startAt,
    this.endAt,
    this.applicableOrderType,
  });
  factory VoucherItem.fromJson(Map<String, dynamic> json) => VoucherItem(
    code: '${json['code'] ?? ''}',
    name: '${json['name'] ?? json['code'] ?? 'Voucher'}',
    description: json['description'] as String?,
    discountType: json['discountType'] as String?,
    discountValue: _num(json['discountValue']),
    minOrderAmount: _num(json['minOrderAmount']),
    startAt: json['startAt'] as String?,
    endAt: json['endAt'] as String?,
    applicableOrderType: json['applicableOrderType'] as String?,
  );
  final String code, name;
  final String? description, discountType, startAt, endAt;
  final String? applicableOrderType;
  final double discountValue, minOrderAmount;
}

class FeedbackItem {
  const FeedbackItem({
    required this.id,
    required this.rating,
    this.comment,
    this.createdAt,
    this.providerName,
    this.orderId,
  });
  factory FeedbackItem.fromJson(Map<String, dynamic> json) {
    final provider = json['providerId'];
    return FeedbackItem(
      id: _id(json),
      rating: _num(json['rating']),
      comment: json['comment'] as String?,
      createdAt: json['createdAt'] as String?,
      providerName: provider is Map ? provider['fullName'] as String? : null,
      orderId: _valueId(json['orderId']),
    );
  }
  final String id;
  final double rating;
  final String? comment, createdAt, providerName, orderId;
}

class SupportItem {
  const SupportItem({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    this.category,
    this.createdAt,
  });
  factory SupportItem.fromJson(Map<String, dynamic> json) => SupportItem(
    id: _id(json),
    title: '${json['subject'] ?? json['title'] ?? ''}',
    description: '${json['description'] ?? ''}',
    status: '${json['status'] ?? ''}',
    category: json['category'] as String?,
    createdAt: json['createdAt'] as String?,
  );
  final String id, title, description, status;
  final String? category, createdAt;
}

String _id(Map<String, dynamic> json) => '${json['_id'] ?? json['id'] ?? ''}';
String? _valueId(dynamic value) =>
    value is Map ? '${value['_id'] ?? value['id'] ?? ''}' : value as String?;
double _num(dynamic value) =>
    value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
