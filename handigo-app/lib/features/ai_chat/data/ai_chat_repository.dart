import '../../../core/network/api_client.dart';

class AiChatRepository {
  const AiChatRepository(this._api);
  final ApiClient _api;

  Future<Map<String, dynamic>?> latest() async {
    final response = await _api.request(
      '/ai/sessions/latest',
      authenticated: true,
    );
    return response['data'] as Map<String, dynamic>?;
  }

  Future<Map<String, dynamic>> send(Map<String, dynamic> request) async {
    final response = await _api.request(
      '/ai/messages',
      method: 'POST',
      data: request,
      authenticated: true,
      receiveTimeout: const Duration(seconds: 200),
    );
    return response['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> reset(String sessionId) async {
    final response = await _api.request(
      '/ai/sessions/reset',
      method: 'POST',
      data: {'sessionId': sessionId},
      authenticated: true,
    );
    return response['data'] as Map<String, dynamic>;
  }
}
