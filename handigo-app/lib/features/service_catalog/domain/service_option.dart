class ServiceOption {
  const ServiceOption({
    required this.id,
    required this.name,
    required this.price,
    this.description,
    this.optionType,
    this.selectionGroup,
    this.groupId,
    bool? isRequired,
    this.selectionMode = 'multiple',
    this.allowsQuantity = false,
  }) : _isRequired = isRequired;

  factory ServiceOption.fromJson(Map<String, dynamic> json) => ServiceOption(
        id: (json['_id'] ?? json['id']) as String,
        name: json['name'] as String,
        price: (json['price'] as num?)?.toDouble() ?? 0,
        description: json['description'] as String?,
        optionType: json['optionType'] as String?,
        selectionGroup: json['selectionGroup'] as String?,
        groupId: json['groupId'] as String?,
        isRequired: json['isRequired'] as bool? ?? false,
        selectionMode: json['selectionMode'] as String? ?? 'multiple',
        allowsQuantity: json['allowsQuantity'] as bool? ?? false,
      );

  final String id;
  final String name;
  final double price;
  final String? description;
  final String? optionType;
  final String? selectionGroup;
  final String? groupId;
  final bool? _isRequired;
  bool get isRequired => _isRequired ?? false;
  final String selectionMode;
  final bool allowsQuantity;
}
