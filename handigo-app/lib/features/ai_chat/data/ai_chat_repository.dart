import '../../../core/network/api_client.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/network/api_exception.dart';

class AiChatRepository {
  const AiChatRepository(this._api);
  final ApiClient _api;

  Future<Map<String, dynamic>> history(int page) async {
    final response = await _api.request(
      '/ai/sessions',
      query: {'page': page, 'limit': 20},
      authenticated: true,
    );
    return response['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getSession(String sessionId) async {
    final response = await _api.request(
      '/ai/sessions/$sessionId',
      authenticated: true,
    );
    return response['data'] as Map<String, dynamic>;
  }

  Future<String> uploadAttachment(String sessionId, XFile file) async {
    if (await file.length() > 5 * 1024 * 1024) {
      throw const ApiException('Ảnh không được vượt quá 5 MB.');
    }
    final type = file.mimeType;
    final extension = file.name.split('.').last.toLowerCase();
    if (type != null
        ? ![
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
          ].contains(type)
        : !['jpg', 'jpeg', 'png', 'webp'].contains(extension)) {
      throw const ApiException('Vui lòng chọn ảnh JPG, PNG hoặc WebP.');
    }
    final data = await _api.uploadImages(
      '/ai/sessions/$sessionId/attachments',
      [file],
      field: 'image',
    );
    return (data as Map<String, dynamic>)['url'] as String;
  }

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
