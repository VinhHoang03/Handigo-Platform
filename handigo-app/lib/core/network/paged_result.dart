class PagedResult<T> {
  const PagedResult({required this.items, required this.page, required this.totalPages});
  factory PagedResult.fromJson(Map<String, dynamic> json,
      T Function(Map<String, dynamic>) parse) {
    final pagination = json['pagination'] as Map<String, dynamic>?;
    return PagedResult(
      items: (json['items'] as List<dynamic>)
          .map((item) => parse(item as Map<String, dynamic>)).toList(),
      page: (pagination?['page'] as num?)?.toInt() ?? 1,
      totalPages: (pagination?['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
  final List<T> items;
  final int page;
  final int totalPages;
}
