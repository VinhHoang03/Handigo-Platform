import 'package:flutter/foundation.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../../core/network/api_exception.dart';

enum SocialProvider {
  google('Google', '/auth/google-login', 'credential'),
  facebook('Facebook', '/auth/facebook-login', 'accessToken');

  const SocialProvider(this.label, this.path, this.tokenField);

  final String label;
  final String path;
  final String tokenField;

  static const _googleClientId = String.fromEnvironment(
    'GOOGLE_SERVER_CLIENT_ID',
  );
  static const _facebookAppId = String.fromEnvironment('FACEBOOK_APP_ID');
  static const _facebookClientToken = String.fromEnvironment(
    'FACEBOOK_CLIENT_TOKEN',
  );

  bool get isAvailable =>
      !kIsWeb &&
      defaultTargetPlatform == TargetPlatform.android &&
      switch (this) {
        google => _googleClientId.isNotEmpty,
        facebook =>
          _facebookAppId.isNotEmpty && _facebookClientToken.isNotEmpty,
      };
}

class SocialSignIn {
  bool _googleInitialized = false;

  Future<String?> authenticate(SocialProvider provider) async {
    try {
      return switch (provider) {
        SocialProvider.google => await _googleToken(),
        SocialProvider.facebook => await _facebookToken(),
      };
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
        'Không thể đăng nhập bằng ${provider.label}. Vui lòng thử lại.',
      );
    }
  }

  Future<String?> _googleToken() async {
    final google = GoogleSignIn.instance;
    if (!_googleInitialized) {
      await google.initialize(serverClientId: SocialProvider._googleClientId);
      _googleInitialized = true;
    }
    try {
      await google.signOut();
      final account = await google.authenticate();
      final token = account.authentication.idToken;
      if (token != null && token.isNotEmpty) return token;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) return null;
      rethrow;
    }
    throw const ApiException('Google không cung cấp mã xác thực.');
  }

  Future<String?> _facebookToken() async {
    final facebook = FacebookAuth.instance;
    await facebook.logOut();
    final result = await facebook.login(
      permissions: const ['public_profile', 'email'],
      loginTracking: LoginTracking.enabled,
    );
    if (result.status == LoginStatus.cancelled) return null;
    final token = result.accessToken;
    if (result.status == LoginStatus.success &&
        token is ClassicToken &&
        token.tokenString.isNotEmpty) {
      return token.tokenString;
    }
    throw const ApiException(
      'Không thể đăng nhập bằng Facebook. Vui lòng thử lại.',
    );
  }
}
