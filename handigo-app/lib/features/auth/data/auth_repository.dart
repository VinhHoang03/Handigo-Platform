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
