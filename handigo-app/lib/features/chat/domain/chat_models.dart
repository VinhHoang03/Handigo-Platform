import '../../../core/network/paged_result.dart';

class Conversation {
  const Conversation({required this.id, required this.orderId, required this.orderCode,
    required this.title, this.lastMessage, this.updatedAt, this.avatar,
    this.lastMessageAt, this.lastMessageSenderId});
  factory Conversation.fromJson(Map<String, dynamic> json, {String? currentUserId}) {
    final order = json['orderId'];
    final customer = json['customerId'];
    final provider = json['providerId'];
    final providerUser = provider is Map<String, dynamic> ? provider['userId'] : null;
    final customerIsCurrent = customer is Map<String, dynamic> &&
        customer['_id']?.toString() == currentUserId;
    final user = currentUserId == null
        ? providerUser
        : customerIsCurrent
            ? providerUser
            : customer;
    final lastMessage = json['lastMessage'] as Map<String, dynamic>?;
    return Conversation(
      id: (json['_id'] ?? json['id']) as String,
      orderId: order is Map<String, dynamic> ? (order['_id'] ?? order['id']) as String : order.toString(),
      orderCode: order is Map<String, dynamic> ? order['orderCode'] as String? ?? '' : '',
      title: user is Map<String, dynamic> ? user['fullName'] as String? ?? 'Người dùng' : 'Người dùng',
      avatar: user is Map<String, dynamic> ? user['avatar'] as String? : null,
      lastMessage: lastMessage?['content'] as String?,
      updatedAt: json['updatedAt'] is String ? DateTime.tryParse(json['updatedAt'] as String) : null,
      lastMessageAt: lastMessage?['sentAt'] is String ? DateTime.tryParse(lastMessage!['sentAt'] as String) : null,
      lastMessageSenderId: lastMessage?['senderId']?.toString(),
    );
  }
  final String id, orderId, orderCode, title;
  final String? lastMessage;
  final DateTime? updatedAt;
  final String? avatar;
  final DateTime? lastMessageAt;
  final String? lastMessageSenderId;
}

class ChatMessage {
  const ChatMessage({required this.id, required this.content, required this.isMine,
    required this.messageType, this.createdAt});
  factory ChatMessage.fromJson(Map<String, dynamic> json, String currentUserId) {
    final sender = json['senderId'];
    final senderId = sender is Map<String, dynamic> ? sender['_id'] ?? sender['id'] : sender;
    return ChatMessage(
      id: (json['_id'] ?? json['id']) as String,
      content: (json['content'] ?? json['imageUrl'] ?? '') as String,
      isMine: senderId?.toString() == currentUserId,
      messageType: json['messageType'] as String? ?? 'text',
      createdAt: json['createdAt'] is String ? DateTime.tryParse(json['createdAt'] as String) : null,
    );
  }
  final String id, content, messageType;
  final bool isMine;
  final DateTime? createdAt;
}

typedef ConversationPage = PagedResult<Conversation>;
