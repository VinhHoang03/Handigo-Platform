import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/provider/data/provider_location_service.dart';
import 'package:handigo_app/features/provider/domain/provider_models.dart';
import 'package:handigo_app/features/provider/presentation/provider_location_gate.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';

class _Tracker extends ProviderLocationService {
  _Tracker(super.api);
  int starts = 0, stops = 0, refreshes = 0;
  bool Function()? allowed;
  @override
  void start({required bool Function() shouldUpload}) {
    starts++;
    allowed = shouldUpload;
  }

  @override
  void stop() {
    stops++;
  }

  @override
  Future<void> check({bool force = false}) async {
    if (force) refreshes++;
  }
}

AppUser _user(String id, {UserRole role = UserRole.provider}) => AppUser(
  id: id,
  fullName: 'Đối tác kiểm thử',
  email: 'test@example.test',
  role: role,
  providerOnboardingStatus: 'APPROVED',
);

void main() {
  testWidgets(
    'Theo dõi khi online, dừng offline và không sống sót sau đăng xuất',
    (tester) async {
      final api = ApiClient(Dio(), CookieJar());
      final tracker = _Tracker(api);
      var online = true;
      final auth = AuthController(AuthRepository(api), api)
        ..user = _user('provider')
        ..status = AuthStatus.authenticated;
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith((ref) => auth),
          providerLocationServiceProvider.overrideWith((ref) => tracker),
          providerOverviewProvider.overrideWith(
            (ref) async => ProviderOverview.fromJson({
              'availabilityStatus': online ? 'online' : 'offline',
            }),
          ),
        ],
      );
      addTearDown(container.dispose);
      addTearDown(api.close);
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: ProviderLocationGate(
              child: Scaffold(body: Text('Màn bất kỳ')),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tracker.starts, 1);
      expect(tracker.allowed!(), isTrue);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      expect(tracker.stops, 0);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(tracker.refreshes, 1);
      online = false;
      container.invalidate(providerOverviewProvider);
      await tester.pumpAndSettle();
      expect(tracker.stops, greaterThanOrEqualTo(1));
      expect(tracker.allowed!(), isFalse);
      online = true;
      container.invalidate(providerOverviewProvider);
      await tester.pumpAndSettle();
      expect(tracker.allowed!(), isTrue);
      final oldSession = tracker.allowed!;
      auth.user = null;
      auth.status = AuthStatus.unauthenticated;
      auth.notifyListeners();
      await tester.pumpAndSettle();
      expect(oldSession(), isFalse);
      expect(find.text('Màn bất kỳ'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('Khách hàng không khởi động theo dõi provider', (tester) async {
    final api = ApiClient(Dio(), CookieJar());
    final tracker = _Tracker(api);
    final container = ProviderContainer(
      overrides: [
        authControllerProvider.overrideWith(
          (ref) => AuthController(AuthRepository(api), api)
            ..user = _user('customer', role: UserRole.customer)
            ..status = AuthStatus.authenticated,
        ),
        providerLocationServiceProvider.overrideWith((ref) => tracker),
      ],
    );
    addTearDown(container.dispose);
    addTearDown(api.close);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: ProviderLocationGate(child: Scaffold())),
      ),
    );
    await tester.pumpAndSettle();
    expect(tracker.starts, 0);
    await tester.pumpWidget(const SizedBox.shrink());
    tracker.dispose();
  });
}
