import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/features/provider_onboarding/domain/provider_application_models.dart';
import 'package:handigo_app/features/provider_onboarding/presentation/provider_onboarding_screens.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  Map<String, dynamic>? saved;
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async {
    expect(path, '/provider-applications/me/draft');
    expect(method, 'PATCH');
    saved = data;
    return {
      'data': {'_id': 'draft', 'status': 'draft', ...?data},
    };
  }
}

void main() {
  for (final (width, scale) in [
    (320.0, 1.0),
    (390.0, 1.0),
    (320.0, 2.0),
    (390.0, 2.0),
  ]) {
    testWidgets(
      'Đăng ký thợ đi thẳng từ dịch vụ đến hồ sơ ở $width px, chữ $scale',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 844);
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        final api = _Api();
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              apiClientProvider.overrideWithValue(api),
              providerApplicationProvider.overrideWith(
                (ref) async => const ProviderApplication(
                  id: 'draft',
                  status: 'draft',
                  serviceIds: ['service'],
                  onboardingStep: 1,
                ),
              ),
              serviceCatalogServicesProvider(null).overrideWith(
                (ref) async => const PagedResult<Service>(
                  items: [],
                  page: 1,
                  totalPages: 1,
                ),
              ),
            ],
            child: MaterialApp(
              theme: AppTheme.light,
              home: const ProviderOnboardingScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('BƯỚC 1/2'), findsOneWidget);
        await tester.tap(find.text('Lưu nháp'));
        await tester.pumpAndSettle();
        expect(api.saved, isNotNull);
        expect(api.saved!.containsKey('workingAreas'), isFalse);
        await tester.pump(const Duration(seconds: 5));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Tiếp tục'));
        await tester.pumpAndSettle();
        expect(find.text('BƯỚC 2/2'), findsOneWidget);
        expect(find.text('Xác thực hồ sơ'), findsOneWidget);
        expect(find.text('Khu vực hoạt động'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('Bản nháp cũ ở bước 3 mở lại ở bước hồ sơ', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(_Api()),
          providerApplicationProvider.overrideWith(
            (ref) async => ProviderApplication.fromJson({
              '_id': 'draft',
              'status': 'draft',
              'onboardingStep': 3,
              'workingAreas': ['Dữ liệu cũ'],
            }),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: const ProviderOnboardingScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('BƯỚC 2/2'), findsOneWidget);
    expect(find.text('Xác thực hồ sơ'), findsOneWidget);
    expect(find.text('Khu vực hoạt động'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
