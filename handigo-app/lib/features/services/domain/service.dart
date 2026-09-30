class Service {
  const Service({required this.id, required this.name, required this.description,
    required this.serviceType, this.fixedPrice, this.minOptionPrice});
  factory Service.fromJson(Map<String, dynamic> json) => Service(
    id: json['_id'] as String,
    name: json['name'] as String,
    description: json['description'] as String? ?? '',
    serviceType: json['serviceType'] as String,
    fixedPrice: (json['fixedPrice'] as num?)?.toDouble(),
    minOptionPrice: (json['minOptionPrice'] as num?)?.toDouble(),
  );
  final String id;
  final String name;
  final String description;
  final String serviceType;
  final double? fixedPrice;
  final double? minOptionPrice;
}
