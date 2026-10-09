import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/routing/app_router.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_screens.dart';
import 'package:handigo_app/main.dart';

class _RestoreRepository extends AuthRepository {
  _RestoreRepository(super.api, this.result);
  final Future<AppUser?> result;
  String? submittedEmail;
  String? submittedOtp;

  @override
  Future<AppUser?> restore() => result;

  @override
  Future<AppUser> login(String email, String password) async {
    submittedEmail = email;
    throw const ApiException(
      'Email hoặc mật khẩu không đúng.',
      statusCode: 401,
    );
  }

  @override
  Future<AppUser?> verifyRegisterOtp(String email, String otp) async {
    submittedOtp = otp;
    throw const ApiException('Mã OTP không đúng.', statusCode: 400);
  }
}

void main() {
  testWidgets('Đăng nhập dùng giao diện sáng khi hệ thống ở chế độ tối', (
    tester,
  ) async {
    tester.binding.platformDispatcher.platformBrightnessTestValue =
        Brightness.dark;
    addTearDown(
      tester.binding.platformDispatcher.clearPlatformBrightnessTestValue,
    );
    final api = ApiClient(Dio(), CookieJar());
    final repository = _RestoreRepository(api, Future<AppUser?>.value(null));
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authRepositoryProvider.overrideWithValue(repository),
      ],
    );
    addTearDown(container.dispose);
    addTearDown(api.close);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const HandigoApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(
      Theme.of(tester.element(find.byType(LoginScreen))).brightness,
      Brightness.light,
    );
    expect(tester.takeException(), isNull);
  });

  for (final scenario in <String, ApiException?>{
    'không có phiên đăng nhập': null,
    'cookie hết hạn': const ApiException('Phiên hết hạn.', statusCode: 401),
    'API không kết nối được': const ApiException('Không kết nối được máy chủ.'),
  }.entries) {
    testWidgets('Mở đăng nhập khi ${scenario.key}', (tester) async {
      final pending = Completer<AppUser?>();
      final api = ApiClient(Dio(), CookieJar());
      final repository = _RestoreRepository(api, pending.future);
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          authRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      addTearDown(api.close);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const HandigoApp(),
        ),
      );
      expect(find.byType(SplashScreen), findsOneWidget);

      if (scenario.value == null) {
        pending.complete(null);
      } else {
        pending.completeError(scenario.value!);
      }
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(SplashScreen), findsNothing);
      expect(tester.takeException(), isNull);
      if (scenario.value != null && scenario.value!.statusCode != 401) {
        expect(find.text(scenario.value!.message), findsOneWidget);
      }

      final router = container.read(appRouterProvider);
      router.go('/customer/orders');
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Đăng nhập'));
      await tester.pumpAndSettle();
      expect(find.text('Vui lòng nhập email hợp lệ'), findsOneWidget);
      expect(repository.submittedEmail, isNull);
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'flutter-test@example.invalid',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'MatKhau-Test-123!',
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Đăng nhập'));
      await tester.pumpAndSettle();
      expect(repository.submittedEmail, 'flutter-test@example.invalid');
      expect(find.text('Email hoặc mật khẩu không đúng.'), findsOneWidget);

      router.go('/register');
      await tester.pumpAndSettle();
      expect(find.byType(RegisterScreen), findsOneWidget);
      router.go('/forgot-password');
      await tester.pumpAndSettle();
      expect(find.byType(ForgotPasswordScreen), findsOneWidget);

      router.go('/register/otp?email=flutter-test@example.invalid');
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '123456');
      await tester.tap(find.widgetWithText(FilledButton, 'Xác thực'));
      await tester.pumpAndSettle();
      expect(repository.submittedOtp, '123456');
      expect(find.text('Mã OTP không đúng.'), findsOneWidget);
      expect(
        find.text('Email đã được xác thực. Bạn có thể đăng nhập.'),
        findsNothing,
      );

      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
}
