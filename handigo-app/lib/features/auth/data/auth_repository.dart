import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../domain/app_user.dart';

class AuthRepository {
  const AuthRepository(this._api);
  final ApiClient _api;

  Future<AppUser?> restore() async {
    if (!await _api.hasSession()) return null;
    await _api.refresh();
    final json = await _api.request('/auth/me', authenticated: true);
    return _mobileUser(json['user'] as Map<String, dynamic>);
  }

  Future<AppUser> login(String email, String password) async {
    final json = await _api.request('/auth/login', method: 'POST', data: {
      'email': email.trim().toLowerCase(), 'password': password, 'remember': true,
    });
    final user = await _mobileUser(json['user'] as Map<String, dynamic>);
    _api.setToken(json['token'] as String);
    return user;
  }

  Future<void> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
    UserRole registrationType = UserRole.customer,
  }) async {
    await _api.request('/auth/register', method: 'POST', data: {
      'email': email.trim().toLowerCase(),
      'password': password,
      'fullName': fullName.trim(),
      if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      'registrationType': registrationType == UserRole.provider ? 'PROVIDER' : 'CUSTOMER',
    });
  }

  Future<AppUser?> verifyRegisterOtp(String email, String otp) async {
    final json = await _api.request('/auth/verify-register-otp', method: 'POST', data: {
      'email': email.trim().toLowerCase(),
      'otp': otp.trim(),
    });
    final rawUser = json['user'];
    final token = json['token'];
    if (rawUser is! Map<String, dynamic> || token is! String || token.isEmpty) return null;
    final user = await _mobileUser(rawUser);
    _api.setToken(token);
    return user;
  }

  Future<void> resendRegisterOtp(String email) async {
    await _api.request('/auth/resend-register-otp', method: 'POST', data: {'email': email.trim().toLowerCase()});
  }

  Future<void> forgotPassword(String email) async {
    await _api.request('/auth/forgot-password', method: 'POST', data: {'email': email.trim().toLowerCase()});
  }

  Future<void> resetPassword({required String email, required String otp, required String newPassword}) async {
    await _api.request('/auth/reset-password', method: 'POST', data: {
      'email': email.trim().toLowerCase(), 'otp': otp.trim(), 'newPassword': newPassword,
    });
  }

  Future<void> verifyResetPasswordOtp(String email, String otp) async {
    await _api.request('/auth/verify-reset-password-otp', method: 'POST', data: {
      'email': email.trim().toLowerCase(), 'otp': otp.trim(),
    });
  }

  Future<AppUser> _mobileUser(Map<String, dynamic> json) async {
    final user = AppUser.fromJson(json);
    if (user.role == UserRole.admin) {
      try { await _api.logout(); } on ApiException { /* Phiên cục bộ đã được xóa. */ }
      throw const ApiException('Tài khoản quản trị vui lòng sử dụng Handigo trên web.');
    }
    return user;
  }

  Future<void> logout() => _api.logout();
}
