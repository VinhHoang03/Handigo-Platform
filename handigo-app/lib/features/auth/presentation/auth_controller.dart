import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../data/auth_repository.dart';
import '../domain/app_user.dart';

enum AuthStatus { initializing, unauthenticated, authenticated }

class AuthController extends ChangeNotifier {
  AuthController(this._repository, this._api);
  final AuthRepository _repository;
  final ApiClient _api;
  AuthStatus status = AuthStatus.initializing;
  AppUser? user;
  String? message;
  bool _initialized = false;
  bool get isAuthenticated =>
      status == AuthStatus.authenticated && user != null;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    _api.onSessionExpired = () {
      if (status == AuthStatus.initializing) return;
      user = null;
      status = AuthStatus.unauthenticated;
      message = 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
      notifyListeners();
    };
    try {
      user = await _repository.restore();
      status = user == null
          ? AuthStatus.unauthenticated
          : AuthStatus.authenticated;
    } on ApiException catch (error) {
      user = null;
      status = AuthStatus.unauthenticated;
      message = error.statusCode == 401 ? null : error.message;
    } on FormatException catch (error) {
      user = null;
      status = AuthStatus.unauthenticated;
      message = error.message;
    } catch (_) {
      user = null;
      status = AuthStatus.unauthenticated;
      message = 'Không thể khôi phục phiên làm việc. Vui lòng đăng nhập lại.';
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async => _run(() async {
    user = await _repository.login(email, password);
    status = AuthStatus.authenticated;
  });

  Future<bool> verifyRegisterOtp(String email, String otp) async =>
      _run(() async {
        final verifiedUser = await _repository.verifyRegisterOtp(email, otp);
        if (verifiedUser != null) {
          user = verifiedUser;
          status = AuthStatus.authenticated;
        }
      });

  Future<bool> _run(Future<void> Function() action) async {
    message = null;
    try {
      await action();
      notifyListeners();
      return true;
    } on ApiException catch (error) {
      message = error.message;
    } on FormatException catch (error) {
      message = error.message;
    } catch (_) {
      message = 'Đã xảy ra lỗi. Vui lòng thử lại.';
    }
    notifyListeners();
    return false;
  }

  void clearMessage() {
    if (message == null) return;
    message = null;
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await _repository.logout();
    } finally {
      user = null;
      status = AuthStatus.unauthenticated;
      message = null;
      notifyListeners();
    }
  }
}
