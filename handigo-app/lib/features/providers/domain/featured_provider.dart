class FeaturedProvider {
  const FeaturedProvider({
    required this.id,
    required this.fullName,
    required this.services,
    required this.averageRating,
    required this.totalFeedbacks,
    this.avatar,
    this.gender,
    this.distanceMeters,
  });

  factory FeaturedProvider.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? const {};
    final services = json['services'] as List<dynamic>? ?? const [];
    return FeaturedProvider(
      id: json['id'] as String,
      fullName: user['fullName'] as String? ?? 'Nhà cung cấp',
      avatar: user['avatar'] as String?,
      gender: user['gender'] as String?,
      services: services
          .whereType<Map<String, dynamic>>()
          .map((item) => item['name'] as String? ?? '')
          .where((name) => name.isNotEmpty)
          .toList(),
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      totalFeedbacks: (json['totalFeedbacks'] as num?)?.toInt() ?? 0,
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
    );
  }

  final String id;
  final String fullName;
  final String? avatar;
  final String? gender;
  final List<String> services;
  final double averageRating;
  final int totalFeedbacks;
  final double? distanceMeters;
}
