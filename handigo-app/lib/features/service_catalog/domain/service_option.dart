class ServiceOption {
  const ServiceOption({
    required this.id,
    required this.name,
    required this.price,
    this.description,
    this.optionType,
    this.selectionGroup,
    this.selectionMode = 'single',
    this.allowsQuantity = false,
  });

  factory ServiceOption.fromJson(Map<String, dynamic> json) => ServiceOption(
        id: (json['_id'] ?? json['id']) as String,
        name: json['name'] as String,
        price: (json['price'] as num?)?.toDouble() ?? 0,
        description: json['description'] as String?,
        optionType: json['optionType'] as String?,
        selectionGroup: json['selectionGroup'] as String?,
        selectionMode: json['selectionMode'] as String? ?? 'single',
        allowsQuantity: json['allowsQuantity'] as bool? ?? false,
      );

  final String id;
  final String name;
  final double price;
  final String? description;
  final String? optionType;
  final String? selectionGroup;
  final String selectionMode;
  final bool allowsQuantity;
}
