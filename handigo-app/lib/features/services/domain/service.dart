class Service {
  const Service({required this.id, required this.name, required this.description,
    required this.serviceType, this.fixedPrice, this.minOptionPrice, this.image,
    this.categoryName, this.averageRating = 0, this.totalFeedbacks = 0,
    this.totalCompletedOrders = 0});
  factory Service.fromJson(Map<String, dynamic> json) {
    final category = json['categoryId'];
    return Service(
      id: json['_id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      serviceType: json['serviceType'] as String,
      fixedPrice: (json['fixedPrice'] as num?)?.toDouble(),
      minOptionPrice: (json['minOptionPrice'] as num?)?.toDouble(),
      image: json['image'] as String?,
      categoryName: category is Map<String, dynamic>
          ? category['name'] as String?
          : null,
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      totalFeedbacks: (json['totalFeedbacks'] as num?)?.toInt() ?? 0,
      totalCompletedOrders: (json['totalCompletedOrders'] as num?)?.toInt() ?? 0,
    );
  }
  final String id;
  final String name;
  final String description;
  final String serviceType;
  final double? fixedPrice;
  final double? minOptionPrice;
  final String? image;
  final String? categoryName;
  final double averageRating;
  final int totalFeedbacks;
  final int totalCompletedOrders;
}
