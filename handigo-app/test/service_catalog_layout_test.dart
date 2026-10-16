import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/account/domain/account_models.dart';
import 'package:handigo_app/features/account/presentation/account_screens.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_screens.dart';
import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/features/services/domain/service_category.dart';
import 'package:handigo_app/shared/widgets/service_images.dart';

const services = [
  Service(
    id: 'air',
    name: 'Vệ sinh máy lạnh',
    description: 'Vệ sinh và bảo dưỡng tại nhà.',
    serviceType: 'fixed_price',
    fixedPrice: 250000,
    categoryName: 'Điện lạnh',
    averageRating: 4.9,
    totalFeedbacks: 12,
    totalCompletedOrders: 100,
  ),
  Service(
    id: 'water',
    name: 'Sửa đường nước',
    description: 'Kiểm tra và sửa rò rỉ.',
    serviceType: 'fixed_price',
    fixedPrice: 150000,
    categoryName: 'Điện nước',
    averageRating: 4.5,
    totalFeedbacks: 6,
    totalCompletedOrders: 30,
  ),
  Service(
    id: 'quote',
    name: 'Khảo sát điện',
    description: 'Khảo sát và báo giá.',
    serviceType: 'inspection',
    categoryName: 'Điện nước',
  ),
];
const categories = [
  ServiceCategory(id: 'air', name: 'Điện lạnh', slug: 'dien-lanh'),
  ServiceCategory(id: 'water', name: 'Điện nước', slug: 'dien-nuoc'),
];
final previewKey = GlobalKey();

Future<void> showCatalog(
  WidgetTester tester, {
  Size size = const Size(390, 844),
  double scale = 1,
  List<VoucherItem> vouchers = const [],
  bool serviceError = false,
  bool voucherError = false,
  List<Service> items = services,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, state) => const ServiceCatalogScreen()),
      GoRoute(
        path: '/customer/services/:id',
        builder: (_, state) =>
            Scaffold(body: Text('Chi tiết ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/customer/vouchers',
        builder: (_, state) => const Scaffold(body: Text('Kho ưu đãi')),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        serviceCatalogCategoriesProvider.overrideWith(
          (ref) async => categories,
        ),
        serviceCatalogServicesProvider.overrideWith((ref, id) async {
          if (serviceError) throw StateError('Không có kết nối');
          return PagedResult(
            items: id == null
                ? items
                : items.where((item) => item.id == id).toList(),
            page: 1,
            totalPages: 1,
          );
        }),
        accountVouchersProvider.overrideWith((ref) async {
          if (voucherError) throw StateError('Không thể tải ưu đãi');
          return vouchers;
        }),
      ],
      child: RepaintBoundary(
        key: previewKey,
        child: MaterialApp.router(
          theme: AppTheme.light,
          routerConfig: router,
          debugShowCheckedModeBanner: false,
          builder: (_, child) => MediaQuery(
            data: MediaQueryData(
              size: size,
              textScaler: TextScaler.linear(scale),
            ),
            child: child!,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

VoucherItem voucher({required DateTime start, required DateTime end}) =>
    VoucherItem(
      code: 'GOLDEN20',
      name: 'Tuần lễ vàng Điện nước',
      description: 'Giảm trực tiếp 20% cho đơn đặt hôm nay.',
      discountType: 'PERCENT',
      discountValue: 20,
      startAt: start.toIso8601String(),
      endAt: end.toIso8601String(),
    );

void main() {
  setUpAll(() async {
    var directory = File(Platform.resolvedExecutable).parent;
    for (var depth = 0; depth < 8; depth++) {
      final fontFile = File(
        '${directory.path}/material_fonts/roboto-regular.ttf',
      );
      if (await fontFile.exists()) {
        final font = FontLoader('Roboto');
        font.addFont(
          fontFile.readAsBytes().then((bytes) => ByteData.sublistView(bytes)),
        );
        await font.load();
        final icons = FontLoader('MaterialIcons');
        icons.addFont(
          File(
            '${directory.path}/material_fonts/materialicons-regular.otf',
          ).readAsBytes().then((bytes) => ByteData.sublistView(bytes)),
        );
        await icons.load();
        break;
      }
      directory = directory.parent;
    }
  });
  testWidgets('Danh mục trước tiêu đề, ảnh 16:9 và điều hướng đặt dịch vụ', (
    tester,
  ) async {
    await showCatalog(tester);
    expect(
      tester.getTopLeft(find.text('Điện lạnh').first).dy,
      lessThan(tester.getTopLeft(find.text('Tất cả dịch vụ')).dy),
    );
    final image = find.byType(ServiceCoverImage).first;
    final size = tester.getSize(image);
    expect(size.width / size.height, closeTo(16 / 9, .001));
    expect(tester.widget<ServiceCoverImage>(image).fit, BoxFit.cover);
    expect(find.text('250.000đ'), findsOneWidget);
    expect(find.text('Ưu đãi đang diễn ra'), findsNothing);
    await tester.tap(find.text('Đặt ngay').first);
    await tester.pumpAndSettle();
    expect(find.text('Chi tiết air'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Sắp xếp giá, đánh giá và tìm kiếm cập nhật danh sách', (
    tester,
  ) async {
    await showCatalog(tester);
    await tester.tap(find.text('Giá thấp nhất'));
    await tester.pumpAndSettle();
    expect(
      tester.getTopLeft(find.text('Sửa đường nước')).dy,
      lessThan(tester.getTopLeft(find.text('Vệ sinh máy lạnh')).dy),
    );
    await tester.ensureVisible(find.text('Đánh giá cao'));
    await tester.tap(find.text('Đánh giá cao'));
    await tester.pumpAndSettle();
    expect(
      tester.getTopLeft(find.text('Vệ sinh máy lạnh')).dy,
      lessThan(tester.getTopLeft(find.text('Sửa đường nước')).dy),
    );
    await tester.enterText(find.byType(TextField), 'không tồn tại');
    await tester.pumpAndSettle();
    expect(find.text('Không có dịch vụ phù hợp.'), findsOneWidget);
    expect(find.text('0 dịch vụ khả dụng'), findsOneWidget);
    await tester.tap(find.byTooltip('Xóa tìm kiếm'));
    await tester.pumpAndSettle();
    expect(find.text('3 dịch vụ khả dụng'), findsOneWidget);
  });

  testWidgets('Nút lọc áp dụng danh mục đã chọn', (tester) async {
    await showCatalog(tester);
    await tester.tap(find.byTooltip('Lọc dịch vụ'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Điện lạnh').last);
    await tester.tap(find.text('Áp dụng'));
    await tester.pumpAndSettle();
    expect(find.text('1 dịch vụ khả dụng'), findsOneWidget);
    expect(find.text('Sửa đường nước'), findsNothing);
  });

  testWidgets('Banner chỉ hiện ưu đãi đang hiệu lực và mở kho ưu đãi', (
    tester,
  ) async {
    final now = DateTime.now();
    await showCatalog(
      tester,
      vouchers: [
        voucher(
          start: now.add(const Duration(days: 1)),
          end: now.add(const Duration(days: 2)),
        ),
        voucher(
          start: now.subtract(const Duration(days: 2)),
          end: now.subtract(const Duration(days: 1)),
        ),
        voucher(
          start: now.subtract(const Duration(days: 1)),
          end: now.add(const Duration(days: 1)),
        ),
      ],
    );
    expect(find.text('Ưu đãi đang diễn ra'), findsOneWidget);
    expect(find.text('-20%'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Điện lạnh').first).dy,
      lessThan(tester.getTopLeft(find.text('Ưu đãi đang diễn ra')).dy),
    );
    if (const bool.fromEnvironment('CATALOG_PREVIEW')) {
      await tester.runAsync(() async {
        final boundary =
            previewKey.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File(
          '.dart_tool/catalog-preview.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }
    await tester.tap(find.text('Ưu đãi đang diễn ra'));
    await tester.pumpAndSettle();
    expect(find.text('Kho ưu đãi'), findsOneWidget);
  });

  testWidgets('Ưu đãi tương lai, hết hạn hoặc thiếu ngày không tạo banner', (
    tester,
  ) async {
    final now = DateTime.now();
    await showCatalog(
      tester,
      vouchers: [
        voucher(
          start: now.add(const Duration(days: 1)),
          end: now.add(const Duration(days: 2)),
        ),
        voucher(
          start: now.subtract(const Duration(days: 2)),
          end: now.subtract(const Duration(days: 1)),
        ),
        const VoucherItem(code: 'UNKNOWN', name: 'Chưa xác định thời gian'),
      ],
    );
    expect(find.text('Ưu đãi đang diễn ra'), findsNothing);
  });

  testWidgets('Lỗi tải ưu đãi không chặn danh sách, lỗi dịch vụ có thử lại', (
    tester,
  ) async {
    await showCatalog(tester, voucherError: true, serviceError: true);
    expect(find.text('Ưu đãi đang diễn ra'), findsNothing);
    expect(find.text('Không thể tải danh sách dịch vụ.'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  for (final size in [
    const Size(320, 640),
    const Size(360, 640),
    const Size(390, 844),
  ]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('Bố cục không tràn ở $size, cỡ chữ $scale', (tester) async {
        final now = DateTime.now();
        await showCatalog(
          tester,
          size: size,
          scale: scale,
          vouchers: [
            voucher(
              start: now.subtract(const Duration(days: 1)),
              end: now.add(const Duration(days: 1)),
            ),
          ],
        );
        await tester.drag(find.byType(CustomScrollView), const Offset(0, -600));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  }
}
