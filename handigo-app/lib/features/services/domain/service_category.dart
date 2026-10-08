class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.name,
    required this.slug,
    this.icon,
    this.iconColor,
  });

  factory ServiceCategory.fromJson(Map<String, dynamic> json) {
    return ServiceCategory(
      id: (json['_id'] ?? json['id']) as String,
      name: json['name'] as String,
      slug: json['slug'] as String,
      icon: json['icon'] as String?,
      iconColor: json['iconColor'] as String?,
    );
  }

  final String id;
  final String name;
  final String slug;
  final String? icon;
  final String? iconColor;
}
