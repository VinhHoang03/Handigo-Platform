import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/account/domain/account_models.dart';
import 'package:handigo_app/features/auth/data/auth_repository.dart';
import 'package:handigo_app/features/auth/domain/app_user.dart';
import 'package:handigo_app/features/auth/presentation/auth_controller.dart';
import 'package:handigo_app/features/orders/domain/order_summary.dart';
import 'package:handigo_app/features/orders/presentation/order_screens.dart';
import 'package:handigo_app/features/provider/data/provider_repository.dart';
import 'package:handigo_app/features/provider/domain/provider_models.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';
import 'package:handigo_app/features/provider/presentation/provider_account_screens.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_detail_screen.dart';

final previewKey = GlobalKey();
const overview = ProviderOverview(
  walletBalance: 2450000,
  monthlyEarnings: 12500000,
  completedOrders: 128,
  averageRating: 4.9,
  availabilityStatus: 'online',
  pendingWithdrawals: 1,
  pendingBalance: 350000,
);
final today = DateUtils.dateOnly(DateTime.now());
final orders = [
  OrderSummary(
    id: 'accepted',
    code: 'HDG-001',
    serviceName: 'Vệ sinh máy lạnh',
    status: 'accepted',
    scheduledAt: today.add(const Duration(hours: 9)),
    addressLabel: 'Phường Tân Phong, Thành phố Hồ Chí Minh',
    totalAmount: 350000,
  ),
  OrderSummary(
    id: 'progress',
    code: 'HDG-002',
    serviceName: 'Sửa đường nước',
    status: 'in_progress',
    scheduledAt: today.add(const Duration(hours: 14)),
    addressLabel: 'Địa chỉ thực hiện dịch vụ cần hiển thị trên màn hình nhỏ',
    totalAmount: 150000,
  ),
  OrderSummary(
    id: 'tomorrow',
    code: 'HDG-003',
    serviceName: 'Bảo dưỡng máy giặt',
    status: 'accepted',
    scheduledAt: today.add(const Duration(days: 1, hours: 10)),
  ),
  OrderSummary(
    id: 'cancelled',
    code: 'HDG-004',
    serviceName: 'Đơn đã hủy',
    status: 'cancelled',
    scheduledAt: today.add(const Duration(hours: 16)),
  ),
];
final assignment = ProviderAssignment(
  id: 'assignment',
  orderId: 'incoming',
  orderCode: 'HDG-005',
  serviceName: 'Sửa máy lạnh chảy nước và kiểm tra hệ thống tại nhà',
  addressLabel: 'Phường Tân Phong, Thành phố Hồ Chí Minh',
  responseDeadline: DateTime.now().add(const Duration(minutes: 10)),
  orderType: 'immediate',
  totalAmount: 280000,
);

class _Repository extends ProviderRepository {
  _Repository(super.api);
  int acceptCount = 0;
  final pending = Completer<void>();
  @override
  Future<void> acceptAssignment(String id) {
    acceptCount++;
    return pending.future;
  }
}

Future<void> _showScreen(
  WidgetTester tester,
  Widget screen, {
  Size size = const Size(390, 844),
  double scale = 1,
  ThemeData? theme,
  bool assignmentError = false,
  String status = 'in_progress',
  _Repository? repository,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  final api = ApiClient(Dio(), CookieJar());
  addTearDown(api.close);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, state) => screen),
      GoRoute(
        path: '/provider/orders/:id',
        builder: (_, state) =>
            Scaffold(body: Text('Mở đơn ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/provider/wallet',
        builder: (_, state) => const Scaffold(body: Text('Đã mở ví')),
      ),
      GoRoute(
        path: '/provider/profile',
        builder: (_, state) => const Scaffold(body: Text('Đã mở hồ sơ')),
      ),
      GoRoute(
        path: '/provider/notifications',
        builder: (_, state) => const Scaffold(body: Text('Đã mở thông báo')),
      ),
      GoRoute(
        path: '/provider/banks',
        builder: (_, state) => const Scaffold(body: Text('Đã mở ngân hàng')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(
          (ref) => AuthController(AuthRepository(api), api)
            ..user = const AppUser(
              id: 'test-user',
              fullName: 'Đối tác kiểm tra giao diện',
              email: 'doitac@example.test',
              role: UserRole.provider,
              providerOnboardingStatus: 'APPROVED',
            )
            ..status = AuthStatus.authenticated,
        ),
        if (repository != null)
          providerRepositoryProvider.overrideWithValue(repository),
        providerOverviewProvider.overrideWith((ref) async => overview),
        providerOrdersProvider.overrideWith(
          (ref) async => PagedResult(items: orders, page: 1, totalPages: 1),
        ),
        providerAssignmentsProvider.overrideWith((ref) async {
          if (assignmentError) {
            throw const ApiException('Không thể tải đơn cần phản hồi.');
          }
          return [assignment];
        }),
        providerWalletProvider.overrideWith(
          (ref) async =>
              const WalletInfo(balance: 2450000, pendingBalance: 350000),
        ),
        providerWalletTransactionsProvider.overrideWith(
          (ref) async => const PagedResult<WalletTransactionItem>(
            items: [
              WalletTransactionItem(
                id: 'transaction',
                type: 'earning',
                amount: 250000,
                direction: 'in',
                description: 'Thanh toán dịch vụ',
                status: 'completed',
              ),
            ],
            page: 1,
            totalPages: 1,
          ),
        ),
        providerWithdrawalsProvider.overrideWith(
          (ref) async => const PagedResult<Map<String, dynamic>>(
            items: [],
            page: 1,
            totalPages: 1,
          ),
        ),
        providerProfileProvider.overrideWith(
          (ref) async => {
            'user': {
              'fullName': 'Đối tác kiểm tra giao diện',
              'email': 'doitac@example.test',
            },
            'provider': {
              'bio': 'Đối tác cung cấp dịch vụ tại nhà.',
              'mainServiceText': 'Điện lạnh',
              'services': [
                {'name': 'Vệ sinh máy lạnh'},
              ],
            },
          },
        ),
        orderDetailProvider('detail').overrideWith(
          (ref) async => OrderDetail(
            id: 'detail',
            code: 'HDG-006',
            serviceName: 'Sửa đường ống nước dưới bồn rửa tại nhà',
            status: status,
            paymentStatus: 'paid',
            paymentMethod: 'bank',
            totalAmount: 270000,
            customerName: 'Khách hàng kiểm tra',
            addressLabel: 'Địa chỉ kiểm tra bố cục trên thiết bị nhỏ',
            scheduledAt: today.add(const Duration(hours: 14)),
            problemDescription: 'Kiểm tra đường ống và khắc phục rò rỉ.',
            statusHistory: [
              OrderStatusEvent(status: 'accepted', createdAt: today),
              OrderStatusEvent(
                status: 'in_progress',
                createdAt: today.add(const Duration(hours: 1)),
              ),
            ],
          ),
        ),
      ],
      child: RepaintBoundary(
        key: previewKey,
        child: MaterialApp.router(
          debugShowCheckedModeBanner: false,
          theme: theme ?? AppTheme.light,
          routerConfig: router,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(scale)),
            child: child!,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> savePreview(WidgetTester tester, String name) async {
  if (!const bool.fromEnvironment('PROVIDER_PREVIEW')) return;
  await tester.runAsync(
    () => precacheImage(
      const AssetImage('assets/brand/handigo-logo.png'),
      previewKey.currentContext!,
    ),
  );
  await tester.pumpAndSettle();
  await tester.runAsync(() async {
    final boundary =
        previewKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await File(
      '.dart_tool/provider-$name.png',
    ).writeAsBytes(bytes!.buffer.asUint8List());
    image.dispose();
  });
}

void main() {
  testWidgets('Form báo giá cuộn được khi mở bàn phím và phóng lớn chữ', (
    tester,
  ) async {
    await _showScreen(
      tester,
      const ProviderOrderDetailScreen(orderId: 'detail'),
      size: const Size(320, 640),
      scale: 2,
    );
    await tester.tap(find.text('Gửi báo giá vật tư'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsNWidgets(4));
    tester.view.viewInsets = const FakeViewPadding(bottom: 260);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byType(TextField).last);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Thanh điều hướng chuyển tab và giữ bố cục gọn', (tester) async {
    await _showScreen(tester, const ProviderShell());
    final selectedTab = find
        .ancestor(of: find.text('Tổng quan'), matching: find.byType(Material))
        .first;
    expect(tester.widget<Material>(selectedTab).color, AppTheme.primary);
    expect(
      tester.widget<Text>(find.text('Tổng quan')).style?.color,
      Colors.white,
    );
    await savePreview(tester, 'home');
    await tester.tap(find.text('Đơn hàng').last);
    await tester.pumpAndSettle();
    expect(find.text('HDG-001'), findsOneWidget);
    await tester.tap(find.text('Lịch hẹn').last);
    await tester.pumpAndSettle();
    expect(find.text('2 lịch hẹn'), findsOneWidget);
    await tester.tap(find.text('Tài khoản').last);
    await tester.pumpAndSettle();
    expect(find.text('Quản lý công việc'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Tổng quan hiển thị đơn đã nhận ngoài lịch hôm nay', (
    tester,
  ) async {
    await _showScreen(tester, const ProviderDashboardScreen());
    expect(find.text('Handigo'), findsOneWidget);
    expect(find.text('Đối tác Handigo'), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Bảo dưỡng máy giặt'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Bảo dưỡng máy giặt'), findsOneWidget);
    expect(find.text('Đơn đã hủy'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Dữ liệu mẫu chỉ xuất hiện sau khi bật và mất khi mở lại trang', (
    tester,
  ) async {
    await _showScreen(tester, const ProviderScheduleScreen());
    expect(find.text('2 lịch hẹn'), findsOneWidget);
    setSchedulePreviewForDebug(true);
    await tester.pumpAndSettle();
    expect(find.text('3 lịch hẹn'), findsOneWidget);
    expect(find.textContaining('760.000'), findsOneWidget);
    await savePreview(tester, 'schedule-sample');
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    await _showScreen(tester, const ProviderScheduleScreen());
    expect(find.text('2 lịch hẹn'), findsOneWidget);
    expect(find.textContaining('Dữ liệu xem thử •'), findsNothing);
  });

  testWidgets('Vào lại lịch hẹn chọn hôm nay và đưa ô ngày sát trái', (
    tester,
  ) async {
    await _showScreen(tester, const ProviderShell());
    await tester.tap(find.text('Lịch hẹn').last);
    await tester.pumpAndSettle();
    final next = DateTime(today.year, today.month, today.day + 1);
    final nextLabel = find.text('${next.day}/${next.month}');
    await tester.ensureVisible(nextLabel);
    await tester.tap(nextLabel);
    await tester.pumpAndSettle();
    expect(find.text('1 lịch hẹn'), findsOneWidget);
    await tester.tap(find.text('Tổng quan').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lịch hẹn').last);
    await tester.pumpAndSettle();
    expect(find.text('2 lịch hẹn'), findsOneWidget);
    final todayCard = find
        .ancestor(
          of: find.text('${today.day}/${today.month}'),
          matching: find.byType(TextButton),
        )
        .first;
    expect(tester.getTopLeft(todayCard).dx, 16);
    expect(find.byIcon(Icons.science_outlined), findsNothing);
    expect(find.text('Hôm nay'), findsOneWidget);
  });

  testWidgets('Lịch chọn đúng ngày và loại đơn hủy', (tester) async {
    await _showScreen(tester, const ProviderScheduleScreen());
    expect(find.text('2 lịch hẹn'), findsOneWidget);
    expect(find.text('Đơn đã hủy'), findsNothing);
    await savePreview(tester, 'schedule');
    final next = today.add(const Duration(days: 1));
    final dot = find.byKey(
      ValueKey(
        'schedule-dot-${next.year}-${next.month.toString().padLeft(2, '0')}-${next.day.toString().padLeft(2, '0')}',
      ),
    );
    if (next.weekday != 1) {
      expect(
        (tester.widget<Container>(dot).decoration as BoxDecoration).color,
        AppTheme.error,
      );
    }
    final day = find.text('${next.day}/${next.month}');
    await tester.ensureVisible(day);
    await tester.tap(day);
    await tester.pumpAndSettle();
    expect(find.text('1 lịch hẹn'), findsOneWidget);
    expect(find.text('Bảo dưỡng máy giặt'), findsOneWidget);
    expect(find.text('Vệ sinh máy lạnh'), findsNothing);
    expect(find.text('Ngày mai'), findsOneWidget);
    expect(dot, findsNothing);
    await tester.ensureVisible(find.text('${today.day}/${today.month}'));
    await tester.tap(find.text('${today.day}/${today.month}'));
    await tester.pumpAndSettle();
    if (next.weekday != 1) {
      expect(
        (tester.widget<Container>(dot).decoration as BoxDecoration).color,
        AppTheme.outlineVariant,
      );
    }
  });

  testWidgets('Bộ lọc đơn và card chờ phản hồi dùng thao tác rõ ràng', (
    tester,
  ) async {
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    final repository = _Repository(api);
    await _showScreen(
      tester,
      const ProviderOrdersScreen(),
      repository: repository,
    );
    await savePreview(tester, 'orders');
    final progressFilter = find.descendant(
      of: find.byType(ChoiceChip),
      matching: find.text('Đang thực hiện'),
    );
    await tester.ensureVisible(progressFilter);
    await tester.tap(progressFilter);
    await tester.pumpAndSettle();
    expect(find.text('HDG-002'), findsOneWidget);
    expect(find.text('HDG-001'), findsNothing);
    await tester.ensureVisible(find.text('Chờ phản hồi').first);
    await tester.tap(find.text('Chờ phản hồi').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text(assignment.serviceName));
    await tester.pumpAndSettle();
    expect(find.text('Mở đơn incoming'), findsNothing);
    await tester.tap(find.text('Nhận đơn'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(repository.acceptCount, 1);
    expect(find.text('Đang xử lý...'), findsOneWidget);
    repository.pending.complete();
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('Lỗi đơn chờ phản hồi có thử lại và giữ phần tổng quan', (
    tester,
  ) async {
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      assignmentError: true,
    );
    expect(find.text('Không thể tải đơn cần phản hồi.'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);
    expect(find.text('Ví Handigo'), findsOneWidget);
  });

  for (final status in ['accepted', 'in_progress', 'completed', 'cancelled']) {
    testWidgets('Nút chi tiết phù hợp trạng thái $status', (tester) async {
      await _showScreen(
        tester,
        const ProviderOrderDetailScreen(orderId: 'detail'),
        status: status,
      );
      expect(
        find.text('Bắt đầu thực hiện'),
        status == 'accepted' ? findsOneWidget : findsNothing,
      );
      expect(
        find.text('Hoàn tất & nghiệm thu'),
        status == 'in_progress' ? findsOneWidget : findsNothing,
      );
      expect(
        find.text('Gửi báo giá vật tư'),
        status == 'in_progress' ? findsOneWidget : findsNothing,
      );
      if (status == 'in_progress') await savePreview(tester, 'detail');
      expect(tester.takeException(), isNull);
    });
  }

  for (final size in [
    const Size(320, 640),
    const Size(390, 844),
    const Size(430, 932),
  ]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('Các màn đối tác không tràn ở $size, cỡ chữ $scale', (
        tester,
      ) async {
        for (final screen in const <Widget>[
          ProviderDashboardScreen(),
          ProviderOrdersScreen(),
          ProviderScheduleScreen(),
          ProviderAccountScreen(),
          ProviderProfileScreen(),
          ProviderWalletScreen(),
          ProviderOrderDetailScreen(orderId: 'detail'),
        ]) {
          await _showScreen(tester, screen, size: size, scale: scale);
          if (size.width == 390 && scale == 1) {
            final preview = switch (screen) {
              ProviderAccountScreen() => 'account',
              ProviderProfileScreen() => 'profile',
              ProviderWalletScreen() => 'wallet',
              _ => null,
            };
            if (preview != null) {
              await savePreview(tester, preview);
            }
          }
          expect(
            tester.takeException(),
            isNull,
            reason: '${screen.runtimeType}',
          );
          final scroll = find.byType(ListView).first;
          if (scroll.evaluate().isNotEmpty) {
            await tester.drag(scroll, const Offset(0, -450));
            await tester.pumpAndSettle();
            if (size.width == 390 &&
                scale == 1 &&
                screen is ProviderDashboardScreen) {
              await savePreview(tester, 'home-scrolled');
            }
            expect(
              tester.takeException(),
              isNull,
              reason: '${screen.runtimeType} sau khi cuộn',
            );
          }
          await tester.pumpWidget(const SizedBox.shrink());
          await tester.pumpAndSettle();
        }
      });
    }
  }

  testWidgets('Dark mode giữ nội dung và CTA dễ dùng', (tester) async {
    await _showScreen(
      tester,
      const ProviderOrderDetailScreen(orderId: 'detail'),
      theme: AppTheme.dark,
    );
    expect(find.text('Hoàn tất & nghiệm thu'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
