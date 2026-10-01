import 'package:flutter/foundation.dart';

abstract final class AppConfig {
  static String get apiBaseUrl {
    const configured = String.fromEnvironment('API_BASE_URL');
    final value = configured.isNotEmpty
        ? configured
        : defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:5000'
        : 'http://localhost:5000';
    return validateBaseUrl(value, release: kReleaseMode);
  }

  static String validateBaseUrl(String value, {required bool release}) {
    final uri = Uri.tryParse(value);
    if (uri == null || !uri.hasAuthority || uri.host.isEmpty ||
        uri.userInfo.isNotEmpty || uri.hasQuery || uri.hasFragment ||
        !['http', 'https'].contains(uri.scheme) ||
        (release && uri.scheme != 'https')) {
      throw const FormatException(
        'API_BASE_URL không hợp lệ. Bản phát hành phải sử dụng HTTPS.',
      );
    }
    return value.replaceFirst(RegExp(r'/+$'), '');
  }
}
