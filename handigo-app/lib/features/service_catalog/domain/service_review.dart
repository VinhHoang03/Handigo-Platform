class ServiceReview {
  const ServiceReview({
    required this.id,
    required this.rating,
    required this.customerName,
    this.avatar,
    this.comment = '',
    this.createdAt,
    this.images = const [],
    this.optionNames = const [],
  });
  factory ServiceReview.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>? ?? {};
    return ServiceReview(
      id: json['_id'] as String,
      rating: (json['rating'] as num).toInt(),
      customerName: customer['fullName'] as String? ?? 'Khách hàng',
      avatar: customer['avatar'] as String?,
      comment: json['comment'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      images: (json['images'] as List<dynamic>? ?? [])
          .whereType<String>()
          .toList(),
      optionNames: (json['options'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map((option) => option['name'])
          .whereType<String>()
          .toList(),
    );
  }
  final String id, customerName, comment;
  final String? avatar;
  final int rating;
  final DateTime? createdAt;
  final List<String> images, optionNames;
}

typedef ServiceReviewQuery = ({
  String serviceId,
  int page,
  int? rating,
  bool hasImages,
  String keyword,
  String? optionId,
  bool positiveOnly,
});
