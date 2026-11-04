import 'package:handigo_app/features/orders/presentation/order_detail_overview.dart';
import 'package:handigo_app/features/provider/presentation/provider_income_screen.dart';
import 'package:handigo_app/features/provider/presentation/provider_assignment_customer_info.dart';
import 'package:handigo_app/features/provider/domain/provider_income.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_directions_sheet.dart';
import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:geolocator/geolocator.dart';
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
import 'package:handigo_app/features/provider/data/provider_location_service.dart';
import 'package:handigo_app/features/provider/domain/provider_models.dart';
import 'package:handigo_app/features/provider/presentation/provider_screens.dart';
import 'package:handigo_app/features/provider/presentation/provider_account_screens.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_detail_screen.dart';
import 'package:handigo_app/features/provider/presentation/quotation_editor_screen.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_feedback_panel.dart';

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
  int availabilityCount = 0;
  Completer<ProviderOverview>? availabilityResponse;
  DateTime messagesAt = DateTime.now().toUtc();
  DateTime notificationsAt = DateTime.now().toUtc();
  @override
  Future<String?> workingAddress({double? latitude, double? longitude}) async =>
      latitude == 10.9 ? 'Địa chỉ GPS mới' : 'Địa chỉ GPS ban đầu';
  @override
  Future<({int count, DateTime? latestAt})> notificationBadge(
    DateTime? openedAt,
  ) async => (
    count: openedAt == null || notificationsAt.isAfter(openedAt) ? 3 : 0,
    latestAt: notificationsAt,
  );
  @override
  Future<({int count, DateTime? latestAt})> messageBadge(
    String userId,
    DateTime? openedAt,
  ) async => (
    count: openedAt == null || messagesAt.isAfter(openedAt) ? 2 : 0,
    latestAt: messagesAt,
  );
  @override
  Future<ProviderOverview> setAvailability(
    String status, {
    ProviderOverview? current,
  }) async {
    availabilityCount++;
    if (availabilityResponse != null) return availabilityResponse!.future;
    return ProviderOverview.fromJson({'availabilityStatus': status});
  }

  final pending = Completer<void>();
  @override
  Future<void> acceptAssignment(String id) {
    acceptCount++;
    return pending.future;
  }
}

class _LocationTracker extends ProviderLocationService {
  _LocationTracker(super.api);
  Position? _position;
  @override
  Position? get synchronizedPosition => _position;

  void move(double latitude) {
    _position = Position(
      longitude: 106.7,
      latitude: latitude,
      timestamp: DateTime.now(),
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );
    error = null;
    notifyListeners();
  }

  void loseSignal() {
    error = const ApiException('GPS tạm thời không đủ chính xác.');
    notifyListeners();
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
  ProviderLocationService? tracker,
  bool liveBadges = false,
  bool liveAddress = false,
  ProviderOverview currentOverview = overview,
  List<OrderSummary>? currentOrders,
  Future<void> Function()? syncLocation,
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
        path: '/provider/income',
        builder: (_, _) => const ProviderIncomeScreen(),
      ),
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
        path: '/provider/chat',
        builder: (_, state) => const Scaffold(body: Text('Đã mở tin nhắn')),
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
        providerAssignmentPositionProvider.overrideWith(
          (ref) async =>
              throw const ApiException('Bật GPS để xem khoảng cách.'),
        ),
        providerAssignmentOrdersProvider.overrideWith(
          (ref) async => currentOrders ?? orders,
        ),
        providerIncomeProvider.overrideWith(
          (ref, range) async => const ProviderIncomeSummary(
            amount: 0,
            completedOrders: 0,
            byDay: {},
            entries: [],
          ),
        ),
        if (!liveBadges) ...[
          providerMessageBadgeProvider.overrideWith(
            (ref) async => (count: 0, latestAt: null),
          ),
          providerNotificationBadgeProvider.overrideWith(
            (ref) async => (count: 0, latestAt: null),
          ),
        ],
        if (tracker != null)
          providerLocationServiceProvider.overrideWith((ref) => tracker),
        providerCurrentLocationProvider.overrideWith((ref) async {
          await syncLocation?.call();
        }),
        if (!liveAddress)
          providerWorkingAddressProvider.overrideWith(
            (ref) async => 'Phường Tân Phong, Thành phố Hồ Chí Minh',
          ),
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
        providerOverviewProvider.overrideWith((ref) async => currentOverview),
        providerOrdersProvider.overrideWith(
          (ref) async => PagedResult(
            items: currentOrders ?? orders,
            page: 1,
            totalPages: 1,
          ),
        ),
        providerOrderPageProvider.overrideWith(
          (ref, query) async => PagedResult(
            items: orders
                .where((item) => query.$2 == 'all' || item.status == query.$2)
                .toList(),
            page: 1,
            totalPages: 1,
          ),
        ),
        orderQuotationProvider('detail').overrideWith((ref) async => null),
        providerOrderFeedbackProvider(
          'detail',
        ).overrideWith((ref) async => null),
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
            inspectionRequired: true,
            depositPaidAt: today,
            totalAmount: 270000,
            customerName: 'Khách hàng kiểm tra',
            customerPhone: '0901234567',
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
  testWidgets(
    'GPS đồng bộ vị trí mới tự thay địa chỉ, không hiện dòng cảnh báo đã bỏ',
    (tester) async {
      final api = ApiClient(Dio(), CookieJar());
      addTearDown(api.close);
      final tracker = _LocationTracker(api)..move(10.8);
      await _showScreen(
        tester,
        const ProviderDashboardScreen(),
        tracker: tracker,
        repository: _Repository(api),
        liveAddress: true,
      );
      expect(find.text('Địa chỉ GPS ban đầu'), findsOneWidget);
      tracker.loseSignal();
      await tester.pumpAndSettle();
      expect(
        find.text('Chưa cập nhật được vị trí mới. Hệ thống sẽ thử lại.'),
        findsNothing,
      );
      tracker.move(10.9);
      await tester.pumpAndSettle();
      expect(find.text('Địa chỉ GPS mới'), findsOneWidget);
      expect(find.textContaining('Địa chỉ GPS ban đầu'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Badge đỏ ẩn riêng khi bấm và xuất hiện lại khi có tin mới', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    final repository = _Repository(api);
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      repository: repository,
      liveBadges: true,
    );
    Badge badge(String tooltip) => tester.widget<Badge>(
      find.descendant(
        of: find.byTooltip(tooltip),
        matching: find.byType(Badge),
      ),
    );
    expect((badge('Tin nhắn').label as Text).data, '2');
    expect((badge('Thông báo').label as Text).data, '3');
    expect(badge('Tin nhắn').backgroundColor, AppTheme.error);
    await tester.tap(find.byTooltip('Tin nhắn'));
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.text('Đã mở tin nhắn'))).pop();
    await tester.pumpAndSettle();
    expect(badge('Tin nhắn').isLabelVisible, isFalse);
    expect(badge('Thông báo').isLabelVisible, isTrue);
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ProviderDashboardScreen)),
    );
    repository.messagesAt = DateTime.now().toUtc().add(
      const Duration(seconds: 1),
    );
    container.invalidate(providerMessageBadgeProvider);
    await tester.pumpAndSettle();
    expect(badge('Tin nhắn').isLabelVisible, isTrue);
    await tester.tap(find.byTooltip('Thông báo'));
    await tester.pumpAndSettle();
    GoRouter.of(tester.element(find.text('Đã mở thông báo'))).pop();
    await tester.pumpAndSettle();
    expect(badge('Thông báo').isLabelVisible, isFalse);
    expect(badge('Tin nhắn').isLabelVisible, isTrue);
  });
  testWidgets('Địa chỉ đã hiển thị vẫn còn khi luồng GPS lỗi tạm thời', (
    tester,
  ) async {
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    final tracker = _LocationTracker(api);
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      tracker: tracker,
    );
    expect(find.text('Phường Tân Phong, Thành phố Hồ Chí Minh'), findsWidgets);
    tracker.loseSignal();
    await tester.pump();
    expect(
      find.text('Vị trí gần nhất: Phường Tân Phong, Thành phố Hồ Chí Minh'),
      findsOneWidget,
    );
    expect(find.text('Chưa lấy được vị trí hiện tại.'), findsNothing);
    expect(
      find.text('Chưa cập nhật được vị trí mới. Hệ thống sẽ thử lại.'),
      findsNothing,
    );
  });

  testWidgets('Công tắc bật ngay trong lúc còn chờ GPS và API', (tester) async {
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    final repository = _Repository(api);
    final gps = Completer<void>();
    final response = Completer<ProviderOverview>();
    repository.availabilityResponse = response;
    addTearDown(() {
      if (!gps.isCompleted) gps.complete();
    });
    addTearDown(() {
      if (!response.isCompleted) response.complete(overview);
    });
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      repository: repository,
      currentOverview: ProviderOverview.fromJson({
        'availabilityStatus': 'offline',
      }),
      syncLocation: () => gps.future,
    );
    await tester.tap(find.byType(Switch));
    await tester.pump();
    expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
    expect(repository.availabilityCount, 0);
    gps.complete();
    await tester.pump();
    expect(repository.availabilityCount, 1);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
    await tester.tap(find.byType(Switch));
    await tester.pump();
    expect(repository.availabilityCount, 1);
    response.complete(overview);
    await tester.pumpAndSettle();
    expect(repository.availabilityCount, 1);
  });

  testWidgets('Công tắc tắt ngay và hoàn tác nếu API từ chối', (tester) async {
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    final repository = _Repository(api);
    final response = Completer<ProviderOverview>();
    repository.availabilityResponse = response;
    addTearDown(() {
      if (!response.isCompleted) response.complete(overview);
    });
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      repository: repository,
    );
    await tester.tap(find.byType(Switch));
    await tester.pump();
    expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
    expect(repository.availabilityCount, 1);
    response.completeError(
      const ApiException('Chưa cập nhật được trạng thái.'),
    );
    await tester.pumpAndSettle();
    expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
    expect(find.text('Chưa cập nhật được trạng thái.'), findsOneWidget);
  });

  testWidgets('Trang chủ mở tin nhắn và thẻ thu nhập chuyển đúng tab', (
    tester,
  ) async {
    var incomeOpened = false;
    await _showScreen(
      tester,
      ProviderDashboardScreen(onIncome: () => incomeOpened = true),
    );
    expect(find.text('Thu nhập tháng này'), findsOneWidget);
    expect(find.text('Bạn có 1 đề nghị nhận việc'), findsOneWidget);
    await tester.ensureVisible(find.text('Thu nhập tháng này'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thu nhập tháng này'));
    expect(incomeOpened, isTrue);
    await tester.tap(find.byTooltip('Tin nhắn'));
    await tester.pumpAndSettle();
    expect(find.text('Đã mở tin nhắn'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Trang chủ ưu tiên đơn đang làm và mở đúng công việc', (
    tester,
  ) async {
    await _showScreen(tester, const ProviderDashboardScreen());
    await tester.scrollUntilVisible(
      find.text('Tiếp tục xử lý'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.ensureVisible(find.text('Tiếp tục xử lý'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tiếp tục xử lý'));
    await tester.pumpAndSettle();
    expect(find.text('Mở đơn progress'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Tải lại vị trí thất bại hiển thị nguyên nhân cụ thể', (
    tester,
  ) async {
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      syncLocation: () async {
        throw const ApiException('Quyền vị trí đang bị chặn.');
      },
    );
    await tester.tap(find.byTooltip('Tải lại vị trí'));
    await tester.pumpAndSettle();
    expect(find.text('Quyền vị trí đang bị chặn.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Thông báo vị trí ngắn gọn và tải lại bên trái công tắc', (
    tester,
  ) async {
    var attempts = 0;
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      size: const Size(320, 640),
      syncLocation: () async {
        attempts++;
        if (attempts == 1) {
          throw const ApiException('Vị trí chưa đủ chính xác hoặc đã cũ.');
        }
      },
    );
    expect(find.text('Chưa lấy được vị trí hiện tại.'), findsOneWidget);
    expect(find.text('Thử lại vị trí'), findsNothing);
    final reload = find.byTooltip('Tải lại vị trí');
    expect(
      tester.getCenter(reload).dx,
      lessThan(tester.getCenter(find.byType(Switch)).dx),
    );
    await tester.tap(reload);
    await tester.pumpAndSettle();
    expect(attempts, 2);
    expect(find.text('Chưa lấy được vị trí hiện tại.'), findsNothing);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Chỉ bật nhận việc sau khi lưu vị trí, GPS lỗi cho thử lại', (
    tester,
  ) async {
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    final repository = _Repository(api);
    var failLocation = true;
    var synchronized = false;
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      repository: repository,
      currentOverview: ProviderOverview.fromJson({
        'availabilityStatus': 'offline',
      }),
      syncLocation: () async {
        expect(repository.availabilityCount, 0);
        if (failLocation) {
          throw const ApiException('Chưa lấy được vị trí thử nghiệm.');
        }
        synchronized = true;
      },
    );
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(repository.availabilityCount, 0);
    expect(find.text('Chưa lấy được vị trí thử nghiệm.'), findsOneWidget);
    expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);
    failLocation = false;
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(synchronized, isTrue);
    expect(repository.availabilityCount, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Form báo giá cuộn được khi mở bàn phím và phóng lớn chữ', (
    tester,
  ) async {
    await _showScreen(
      tester,
      const ProviderOrderDetailScreen(orderId: 'detail'),
      size: const Size(320, 640),
      scale: 2,
    );
    await tester.scrollUntilVisible(
      find.byType(QuotationEditorScreen),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Lập báo giá sửa chữa'), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Thêm hạng mục báo giá'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(ListView).last,
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Thêm hạng mục báo giá'));
    await tester.pumpAndSettle();
    expect(find.text('Tên hạng mục'), findsOneWidget);
    tester.view.viewInsets = const FakeViewPadding(bottom: 260);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byType(TextFormField).last);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(QuotationEditorScreen), findsOneWidget);
    expect(find.byType(AlertDialog), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Thanh điều hướng chuyển tab và giữ bố cục gọn', (tester) async {
    await _showScreen(tester, const ProviderShell());
    final selectedTab = find
        .ancestor(of: find.text('Trang chủ'), matching: find.byType(Material))
        .first;
    expect(tester.widget<Material>(selectedTab).color, AppTheme.primaryDark);
    expect(
      tester.widget<Text>(find.text('Trang chủ')).style?.color,
      Colors.white,
    );
    await savePreview(tester, 'home');
    await tester.tap(find.text('Đơn dịch vụ').last);
    await tester.pumpAndSettle();
    expect(find.text('Mã đơn HDG-001'), findsOneWidget);
    await tester.tap(find.text('Thu nhập').last);
    await tester.pumpAndSettle();
    expect(find.byType(ProviderIncomeScreen), findsOneWidget);
    await tester.tap(find.byTooltip('Quay lại'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lịch').last);
    await tester.pumpAndSettle();
    expect(find.text('2 lịch hẹn'), findsOneWidget);
    await tester.tap(find.text('Hồ sơ').last);
    await tester.pumpAndSettle();
    expect(find.text('Quản lý công việc'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Tổng quan hiển thị đơn đã nhận ngoài lịch hôm nay', (
    tester,
  ) async {
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      currentOrders: [orders[2], orders[3]],
    );
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
    await tester.tap(find.text('Lịch').last);
    await tester.pumpAndSettle();
    final next = DateTime(today.year, today.month, today.day + 1);
    final nextLabel = find.text('${next.day}/${next.month}');
    await tester.ensureVisible(nextLabel);
    await tester.tap(nextLabel);
    await tester.pumpAndSettle();
    expect(find.text('1 lịch hẹn'), findsOneWidget);
    await tester.tap(find.text('Trang chủ').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lịch').last);
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

  testWidgets('Nút tháng mở lịch, hủy giữ ngày và chọn được tháng khác', (
    tester,
  ) async {
    await _showScreen(tester, const ProviderScheduleScreen());
    final month = '${today.month.toString().padLeft(2, '0')}/${today.year}';
    await tester.tap(find.widgetWithText(OutlinedButton, month));
    await tester.pumpAndSettle();
    expect(find.byType(CalendarDatePicker), findsOneWidget);
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(find.text('2 lịch hẹn'), findsOneWidget);

    await tester.tap(find.widgetWithText(OutlinedButton, month));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Next month'));
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(CalendarDatePicker),
        matching: find.text('15'),
      ),
    );
    await tester.tap(find.text('Chọn'));
    await tester.pumpAndSettle();

    final next = DateTime(today.year, today.month + 1, 15);
    expect(
      find.widgetWithText(
        OutlinedButton,
        '${next.month.toString().padLeft(2, '0')}/${next.year}',
      ),
      findsOneWidget,
    );
    expect(find.text('${next.day}/${next.month}'), findsOneWidget);
    expect(find.text('0 lịch hẹn'), findsOneWidget);
    expect(find.text('Không có lịch hẹn trong ngày này.'), findsOneWidget);
    expect(tester.takeException(), isNull);
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
    expect(find.text('Mã đơn HDG-002'), findsOneWidget);
    expect(find.text('Mã đơn HDG-001'), findsNothing);
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
    expect(find.text('Mở đơn incoming'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Tổng quan hiển thị đơn đã nhận trong mục Đơn cần xử lý', (
    tester,
  ) async {
    await _showScreen(
      tester,
      const ProviderDashboardScreen(),
      assignmentError: true,
    );
    await tester.scrollUntilVisible(
      find.text('Đơn cần xử lý'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Đơn cần xử lý'), findsOneWidget);
    expect(find.text('Đơn cần phản hồi'), findsNothing);
    expect(find.text('HDG-005'), findsNothing);
    await tester.scrollUntilVisible(
      find.text('Tiếp tục xử lý'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text(orders[1].serviceName), findsWidgets);
  });

  testWidgets(
    'Chi tiết provider dùng lại thông tin dịch vụ và thẻ địa chỉ mở chỉ đường',
    (tester) async {
      await _showScreen(
        tester,
        const ProviderOrderDetailScreen(orderId: 'detail'),
      );
      expect(find.text('Trạng thái công việc'), findsNothing);
      expect(
        tester
            .widget<OrderDetailOverview>(find.byType(OrderDetailOverview))
            .providerView,
        isTrue,
      );
      expect(find.text('Theo dõi và chia sẻ vị trí'), findsNothing);
      await tester.tap(find.text('Địa chỉ').first);
      await tester.pumpAndSettle();
      expect(find.byType(ProviderOrderDirectionsSheet), findsOneWidget);
      expect(
        find.text('Địa chỉ đơn chưa có tọa độ để chỉ đường.'),
        findsOneWidget,
      );
      expect(find.text('Thử lại'), findsOneWidget);
      await tester.tap(find.byTooltip('Đóng chỉ đường'));
      await tester.pumpAndSettle();
      expect(find.byType(ProviderOrderDirectionsSheet), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Menu chi tiết provider có tải lại, báo cáo và hủy đơn', (
    tester,
  ) async {
    await _showScreen(
      tester,
      const ProviderOrderDetailScreen(orderId: 'detail'),
    );
    await tester.tap(find.byIcon(Icons.more_vert));
    await tester.pumpAndSettle();
    expect(find.text('Tải lại đơn'), findsOneWidget);
    expect(find.text('Báo cáo đơn'), findsOneWidget);
    expect(find.text('Hủy đơn'), findsOneWidget);
    await tester.tap(find.text('Báo cáo đơn'));
    await tester.pumpAndSettle();
    expect(find.text('Báo cáo vấn đề'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final status in ['accepted', 'in_progress', 'completed', 'cancelled']) {
    testWidgets('Nút chi tiết phù hợp trạng thái $status', (tester) async {
      await _showScreen(
        tester,
        const ProviderOrderDetailScreen(orderId: 'detail'),
        status: status,
      );
      expect(
        find.text('Đã đến nơi'),
        status == 'accepted' ? findsOneWidget : findsNothing,
      );
      expect(
        find.text('Hoàn tất & nghiệm thu'),
        status == 'in_progress' ? findsOneWidget : findsNothing,
      );
      expect(find.text('Lập báo giá sửa chữa'), findsNothing);
      if (status == 'in_progress') {
        await tester.scrollUntilVisible(
          find.byType(QuotationEditorScreen),
          180,
          scrollable: find.byType(Scrollable).first,
        );
        expect(find.byType(QuotationEditorScreen), findsOneWidget);
      } else {
        expect(find.byType(QuotationEditorScreen), findsNothing);
      }
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
          ProviderShell(),
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
