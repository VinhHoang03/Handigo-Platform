class Service {
  const Service({
    required this.id,
    required this.name,
    required this.description,
    required this.serviceType,
    this.fixedPrice,
    this.minOptionPrice,
    this.coverImage,
    this.galleryImages = const [],
    this.categoryName,
    this.averageRating = 0,
    this.totalFeedbacks = 0,
    this.totalCompletedOrders = 0,
    this.processSteps = const [],
    List<ServiceOptionGroup>? optionGroups,
    bool? requiresOptionSelection,
  }) : _optionGroups = optionGroups, _requiresOptionSelection = requiresOptionSelection;
  factory Service.fromJson(Map<String, dynamic> json) {
    final category = json['categoryId'];
    return Service(
      optionGroups: (json['optionGroups'] as List<dynamic>? ?? []).whereType<Map<String, dynamic>>().map(ServiceOptionGroup.fromJson).toList(growable: false),
      requiresOptionSelection: json['requiresOptionSelection'] as bool? ?? false,
      id: json['_id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      serviceType: json['serviceType'] as String,
      fixedPrice: (json['fixedPrice'] as num?)?.toDouble(),
      minOptionPrice: (json['minOptionPrice'] as num?)?.toDouble(),
      coverImage:
          (json.containsKey('coverImage') ? json['coverImage'] : json['image'])
              as String?,
      galleryImages: (json['galleryImages'] as List<dynamic>? ?? [])
          .whereType<String>()
          .toList(growable: false),
      categoryName: category is Map<String, dynamic>
          ? category['name'] as String?
          : null,
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      totalFeedbacks: (json['totalFeedbacks'] as num?)?.toInt() ?? 0,
      totalCompletedOrders:
          (json['totalCompletedOrders'] as num?)?.toInt() ?? 0,
      processSteps: (json['processSteps'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(ServiceProcessStep.fromJson)
          .where((step) => step.title.isNotEmpty)
          .toList(growable: false),
    );
  }
  final String id;
  final String name;
  final String description;
  final String serviceType;
  final double? fixedPrice;
  final double? minOptionPrice;
  final String? coverImage;
  final List<String> galleryImages;
  final String? categoryName;
  final double averageRating;
  final int totalFeedbacks;
  final int totalCompletedOrders;
  final List<ServiceProcessStep> processSteps;
  final List<ServiceOptionGroup>? _optionGroups;
  final bool? _requiresOptionSelection;
  List<ServiceOptionGroup> get optionGroups => _optionGroups ?? const [];
  bool get requiresOptionSelection => _requiresOptionSelection ?? false;
}

class ServiceOptionGroup {
  const ServiceOptionGroup({required this.id, required this.name, required this.selectionMode, required this.isRequired});
  factory ServiceOptionGroup.fromJson(Map<String, dynamic> json) => ServiceOptionGroup(
    id: json['_id'] as String, name: json['name'] as String,
    selectionMode: json['selectionMode'] as String, isRequired: json['isRequired'] as bool? ?? false,
  );
  final String id, name, selectionMode;
  final bool isRequired;
}

class ServiceProcessStep {
  const ServiceProcessStep({required this.title, required this.description});
  factory ServiceProcessStep.fromJson(Map<String, dynamic> json) =>
      ServiceProcessStep(
        title: (json['title'] as String? ?? '').trim(),
        description: (json['description'] as String? ?? '').trim(),
      );
  final String title;
  final String description;
}
