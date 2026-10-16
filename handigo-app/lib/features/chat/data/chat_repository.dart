import '../../../core/network/api_client.dart';
import '../../../core/network/paged_result.dart';
import '../domain/chat_models.dart';

class ChatRepository {
  const ChatRepository(this._api);
  final ApiClient _api;
  Future<PagedResult<Conversation>> conversations({String? currentUserId}) async {
    final response = await _api.request('/chat/conversations', query: {'page': 1, 'limit': 50}, authenticated: true);
    return PagedResult.fromJson(response['data'] as Map<String, dynamic>, (json) => Conversation.fromJson(json, currentUserId: currentUserId));
  }
  Future<Conversation> conversationForOrder(String orderId) async {
    final response = await _api.request('/chat/orders/$orderId/conversation', authenticated: true);
    return Conversation.fromJson(response['data'] as Map<String, dynamic>);
  }
  Future<PagedResult<ChatMessage>> messages(String id, String userId) async {
    final response = await _api.request('/chat/conversations/$id/messages', query: {'page': 1, 'limit': 100}, authenticated: true);
    final data = response['data'] as Map<String, dynamic>;
    return PagedResult.fromJson(data, (json) => ChatMessage.fromJson(json, userId));
  }
  Future<void> send(String id, String content) async => _api.request(
    '/chat/conversations/$id/messages', method: 'POST', data: {'messageType': 'text', 'content': content}, authenticated: true,
  );
  Future<void> seen(String id) async => _api.request('/chat/conversations/$id/seen', method: 'PATCH', authenticated: true);
}
