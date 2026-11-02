import 'package:handigo_app/features/orders/presentation/order_detail_overview.dart';
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
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:handigo_app/app/providers/app_providers.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/api_client.dart';
import 'package:handigo_app/core/network/api_exception.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/account/domain/account_models.dart';
import 'package:handigo_app/features/account/presentation/account_screens.dart';
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
import 'package:handigo_app/features/provider/presentation/quotation_editor_screen.dart';
import 'package:handigo_app/features/provider/presentation/provider_order_feedback_panel.dart';
import 'package:handigo_app/features/services/domain/service_category.dart';

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
  int suggestionCount = 0;
  String? suggestedServiceName;
  String? suggestedCategoryId;
  @override
  Future<ProviderOverview> setAvailability(String status) async {
    availabilityCount++;
    return overview;
  }

  final pending = Completer<void>();
  @override
  Future<void> acceptAssignment(String id) {
    acceptCount++;
    return pending.future;
  }

  @override
  Future<List<ServiceCategory>> suggestionCategories() async => const [
    ServiceCategory(
      id: 'category-air-conditioner',
      name: 'Điều hòa & thông gió',
      slug: 'dieu-hoa-thong-gio',
    ),
  ];

  @override
  Future<void> createServiceSuggestion({
    required String serviceName,
    String? categoryId,
    String? categoryName,
    String? description,
  }) async {
    suggestionCount++;
    suggestedServiceName = serviceName;
    suggestedCategoryId = categoryId;
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
  ProviderOverview currentOverview = overview,
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
      GoRoute(
        path: '/provider/personal-info',
        builder: (_, state) => const Scaffold(body: Text('Đã mở cá nhân')),
      ),
      GoRoute(
        path: '/provider/addresses',
        builder: (_, state) => const Scaffold(body: Text('Đã mở địa chỉ')),
      ),
      GoRoute(
        path: '/provider/professional-info',
        builder: (_, state) => const Scaffold(body: Text('Đã mở nghề nghiệp')),
      ),
      GoRoute(
        path: '/provider/verification',
        builder: (_, state) => const Scaffold(body: Text('Đã mở xác thực')),
      ),
      GoRoute(
        path: '/provider/support',
        builder: (_, state) => const Scaffold(body: Text('Đã mở hỗ trợ')),
      ),
      GoRoute(
        path: '/provider/reports',
        builder: (_, state) => const Scaffold(body: Text('Đã mở báo cáo')),
      ),
      GoRoute(
        path: '/provider/service-suggestions',
        builder: (_, state) => const ProviderServiceSuggestionScreen(),
      ),
      GoRoute(
        path: '/provider/app-feedback',
        builder: (_, state) => const Scaffold(body: Text('Đánh giá ứng dụng')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        providerCurrentLocationProvider.overrideWith((ref) async {
          await syncLocation?.call();
        }),
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
          (ref) async => PagedResult(items: orders, page: 1, totalPages: 1),
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
          (ref) async => const WalletInfo(
            balance: 2450000,
            pendingBalance: 350000,
            totalEarnings: 12500000,
            totalWithdrawn: 1800000,
          ),
        ),
        providerWalletSummaryProvider.overrideWith(
          (ref) async => const WalletSummary(
            currentBalance: 2450000,
            totalEarnings: 12500000,
            totalWithdrawals: 1800000,
            totalPlatformFeesPaid: 250000,
          ),
        ),
        providerWalletTransactionsProvider.overrideWith(
          (ref) async => const PagedResult<WalletTransactionItem>(
            items: [
              WalletTransactionItem(
                id: 'transaction',
                type: 'provider_earning',
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
                {'name': 'Sửa chữa điều hòa'},
              ],
              'certificates': [
                {
                  'id': 'certificate',
                  'title': 'Chứng chỉ Kĩ Thuật Việt Hàn',
                  'issuer': 'Trường Cao đẳng Kỹ thuật Việt Hàn',
                  'status': 'approved',
                },
              ],
            },
          },
        ),
        providerSuggestionCategoriesProvider.overrideWith(
          (ref) async => const [
            ServiceCategory(
              id: 'category-air-conditioner',
              name: 'Điều hòa & thông gió',
              slug: 'dieu-hoa-thong-gio',
            ),
          ],
        ),
        providerBanksProvider.overrideWith(
          (ref) async => <Map<String, dynamic>>[
            {
              '_id': 'bank',
              'bankName': 'Ngân hàng Handigo',
              'bankCode': 'HDG',
              'accountHolderName': 'DOI TAC KIEM TRA',
              'accountNumber': '123456789',
              'isDefault': true,
            },
          ],
        ),
        providerFeedbacksProvider.overrideWith(
          (ref) async => const PagedResult<Map<String, dynamic>>(
            items: [
              {
                '_id': 'feedback-pending',
                'rating': 5,
                'comment': 'Thợ làm việc đúng giờ và rất cẩn thận.',
                'customerId': {'fullName': 'Nguyễn Minh Anh'},
                'serviceId': {'name': 'Vệ sinh máy lạnh'},
                'images': ['https://example.test/feedback.jpg'],
                'createdAt': '2026-11-02T09:30:00.000Z',
              },
              {
                '_id': 'feedback-replied',
                'rating': 4,
                'comment': 'Dịch vụ tốt, tư vấn rõ ràng.',
                'customerId': {'fullName': 'Trần Ngọc Linh'},
                'serviceId': {'name': 'Sửa chữa điều hòa'},
                'images': <String>[],
                'providerReply': {
                  'content': 'Cảm ơn bạn đã tin tưởng Handigo.',
                  'images': <String>[],
                  'repliedAt': '2026-11-02T10:30:00.000Z',
                },
                'createdAt': '2026-11-01T09:30:00.000Z',
              },
            ],
            page: 1,
            totalPages: 1,
          ),
        ),
        accountProfileProvider.overrideWith(
          (ref) async => {
            '_id': 'test-user',
            'fullName': 'Đối tác kiểm tra giao diện',
            'phone': '0901234567',
            'email': 'doitac@example.test',
            'birthday': '1995-01-15T00:00:00.000Z',
            'gender': 'male',
            'isPhoneVerified': true,
            'isEmailVerified': true,
          },
        ),
        accountAddressesProvider.overrideWith(
          (ref) async => const <AddressItem>[],
        ),
        accountFeedbackProvider.overrideWith(
          (ref) async => const <FeedbackItem>[],
        ),
        accountTicketsProvider.overrideWith(
          (ref) async =>
              const PagedResult<SupportItem>(items: [], page: 1, totalPages: 1),
        ),
        accountComplaintsProvider.overrideWith(
          (ref) async =>
              const PagedResult<SupportItem>(items: [], page: 1, totalPages: 1),
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

Future<void> main() async {
  await initializeDateFormatting('vi_VN');
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
      find.text('Thời lượng sửa chữa (phút)'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(ListView).last,
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(find.text('Thời lượng sửa chữa (phút)'), findsOneWidget);
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
    await _showScreen(
      tester,
      const ProviderShell(incomeScreen: ProviderWalletScreen(asTab: true)),
    );
    expect(find.text('Thu nhập'), findsOneWidget);
    await savePreview(tester, 'home');
    await tester.tap(find.text('Đơn hàng').last);
    await tester.pump(const Duration(milliseconds: 100));
    expect(
      find.byKey(const ValueKey('provider-tab-transition-1')),
      findsOneWidget,
    );
    await tester.pumpAndSettle();
    expect(find.text('Mã đơn HDG-001'), findsOneWidget);
    await tester.tap(find.text('Thu nhập').last);
    await tester.pumpAndSettle();
    expect(find.text('Ví Handigo'), findsOneWidget);
    expect(find.textContaining('12.500.000'), findsOneWidget);
    await savePreview(tester, 'income');
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

  testWidgets('Tài khoản đối tác gom đủ hồ sơ, hỗ trợ và đề xuất dịch vụ', (
    tester,
  ) async {
    await _showScreen(tester, const ProviderAccountScreen());
    expect(find.text('Thông tin cá nhân'), findsNothing);
    for (final label in [
      'Xác thực tài khoản',
      'Thông tin nghề nghiệp',
      'Đánh giá khách hàng',
      'Trung tâm hỗ trợ',
      'Báo cáo sự cố',
      'Đề xuất dịch vụ',
      'Điều khoản & quyền riêng tư',
      'Đánh giá Handigo',
      'Thông báo & nhắc lịch',
      'Ngôn ngữ',
      'Bảo mật & đăng nhập',
      'Giao diện',
    ]) {
      await tester.scrollUntilVisible(
        find.text(label),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text(label), findsOneWidget);
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('Đăng xuất provider cần xác nhận trước khi rời tài khoản', (
    tester,
  ) async {
    await _showScreen(tester, const ProviderAccountScreen());
    await tester.scrollUntilVisible(
      find.text('Đăng xuất'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Đăng xuất'));
    await tester.pumpAndSettle();

    expect(find.text('Đăng xuất khỏi Handigo?'), findsOneWidget);
    expect(find.text('Hủy'), findsOneWidget);
    expect(find.text('Đăng xuất'), findsNWidgets(2));

    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(find.text('Đăng xuất khỏi Handigo?'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Đề xuất dịch vụ dùng danh mục và gửi đúng dữ liệu', (
    tester,
  ) async {
    final api = ApiClient(Dio(), CookieJar());
    addTearDown(api.close);
    final repository = _Repository(api);
    await _showScreen(
      tester,
      const ProviderServiceSuggestionScreen(),
      repository: repository,
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Tên dịch vụ đề xuất'),
      'Bảo dưỡng điều hòa âm trần',
    );
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Điều hòa & thông gió').last);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Mô tả đề xuất'),
      'Khách hàng doanh nghiệp có nhu cầu bảo dưỡng định kỳ.',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Gửi đề xuất'));
    await tester.pumpAndSettle();
    expect(repository.suggestionCount, 1);
    expect(repository.suggestedServiceName, 'Bảo dưỡng điều hòa âm trần');
    expect(repository.suggestedCategoryId, 'category-air-conditioner');
    expect(find.textContaining('Đã gửi đề xuất'), findsOneWidget);
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
    await _showScreen(
      tester,
      const ProviderShell(incomeScreen: ProviderWalletScreen(asTab: true)),
    );
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
    expect(find.text('Đơn cần xử lý'), findsOneWidget);
    expect(find.text('Đơn cần phản hồi'), findsNothing);
    expect(find.text('HDG-005'), findsNothing);
    expect(find.text(orders.first.serviceName), findsWidgets);
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
        find.text('Trượt để bắt đầu xử lý'),
        status == 'accepted' ? findsOneWidget : findsNothing,
      );
      expect(
        find.text('Hoàn tất & nghiệm thu'),
        status == 'in_progress' ? findsOneWidget : findsNothing,
      );
      expect(find.text('Lập báo giá sửa chữa'), findsNothing);
      if (['accepted', 'in_progress'].contains(status)) {
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

  testWidgets('Đánh giá provider tìm kiếm, lọc nhanh và sửa phản hồi', (
    tester,
  ) async {
    await _showScreen(tester, const ProviderFeedbackScreen());

    expect(find.bySemanticsLabel('Xem ảnh đánh giá 1'), findsOneWidget);
    expect(find.text('Phản hồi'), findsOneWidget);
    expect(find.text('Phản hồi của bạn'), findsOneWidget);
    expect(find.text('Chưa phản hồi'), findsOneWidget);
    expect(find.text('Có ảnh'), findsOneWidget);

    await tester.tap(find.text('Chưa phản hồi'));
    await tester.pumpAndSettle();
    expect(find.text('1 kết quả'), findsOneWidget);

    await tester.tap(find.text('Tất cả'));
    await tester.enterText(find.byType(TextField).first, 'Trần Ngọc Linh');
    await tester.pumpAndSettle();
    expect(find.text('1 kết quả'), findsOneWidget);
    expect(find.text('Dịch vụ tốt, tư vấn rõ ràng.'), findsOneWidget);

    await tester.tap(find.byTooltip('Xóa tìm kiếm'));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).first, const Offset(0, -700));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Sửa phản hồi'));
    await tester.pumpAndSettle();
    expect(find.text('Sửa phản hồi'), findsOneWidget);
    expect(find.text('Lưu chỉnh sửa'), findsOneWidget);
    expect(find.text('Cảm ơn bạn đã tin tưởng Handigo.'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

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
          ProviderIncomeScreen(),
          ProviderScheduleScreen(),
          ProviderAccountScreen(),
          ProfileScreen(addressRoute: '/provider/addresses'),
          ProviderProfileScreen(),
          ProviderVerificationScreen(),
          ProviderServiceSuggestionScreen(),
          ProviderWalletScreen(),
          ProviderBankAccountsScreen(),
          ProviderFeedbackScreen(),
          SupportScreen(),
          ComplaintScreen(),
          FeedbackScreen(),
          ProviderSettingsScreen(),
          ProviderOrderDetailScreen(orderId: 'detail'),
        ]) {
          await _showScreen(tester, screen, size: size, scale: scale);
          if (size.width == 390 && scale == 1) {
            final preview = switch (screen) {
              ProviderAccountScreen() => 'account',
              ProfileScreen() => 'personal-info',
              ProviderProfileScreen() => 'profile',
              ProviderVerificationScreen() => 'verification',
              ProviderFeedbackScreen() => 'feedback',
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
          final lists = find.byType(ListView);
          if (lists.evaluate().isNotEmpty) {
            final scroll = lists.first;
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
