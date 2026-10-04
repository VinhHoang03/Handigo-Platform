import '../../orders/domain/order_summary.dart';

class ProviderOverview {
  const ProviderOverview({required this.walletBalance, required this.monthlyEarnings,
    required this.completedOrders, required this.averageRating, required this.availabilityStatus,
    required this.pendingWithdrawals});

  factory ProviderOverview.fromJson(Map<String, dynamic> json) => ProviderOverview(
    walletBalance: _number(json['walletBalance']),
    monthlyEarnings: _number(json['monthlyEarnings']),
    completedOrders: (json['completedOrders'] as num?)?.toInt() ?? 0,
    averageRating: _number(json['averageRating']),
    availabilityStatus: json['availabilityStatus'] as String? ?? 'offline',
    pendingWithdrawals: (json['pendingWithdrawals'] as num?)?.toInt() ?? 0,
  );

  final double walletBalance;
  final double monthlyEarnings;
  final int completedOrders;
  final double averageRating;
  final String availabilityStatus;
  final int pendingWithdrawals;
}

class ProviderAssignment {
  const ProviderAssignment({required this.id, required this.orderId, required this.orderCode,
    required this.serviceName, this.scheduledAt, this.addressLabel, this.responseDeadline});

  factory ProviderAssignment.fromJson(Map<String, dynamic> json) {
    final order = json['orderId'] is Map<String, dynamic>
        ? json['orderId'] as Map<String, dynamic> : <String, dynamic>{};
    final service = order['serviceId'];
    final address = order['addressId'];
    return ProviderAssignment(
      id: _id(json), orderId: _id(order), orderCode: order['orderCode'] as String? ?? '',
      serviceName: service is Map<String, dynamic> ? service['name'] as String? ?? 'Dịch vụ' : 'Dịch vụ',
      scheduledAt: _date(order['scheduledAt']),
      addressLabel: address is Map<String, dynamic>
          ? [address['ward'], address['province']].whereType<String>().where((item) => item.isNotEmpty).join(', ')
          : null,
      responseDeadline: _date(json['responseDeadline']),
    );
  }

  final String id;
  final String orderId;
  final String orderCode;
  final String serviceName;
  final DateTime? scheduledAt;
  final String? addressLabel;
  final DateTime? responseDeadline;
}

String _id(Map<String, dynamic> json) => (json['_id'] ?? json['id']).toString();
DateTime? _date(dynamic value) => value is String ? DateTime.tryParse(value) : null;
double _number(dynamic value) => (value as num?)?.toDouble() ?? 0;
