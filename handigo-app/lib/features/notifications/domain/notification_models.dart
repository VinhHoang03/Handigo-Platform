import '../../../core/network/paged_result.dart';

class AppNotification {
  const AppNotification({required this.id, required this.title, required this.content,
    required this.type, required this.isRead, this.createdAt, this.data});
  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
    id: (json['id'] ?? json['_id']) as String,
    title: json['title'] as String? ?? 'Thông báo', content: json['content'] as String? ?? '',
    type: json['type'] as String? ?? 'SYSTEM', isRead: json['isRead'] as bool? ?? false,
    createdAt: json['createdAt'] is String ? DateTime.tryParse(json['createdAt'] as String) : null,
    data: json['data'] is Map ? Map<String, dynamic>.from(json['data'] as Map) : null,
  );
  final String id, title, content, type;
  final bool isRead;
  final DateTime? createdAt;
  final Map<String, dynamic>? data;
}

typedef NotificationPage = PagedResult<AppNotification>;
