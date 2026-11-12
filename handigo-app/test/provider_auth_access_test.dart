import 'dart:async';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/routing/app_router.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/core/network/realtime_connection.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/home/presentation/device_location_provider.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';
import 'package:handigo_app/features/provider_onboarding/presentation/provider_onboarding_screens.dart';

Map<String, dynamic> _user({
  String role = 'PROVIDER',
  String? status,
  String id = 'provider',
}) => {
  'id': id,
  'fullName': 'Đối tác kiểm thử',
  'email': 'provider@example.test',
  'role': role,
  'providerOnboardingStatus': status,
};

class _Api extends ApiClient {
  _Api(this.current) : super(Dio(), CookieJar());
  Map<String, dynamic> current;
  Completer<Map<String, dynamic>>? pendingMe;
  int meCalls = 0, applicationCalls = 0;
  bool failMe = false;

  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    if (path == '/auth/login') return {'user': current, 'token': 'test-token'};
    if (path == '/auth/me') {
      meCalls++;
      expect(authenticated, isTrue);
      if (failMe) throw const ApiException('Chưa tải được quyền tài khoản.');
      return pendingMe == null ? {'user': current} : await pendingMe!.future;
    }
    if (path == '/provider-applications/me') {
      applicationCalls++;
      return {
        'data': {'id': current['id'], 'status': 'approved'},
      };
    }
    throw const ApiException('Chưa có dữ liệu kiểm thử.');
  }
}

Future<({AuthController auth, GoRouter router, ProviderContainer container})>
_show(WidgetTester tester, _Api api) async {
  addTearDown(api.close);
  final auth = AuthController(AuthRepository(api), api);
  expect(
    await auth.login('provider@example.test', 'mật khẩu kiểm thử'),
    isTrue,
  );
  final container = ProviderContainer(
    retry: (_, _) => null,
    overrides: [
      apiClientProvider.overrideWithValue(api),
      authControllerProvider.overrideWith((ref) => auth),
      realtimeConnectionProvider.overrideWithValue(null),
      deviceLocationProvider.overrideWith(
        (ref) async => const DeviceLocationData(label: 'Đà Nẵng'),
      ),
      providerCurrentLocationProvider.overrideWith((ref) async {}),
      providerMessageBadgeProvider.overrideWith(
        (ref) async => (count: 0, latestAt: null),
      ),
      providerNotificationBadgeProvider.overrideWith(
        (ref) async => (count: 0, latestAt: null),
      ),
    ],
  );
  addTearDown(container.dispose);
  final router = container.read(appRouterProvider);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  return (auth: auth, router: router, container: container);
}

void main() {
  for (final status in <String?>[null, '', 'APPROVED']) {
    testWidgets('Provider trạng thái $status vào khu vực thợ như web', (
      tester,
    ) async {
      final h = await _show(tester, _Api(_user(status: status)));
      expect(h.router.routeInformationProvider.value.uri.path, '/provider');
      expect(h.auth.user!.canViewOrders, isTrue);
      expect(find.byType(ProviderShell), findsOneWidget);
    });
  }

  testWidgets('Provider thiếu trường trạng thái vẫn đăng nhập được', (
    tester,
  ) async {
    final json = _user()..remove('providerOnboardingStatus');
    final h = await _show(tester, _Api(json));
    expect(h.router.routeInformationProvider.value.uri.path, '/provider');
  });

  for (final status in ['PROFILE_INCOMPLETE', 'PENDING_REVIEW', 'REJECTED']) {
    testWidgets('Provider trạng thái $status không được vào khu vực thợ', (
      tester,
    ) async {
      final h = await _show(tester, _Api(_user(status: status)));
      expect(
        h.router.routeInformationProvider.value.uri.path,
        '/customer/provider-onboarding',
      );
      expect(h.auth.user!.canAccessProvider, isFalse);
      expect(h.auth.user!.canViewOrders, isFalse);
    });
  }

  testWidgets('Khách hàng có hồ sơ đã duyệt vẫn cần role từ backend', (
    tester,
  ) async {
    final h = await _show(
      tester,
      _Api(_user(role: 'CUSTOMER', status: 'APPROVED')),
    );
    expect(h.router.routeInformationProvider.value.uri.path, '/customer');
    expect(h.auth.user!.canAccessProvider, isFalse);
  });

  testWidgets('Hoàn tất hồ sơ đã duyệt tải quyền mới và thoát màn đăng ký', (
    tester,
  ) async {
    final api = _Api(_user(role: 'CUSTOMER', status: 'PENDING_REVIEW'));
    final h = await _show(tester, api);
    h.router.go('/customer/provider-onboarding');
    await tester.pumpAndSettle();
    expect(find.text('Hồ sơ đã được duyệt'), findsOneWidget);
    api.current = _user(status: 'APPROVED');
    await tester.tap(find.widgetWithText(FilledButton, 'Hoàn tất'));
    await tester.pumpAndSettle();
    expect(api.meCalls, 1);
    expect(h.auth.user!.canAccessProvider, isTrue);
    expect(h.router.routeInformationProvider.value.uri.path, '/provider');
  });

  testWidgets(
    'Không tự nâng quyền nếu backend chưa xác nhận hoặc tải quyền lỗi',
    (tester) async {
      final api = _Api(_user(role: 'CUSTOMER', status: 'PENDING_REVIEW'));
      final h = await _show(tester, api);
      h.router.go('/customer/provider-onboarding');
      await tester.pumpAndSettle();
      for (final fail in [false, true]) {
        api.failMe = fail;
        await tester.tap(find.widgetWithText(FilledButton, 'Hoàn tất'));
        await tester.pumpAndSettle();
        expect(h.auth.user!.canAccessProvider, isFalse);
        expect(
          h.router.routeInformationProvider.value.uri.path,
          '/customer/provider-onboarding',
        );
        expect(api.meCalls, fail ? 2 : 1);
        await tester.pump(const Duration(seconds: 5));
        await tester.pumpAndSettle();
      }
    },
  );

  test('Hồ sơ đăng ký tải lại khi đổi tài khoản', () async {
    final api = _Api(_user(id: 'first'));
    addTearDown(api.close);
    final auth = AuthController(AuthRepository(api), api);
    await auth.login('provider@example.test', 'mật khẩu kiểm thử');
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        authControllerProvider.overrideWith((ref) => auth),
      ],
    );
    addTearDown(container.dispose);
    expect(
      (await container.read(providerApplicationProvider.future))!.id,
      'first',
    );
    api.current = _user(id: 'second');
    await auth.login('provider@example.test', 'mật khẩu kiểm thử');
    await container.pump();
    expect(
      (await container.read(providerApplicationProvider.future))!.id,
      'second',
    );
    expect(api.applicationCalls, 2);
  });

  test(
    'Phản hồi tải quyền cũ không thay thế tài khoản vừa đăng nhập',
    () async {
      final api = _Api(_user(id: 'first'));
      addTearDown(api.close);
      final auth = AuthController(AuthRepository(api), api);
      addTearDown(auth.dispose);
      await auth.login('provider@example.test', 'mật khẩu kiểm thử');
      api.pendingMe = Completer();
      final refresh = auth.refreshUser();
      api.current = _user(id: 'second', role: 'CUSTOMER');
      await auth.login('provider@example.test', 'mật khẩu kiểm thử');
      api.pendingMe!.complete({'user': _user(id: 'first', status: 'APPROVED')});
      expect(await refresh, isFalse);
      expect(auth.user!.id, 'second');
      expect(auth.user!.role, UserRole.customer);
    },
  );
}
