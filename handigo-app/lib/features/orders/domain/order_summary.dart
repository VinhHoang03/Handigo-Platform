class OrderSummary {
  const OrderSummary({required this.id, required this.code, required this.serviceName,
    required this.status});
  factory OrderSummary.fromJson(Map<String, dynamic> json) {
    final service = json['serviceId'];
    return OrderSummary(
      id: json['_id'] as String,
      code: json['orderCode'] as String? ?? '',
      serviceName: service is Map<String, dynamic>
          ? service['name'] as String? ?? 'Dịch vụ' : 'Dịch vụ',
      status: json['status'] as String,
    );
  }
  final String id;
  final String code;
  final String serviceName;
  final String status;
}
