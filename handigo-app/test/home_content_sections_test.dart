import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/home/domain/customer_home_data.dart';
import 'package:handigo_app/features/home/presentation/customer_shell.dart';

void main() {
  test('Model Trang chủ đọc được voucher và bài viết từ API', () {
    final voucher = HomeVoucher.fromJson({
      'code': 'HANDIGO20',
      'name': 'Ưu đãi dịch vụ tại nhà',
      'discountType': 'PERCENT',
      'discountValue': 20,
      'minOrderAmount': 100000,
    });
    final article = HomeNewsArticle.fromJson({
      'slug': 'meo-ve-sinh-dieu-hoa',
      'title': 'Mẹo vệ sinh điều hòa',
      'excerpt': 'Giữ thiết bị sạch và hoạt động ổn định.',
      'category': 'Mẹo hay',
      'coverImage': '',
      'content': [
        {'type': 'heading', 'text': 'Chuẩn bị'},
      ],
    });

    expect(voucher.code, 'HANDIGO20');
    expect(voucher.discountValue, 20);
    expect(article.slug, 'meo-ve-sinh-dieu-hoa');
    expect(article.content.single.text, 'Chuẩn bị');
  });

  testWidgets(
    'Voucher và tin tức hiển thị trên Trang chủ, tin tức ở dưới cùng',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(390, 900);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);

      const article = HomeNewsArticle(
        slug: 'meo-ve-sinh-dieu-hoa',
        title: 'Mẹo vệ sinh điều hòa',
        excerpt: 'Giữ thiết bị sạch và hoạt động ổn định.',
        category: 'Mẹo hay',
        coverImage: '',
        publishedAt: '2026-10-25T08:00:00.000Z',
        content: [HomeNewsBlock(type: 'heading', text: 'Chuẩn bị dụng cụ')],
      );
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: CustomerHomeContent(
                data: CustomerHomeData(
                  categories: [],
                  services: [],
                  providers: [],
                  unreadNotificationCount: 0,
                  vouchers: [
                    HomeVoucher(
                      code: 'HANDIGO20',
                      name: 'Ưu đãi dịch vụ tại nhà',
                      discountType: 'PERCENT',
                      discountValue: 20,
                      minOrderAmount: 100000,
                    ),
                  ],
                  news: [article],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final labels = tester
          .widgetList<Text>(find.byType(Text))
          .map((widget) => widget.data)
          .whereType<String>()
          .toList();
      expect(
        labels.indexOf('Tin tức'),
        greaterThan(labels.indexOf('Voucher dành cho bạn')),
      );
      expect(find.text('HANDIGO20'), findsOneWidget);
      expect(find.text('Giảm 20%'), findsOneWidget);

      final verticalList = find.byWidgetPredicate(
        (widget) =>
            widget is ListView && widget.scrollDirection == Axis.vertical,
      );
      await tester.drag(verticalList.first, const Offset(0, -700));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mẹo vệ sinh điều hòa').hitTestable());
      await tester.pumpAndSettle();
      expect(
        find.text('Giữ thiết bị sạch và hoạt động ổn định.'),
        findsOneWidget,
      );
      expect(find.text('Chuẩn bị dụng cụ'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
