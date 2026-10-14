import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/home/domain/customer_home_data.dart';
import 'package:handigo_app/features/home/presentation/customer_shell.dart';
import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/shared/widgets/service_images.dart';

void main() {
  test('Đọc cover mới, gallery có thứ tự và ảnh cũ', () {
    final legacy = Service.fromJson({
      '_id': '1',
      'name': 'Dịch vụ',
      'serviceType': 'fixed_price',
      'image': 'https://example.com/legacy.jpg',
    });
    expect(legacy.coverImage, 'https://example.com/legacy.jpg');
    expect(legacy.galleryImages, isEmpty);
    final current = Service.fromJson({
      '_id': '1',
      'name': 'Dịch vụ',
      'serviceType': 'fixed_price',
      'coverImage': null,
      'image': 'https://example.com/legacy.jpg',
      'galleryImages': [
        'https://example.com/b.png',
        'https://example.com/a.png',
      ],
    });
    expect(current.coverImage, isNull);
    expect(current.galleryImages, [
      'https://example.com/b.png',
      'https://example.com/a.png',
    ]);
  });

  testWidgets('Cover và gallery fallback giữ khung 16:9', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            child: ServiceImageGallery(images: [], name: 'Dịch vụ'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final size = tester.getSize(find.byType(ServiceCoverImage));
    expect(size.width / size.height, closeTo(16 / 9, 0.001));
    expect(find.byType(PageView), findsNothing);
    expect(find.byType(IconButton), findsNothing);
  });

  testWidgets('Gallery vuốt, điều hướng và chiều cao ổn định', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            child: ServiceImageGallery(
              images: [
                'https://example.com/a.png',
                'https://example.com/b.png',
              ],
              name: 'Dịch vụ',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final firstSize = tester.getSize(find.byType(ServiceImageGallery));
    expect(find.text('1/2'), findsOneWidget);
    await tester.drag(find.byType(PageView), const Offset(-320, 0));
    await tester.pumpAndSettle();
    expect(find.text('2/2'), findsOneWidget);
    expect(tester.getSize(find.byType(ServiceImageGallery)), firstSize);
    await tester.tap(find.byTooltip('Ảnh trước'));
    await tester.pumpAndSettle();
    expect(find.text('1/2'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('Card Service giữ 16:9 trong vùng danh sách ngang', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(800, 600);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light,
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(800, 600),
              textScaler: TextScaler.noScaling,
            ),
            child: const Scaffold(
              body: CustomerHomeContent(
                data: CustomerHomeData(
                  categories: [],
                  services: [
                    Service(
                      id: '1',
                      name: 'Dịch vụ vệ sinh nhà cửa theo gói',
                      description: '',
                      serviceType: 'fixed_price',
                      minOptionPrice: 300000,
                    ),
                  ],
                  providers: [],
                  unreadNotificationCount: 0,
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byType(ServiceCoverImage),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    final size = tester.getSize(find.byType(ServiceCoverImage));
    expect(size.width / size.height, closeTo(16 / 9, 0.001));
    expect(tester.takeException(), isNull);
  });
}
