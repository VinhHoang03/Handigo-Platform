import 'dart:convert';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Lưu cookie trong kho bảo mật, tách biệt theo máy chủ API.
class SecureCookieStorage implements Storage {
  SecureCookieStorage(String baseUrl, {FlutterSecureStorage? storage})
    : _prefix = 'handigo.cookies.${base64Url.encode(utf8.encode(baseUrl))}.',
      _storage = storage ?? const FlutterSecureStorage();
  final String _prefix;
  final FlutterSecureStorage _storage;

  @override
  Future<void> init(bool persistSession, bool ignoreExpires) async {}
  @override
  Future<String?> read(String key) => _storage.read(key: '$_prefix$key');
  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: '$_prefix$key', value: value);
  @override
  Future<void> delete(String key) => _storage.delete(key: '$_prefix$key');
  @override
  Future<void> deleteAll(List<String> keys) async {
    final values = await _storage.readAll();
    for (final key in values.keys.where((key) => key.startsWith(_prefix))) {
      await _storage.delete(key: key);
    }
  }
}
