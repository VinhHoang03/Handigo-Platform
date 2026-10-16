import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/presentation/auth_screens.dart';

class _AuthRepositoryFake extends AuthRepository {
  _AuthRepositoryFake() : super(ApiClient(Dio(), CookieJar()));
  bool rejectOtp = true;
  int passwordResets = 0;
  int resetOtpRequests = 0;
  int registerOtpRequests = 0;

  @override
  Future<void> forgotPassword(String email) async {
    resetOtpRequests++;
  }

  @override
  Future<void> resendRegisterOtp(String email) async {
    registerOtpRequests++;
  }

  @override
  Future<void> verifyResetPasswordOtp(String email, String otp) async {
    if (rejectOtp) throw const ApiException('Mã OTP không hợp lệ');
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    passwordResets++;
  }
}

void main() {
  testWidgets(
    'Mã hết hạn không thể xác thực và gửi lại dùng đúng luồng reset',
    (tester) async {
      final repository = _AuthRepositoryFake();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [authRepositoryProvider.overrideWithValue(repository)],
          child: MaterialApp(
            home: OtpScreen(
              email: 'ban@example.com',
              mode: OtpMode.resetPassword,
              expiresAt: DateTime.now().subtract(const Duration(seconds: 1)),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(
        find.text('Mã OTP đã hết hạn. Vui lòng gửi lại mã.'),
        findsOneWidget,
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      await tester.ensureVisible(find.text('Gửi lại mã OTP'));
      await tester.tap(find.text('Gửi lại mã OTP'));
      await tester.pump();
      expect(repository.resetOtpRequests, 1);
      expect(repository.registerOtpRequests, 0);
      expect(find.text('Gửi lại mã OTP sau 60s'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNotNull,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'Chỉ mở form mật khẩu khi server xác thực OTP và kiểm tra mật khẩu xác nhận',
    (tester) async {
      final repository = _AuthRepositoryFake();
      final router = GoRouter(
        initialLocation: '/otp',
        routes: [
          GoRoute(
            path: '/otp',
            builder: (_, _) => const OtpScreen(
              email: 'ban@example.com',
              mode: OtpMode.resetPassword,
            ),
          ),
          GoRoute(
            path: '/forgot-password/new-password',
            builder: (_, state) => ResetPasswordScreen(
              arguments: state.extra as ResetPasswordArguments,
            ),
          ),
          GoRoute(
            path: '/login',
            builder: (_, _) => const Scaffold(body: Text('Trang đăng nhập')),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [authRepositoryProvider.overrideWithValue(repository)],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(TextFormField), findsNothing);
      await tester.enterText(find.byType(TextField).first, '123456');
      await tester.pump();
      await tester.ensureVisible(find.text('Xác thực mã OTP').last);
      await tester.tap(find.text('Xác thực mã OTP').last);
      await tester.pumpAndSettle();
      expect(find.byType(ResetPasswordScreen), findsNothing);
      expect(find.text('Mã OTP không hợp lệ'), findsOneWidget);
      repository.rejectOtp = false;
      await tester.tap(find.text('Xác thực mã OTP').last);
      await tester.pumpAndSettle();
      expect(find.byType(ResetPasswordScreen), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).first, 'Matkhau123');
      await tester.enterText(find.byType(TextFormField).last, 'Khongkhop123');
      await tester.ensureVisible(
        find.widgetWithText(FilledButton, 'Đặt lại mật khẩu'),
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Đặt lại mật khẩu'));
      await tester.pump();
      expect(find.text('Mật khẩu xác nhận không khớp'), findsOneWidget);
      expect(repository.passwordResets, 0);
      await tester.enterText(find.byType(TextFormField).last, 'Matkhau123');
      await tester.ensureVisible(
        find.widgetWithText(FilledButton, 'Đặt lại mật khẩu'),
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Đặt lại mật khẩu'));
      await tester.pumpAndSettle();
      expect(repository.passwordResets, 1);
      expect(find.text('Trang đăng nhập'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
    },
  );
}
