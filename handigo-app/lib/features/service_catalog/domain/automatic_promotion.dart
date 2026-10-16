class AutomaticPromotion {
  const AutomaticPromotion({required this.name, required this.discountType, required this.discountValue, required this.endAt, this.description});
  factory AutomaticPromotion.fromJson(Map<String, dynamic> json) => AutomaticPromotion(
    name: json['name'] as String,
    description: json['description'] as String?,
    discountType: json['discountType'] as String,
    discountValue: (json['discountValue'] as num).toDouble(),
    endAt: DateTime.parse(json['endAt'] as String),
  );
  final String name, discountType;
  final String? description;
  final double discountValue;
  final DateTime endAt;
}
