import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient(this._dio, this._cookies) {
    // Trình duyệt tự quản lý cookie; dio_cookie_manager chỉ hỗ trợ native.
    if (!kIsWeb) _dio.interceptors.add(CookieManager(_cookies));
  }
  final Dio _dio;
  final CookieJar _cookies;
  String? _token;
  Future<void>? _refreshing;
  bool _loggingOut = false;
  void Function()? onSessionExpired;

  void setToken(String token) => _token = token;

  Future<bool> hasSession() async {
    // Cookie HttpOnly không thể đọc từ Web, nhưng sẽ được gửi tự động khi
    // request bật withCredentials.
    if (kIsWeb) return true;
    return (await _cookies.loadForRequest(
      Uri.parse('${_dio.options.baseUrl}/auth/refresh-token'),
    )).any((cookie) => cookie.name == 'refreshToken');
  }

  Future<void> clearSession() async {
    _token = null;
    await _cookies.deleteAll();
  }

  Future<void> refresh() async {
    if (_loggingOut) {
      throw const ApiException('Phiên làm việc đã kết thúc.', statusCode: 401);
    }
    if (_refreshing != null) return _refreshing!;
    final pending = _refresh();
    _refreshing = pending;
    try {
      await pending;
    } finally {
      _refreshing = null;
    }
  }

  Future<void> _refresh() async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh-token',
      );
      final token = response.data?['token'];
      if (token is! String || token.isEmpty) {
        throw const ApiException('Phản hồi đăng nhập không hợp lệ.');
      }
      _token = token;
    } on DioException catch (error) {
      if ([401, 403].contains(error.response?.statusCode)) {
        await clearSession();
        onSessionExpired?.call();
      }
      throw ApiException.fromDio(error);
    }
  }

  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    if (authenticated && _loggingOut) {
      throw const ApiException(
        'Đang kết thúc phiên làm việc.',
        statusCode: 401,
      );
    }
    final sentToken = _token;
    Future<Response<Map<String, dynamic>>> send() =>
        _dio.request<Map<String, dynamic>>(
          path,
          data: data,
          queryParameters: query,
          options: Options(
            method: method,
            receiveTimeout: receiveTimeout,
            headers: {
              if (authenticated && _token != null)
                'Authorization': 'Bearer $_token',
            },
          ),
        );
    try {
      return (await send()).data ?? <String, dynamic>{};
    } on DioException catch (error) {
      if (authenticated && error.response?.statusCode == 401) {
        if (_token == sentToken) await refresh();
        if (_loggingOut || _token == null) {
          throw const ApiException(
            'Phiên làm việc đã kết thúc.',
            statusCode: 401,
          );
        }
        try {
          return (await send()).data ?? <String, dynamic>{};
        } on DioException catch (retryError) {
          if (retryError.response?.statusCode == 401) {
            await clearSession();
            onSessionExpired?.call();
          }
          throw ApiException.fromDio(retryError);
        }
      }
      throw ApiException.fromDio(error);
    }
  }

  Future<MultipartFile> _imagePart(XFile file) async {
    final mimeType =
        file.mimeType ??
        switch (file.name.split('.').last.toLowerCase()) {
          'jpg' || 'jpeg' => 'image/jpeg',
          'png' => 'image/png',
          'webp' => 'image/webp',
          _ => throw const ApiException(
            'Vui lòng chọn ảnh JPG, PNG hoặc WebP.',
          ),
        };
    return MultipartFile.fromBytes(
      await file.readAsBytes(),
      filename: file.name,
      contentType: DioMediaType.parse(mimeType),
    );
  }

  Future<String> uploadOrderAttachment(XFile file) async {
    Future<String> send() async {
      final response = await _dio.post<Map<String, dynamic>>(
        '/orders/attachments',
        data: FormData.fromMap({'image': await _imagePart(file)}),
        options: Options(
          headers: {if (_token != null) 'Authorization': 'Bearer $_token'},
        ),
      );
      final data = response.data?['data'];
      if (data is! Map || data['url'] is! String) {
        throw const ApiException('Phản hồi tải ảnh không hợp lệ.');
      }
      return data['url'] as String;
    }

    try {
      return await send();
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        await refresh();
        try {
          return await send();
        } on DioException catch (retryError) {
          throw ApiException.fromDio(retryError);
        }
      }
      throw ApiException.fromDio(error);
    } on ApiException {
      rethrow;
    } on Exception catch (error) {
      throw ApiException(error.toString());
    }
  }

  Future<String> uploadProviderApplicationAsset(
    XFile file, {
    required String purpose,
    required String documentKind,
  }) async {
    Future<String> send() async {
      final response = await _dio.post<Map<String, dynamic>>(
        '/provider-application-assets/images',
        data: FormData.fromMap({
          'image': await _imagePart(file),
          'purpose': purpose,
          'documentKind': documentKind,
        }),
        options: Options(
          headers: {if (_token != null) 'Authorization': 'Bearer $_token'},
        ),
      );
      final data = response.data?['data'];
      if (data is! Map || data['url'] is! String) {
        throw const ApiException('Phản hồi tải giấy tờ không hợp lệ.');
      }
      return data['url'] as String;
    }

    try {
      return await send();
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        await refresh();
        return send();
      }
      throw ApiException.fromDio(error);
    } on ApiException {
      rethrow;
    } on Exception catch (error) {
      throw ApiException(error.toString());
    }
  }

  Future<void> logout() async {
    _loggingOut = true;
    try {
      if (_refreshing != null) await _refreshing;
      await request('/auth/logout', method: 'POST');
    } finally {
      try {
        await clearSession();
      } finally {
        _loggingOut = false;
      }
    }
  }

  void close() => _dio.close(force: true);
}
