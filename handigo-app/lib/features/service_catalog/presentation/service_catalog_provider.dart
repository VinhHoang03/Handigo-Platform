import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/automatic_promotion.dart';
import '../../../app/providers/app_providers.dart';
import '../data/service_catalog_repository.dart';
import '../domain/service_detail.dart';
import '../domain/service_review.dart';
import '../../../core/network/paged_result.dart';

final serviceCatalogRepositoryProvider = Provider<ServiceCatalogRepository>(
  (ref) => ServiceCatalogRepository(ref.watch(apiClientProvider)),
);

final serviceCatalogCategoriesProvider = FutureProvider(
  (ref) => ref.watch(serviceCatalogRepositoryProvider).categories(),
);

final serviceCatalogServicesProvider = FutureProvider.family(
  (ref, String? categoryId) => ref
      .watch(serviceCatalogRepositoryProvider)
      .services(categoryId: categoryId),
);

final serviceDetailProvider = FutureProvider.family<ServiceDetail, String>(
  (ref, id) => ref.watch(serviceCatalogRepositoryProvider).detail(id),
);

final serviceReviewsProvider = FutureProvider.autoDispose
    .family<PagedResult<ServiceReview>, ServiceReviewQuery>(
      (ref, query) =>
          ref.watch(serviceCatalogRepositoryProvider).reviews(query),
    );

final serviceCatalogPromotionProvider =
    FutureProvider.autoDispose<AutomaticPromotion?>((ref) async {
      final response = await ref.watch(apiClientProvider).request('/promotions/active');
      final data = response['data'];
      final promotions = data is List ? data.whereType<Map<String, dynamic>>().map(AutomaticPromotion.fromJson) : <AutomaticPromotion>[];
      final now = DateTime.now();
      for (final promotion in promotions) {
        final end = promotion.endAt;
        if (!end.isAfter(now)) {
          continue;
        }
        final timer = Timer(
          end.difference(now) + const Duration(milliseconds: 1),
          ref.invalidateSelf,
        );
        ref.onDispose(timer.cancel);
        return promotion;
      }
      return null;
    });
