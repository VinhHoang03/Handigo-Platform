import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handigo_app/app/theme/app_theme.dart';
import 'package:handigo_app/features/service_catalog/domain/service_detail.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_provider.dart';
import 'package:handigo_app/features/service_catalog/presentation/service_catalog_screens.dart';
import 'package:handigo_app/features/services/domain/service.dart';
import 'package:handigo_app/core/network/paged_result.dart';
import 'package:handigo_app/features/service_catalog/domain/service_review.dart';

void main() {
  for (final size in [const Size(390, 844), const Size(360, 640)]) {
    testWidgets('Hiện chi tiết và ghim thanh đặt lịch ở đáy màn hình $size', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = size;
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);

      const detail = ServiceDetail(
        service: Service(
          id: 'service-1',
          name: 'Vệ sinh máy lạnh',
          description: 'Làm sạch máy lạnh tại nhà.',
          serviceType: 'fixed_price',
          fixedPrice: 300000,
        ),
        options: [],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceReviewsProvider.overrideWith(
              (ref, query) async => const PagedResult<ServiceReview>(
                items: [],
                page: 1,
                totalPages: 0,
              ),
            ),
            serviceDetailProvider(
              'service-1',
            ).overrideWith((ref) async => detail),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            home: const ServiceDetailScreen(serviceId: 'service-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chi tiết dịch vụ').hitTestable(), findsOneWidget);
      expect(find.text(detail.service.name).hitTestable(), findsOneWidget);
      expect(
        find.text(detail.service.description).hitTestable(),
        findsOneWidget,
      );

      final body = tester.getRect(find.byType(ListView));
      final button = tester.getRect(
        find.widgetWithText(FilledButton, 'Đặt lịch dịch vụ ngay'),
      );
      expect(body.height, greaterThan(size.height / 2));
      expect(button.top, greaterThanOrEqualTo(body.bottom));
      expect(button.bottom, lessThanOrEqualTo(size.height));
    });
  }
}
