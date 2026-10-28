import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/routing/app_router.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/home/presentation/customer_shell.dart';
import 'package:handigo_app/features/home/presentation/device_location_provider.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';
import 'package:handigo_app/shared/widgets/app_feedback.dart';
import 'package:handigo_app/shared/widgets/customer_page_header.dart';

class _Api extends ApiClient {
  _Api() : super(Dio(), CookieJar());
  @override
  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? data,
    Map<String, dynamic>? query,
    bool authenticated = false,
    Duration? receiveTimeout,
  }) async => throw const ApiException('Chưa có dữ liệu kiểm thử.');
}

Future<GoRouter> _show(WidgetTester tester, UserRole role) async {
  FlutterSecureStorage.setMockInitialValues({});
  final api = _Api();
  final auth = AuthController(AuthRepository(api), api)
    ..status = AuthStatus.authenticated
    ..user = AppUser(
      id: 'user',
      fullName: 'Nguyễn An',
      email: 'an@example.com',
      role: role,
      providerOnboardingStatus: 'APPROVED',
    );
  final container = ProviderContainer(
    retry: (_, _) => null,
    overrides: [
      apiClientProvider.overrideWithValue(api),
      authControllerProvider.overrideWith((ref) => auth),
      deviceLocationProvider.overrideWith(
        (ref) async => const DeviceLocationData(label: 'An Hải, Đà Nẵng'),
      ),
      providerCurrentLocationProvider.overrideWith((ref) async {}),
      orderDetailProvider('order').overrideWith(
        (ref) async => const OrderDetail(
          id: 'order',
          code: 'ORD-001',
          serviceName: 'Vệ sinh điều hòa',
          status: 'cancelled',
          paymentStatus: 'refunded',
          paymentMethod: 'wallet',
          orderType: 'immediate',
        ),
      ),
      orderQuotationProvider('order').overrideWith((ref) async => null),
    ],
  );
  addTearDown(container.dispose);
  addTearDown(api.close);
  final router = container.read(appRouterProvider);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

Finder _tab(String label) =>
    find.descendant(of: find.byType(SafeArea), matching: find.text(label)).last;

void main() {
  testWidgets(
    'Trang chủ dùng header vị trí, các tab còn lại dùng header trang',
    (tester) async {
      await _show(tester, UserRole.customer);

      final homeHeader = find.byType(CustomerAppBar);
      expect(homeHeader, findsOneWidget);
      expect(tester.getSize(homeHeader).height, 64);
      expect(find.text('VỊ TRÍ HIỆN TẠI'), findsOneWidget);
      expect(find.text('An Hải, Đà Nẵng'), findsOneWidget);
      expect(find.text('Handigo'), findsOneWidget);
      expect(find.text('Trang chủ'), findsOneWidget);
      expect(find.byIcon(Icons.keyboard_arrow_down_rounded), findsNothing);
      final homeAppBar = tester.widget<AppBar>(find.byType(AppBar).first);
      expect(homeAppBar.automaticallyImplyLeading, isFalse);
      expect(tester.takeException(), isNull);

      for (final entry in const [
        ('Đơn hàng', 'Lịch sử đơn hàng', false),
        ('Tin nhắn', 'Đoạn chat', false),
        ('Tài khoản', 'Tài khoản & Cài đặt', true),
      ]) {
        await tester.tap(_tab(entry.$1));
        await tester.pumpAndSettle();
        final header = find.byType(CustomerPageHeader);
        final title = find.descendant(
          of: header,
          matching: find.text(entry.$2),
        );
        expect(header, findsOneWidget);
        expect(title, findsOneWidget);
        expect(tester.getSize(header).height, 64);
        expect(tester.widget<CustomerPageHeader>(header).centerTitle, entry.$3);
        expect(
          tester.widget<CustomerPageHeader>(header).backgroundColor,
          Colors.white,
        );
        expect(
          tester
              .widget<AppBar>(
                find.descendant(of: header, matching: find.byType(AppBar)),
              )
              .centerTitle,
          entry.$3,
        );
        if (entry.$1 == 'Tài khoản') {
          expect(
            tester.widget<CustomerPageHeader>(header).automaticallyImplyLeading,
            isFalse,
          );
          expect(find.byTooltip('Quay lại'), findsNothing);
        }
        final style = tester.widget<Text>(title).style;
        expect(style?.fontSize, 22);
        expect(style?.fontWeight, FontWeight.w800);
        expect(tester.takeException(), isNull);
      }
    },
  );

  testWidgets('Header customer tăng chiều cao theo cỡ chữ', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 800);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(2)),
          child: child!,
        ),
        home: Builder(
          builder: (context) => Scaffold(
            appBar: CustomerPageHeader(
              title: 'Lịch sử đơn hàng',
              toolbarHeight: 64 * MediaQuery.textScalerOf(context).scale(1),
              centerTitle: false,
              leading: const Icon(Icons.receipt_long_outlined),
              actions: const [SizedBox(width: 48)],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byType(CustomerPageHeader)).height, 128);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Nhấn cụm vị trí sẽ yêu cầu tải lại GPS', (tester) async {
    var reloadCount = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          appBar: CustomerAppBar(
            toolbarHeight: 64,
            unreadCount: 0,
            locationLabel: 'Chưa lấy được địa chỉ',
            onReloadLocation: () => reloadCount++,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Chưa lấy được địa chỉ'));
    await tester.pump();
    expect(reloadCount, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Khách hàng luôn có thanh menu khi vào trang con và quay lại', (
    tester,
  ) async {
    final router = await _show(tester, UserRole.customer);
    for (final path in [
      '/customer/orders/order',
      '/customer/profile',
      '/customer/wallet',
      '/customer/services/service',
      '/customer/chat',
    ]) {
      router.push(path);
      await tester.pumpAndSettle();
      for (final label in ['Trang chủ', 'Đơn hàng', 'Tin nhắn', 'Tài khoản']) {
        expect(_tab(label).hitTestable(), findsOneWidget);
      }
      router.pop();
      await tester.pumpAndSettle();
      expect(_tab('Trang chủ').hitTestable(), findsOneWidget);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('Trang mở bằng Navigator giữ menu và giữ trang khi chuyển tab', (
    tester,
  ) async {
    final router = await _show(tester, UserRole.customer);
    router.go('/customer/orders/order');
    await tester.pumpAndSettle();
    final context = tester.element(find.byType(OrderDetailScreen));
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            const Scaffold(body: Center(child: Text('Trang phụ kiểm thử'))),
      ),
    );
    await tester.pumpAndSettle();
    expect(_tab('Trang chủ').hitTestable(), findsOneWidget);
    await tester.tap(_tab('Tài khoản'));
    await tester.pumpAndSettle();
    await tester.tap(_tab('Đơn hàng'));
    await tester.pumpAndSettle();
    expect(find.text('Trang phụ kiểm thử'), findsOneWidget);
    router.pop();
    await tester.pumpAndSettle();
    expect(find.byType(OrderDetailScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Modal phủ menu và đóng modal khôi phục tương tác thanh menu', (
    tester,
  ) async {
    final router = await _show(tester, UserRole.customer);
    router.go('/customer/orders/order');
    await tester.pumpAndSettle();
    final context = tester.element(find.byType(OrderDetailScreen));
    AppBottomSheet.show<void>(
      context,
      builder: (context) => SizedBox(
        height: 250,
        child: Center(
          child: TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng modal'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(_tab('Trang chủ').hitTestable(), findsNothing);
    await tester.tap(find.text('Đóng modal'));
    await tester.pumpAndSettle();
    expect(_tab('Trang chủ').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Thợ giữ thanh menu ở các trang chi tiết, ví, hồ sơ, tin nhắn', (
    tester,
  ) async {
    final router = await _show(tester, UserRole.provider);
    for (final path in [
      '/provider/orders/order',
      '/provider/wallet',
      '/provider/profile',
      '/provider/chat',
      '/provider/schedule',
    ]) {
      router.push(path);
      await tester.pumpAndSettle();
      for (final label in ['Tổng quan', 'Đơn hàng', 'Lịch hẹn', 'Tài khoản']) {
        expect(_tab(label).hitTestable(), findsOneWidget);
      }
      router.pop();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }
  });
}
