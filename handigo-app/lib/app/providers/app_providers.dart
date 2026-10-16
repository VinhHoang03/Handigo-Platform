import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import '../../core/config/app_config.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/secure_cookie_storage.dart';
import '../../features/auth/data/auth_repository.dart';
import '../../features/auth/presentation/auth_controller.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final api = ApiClient(
    Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        sendTimeout: const Duration(seconds: 20),
        contentType: Headers.jsonContentType,
        responseType: ResponseType.json,
        extra: const {'withCredentials': true},
      ),
    ),
    kIsWeb
        ? CookieJar()
        : PersistCookieJar(storage: SecureCookieStorage(AppConfig.apiBaseUrl)),
  );
  ref.onDispose(api.close);
  return api;
});

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);

final authControllerProvider = ChangeNotifierProvider<AuthController>((ref) {
  final controller = AuthController(
    ref.watch(authRepositoryProvider),
    ref.watch(apiClientProvider),
  );
  controller.initialize();
  return controller;
});
