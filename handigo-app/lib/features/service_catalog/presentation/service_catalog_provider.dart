import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../data/service_catalog_repository.dart';
import '../domain/service_detail.dart';

final serviceCatalogRepositoryProvider = Provider<ServiceCatalogRepository>(
  (ref) => ServiceCatalogRepository(ref.watch(apiClientProvider)),
);

final serviceCatalogCategoriesProvider = FutureProvider((ref) =>
    ref.watch(serviceCatalogRepositoryProvider).categories());

final serviceCatalogServicesProvider = FutureProvider.family((ref, String? categoryId) =>
    ref.watch(serviceCatalogRepositoryProvider).services(categoryId: categoryId));

final serviceDetailProvider = FutureProvider.family<ServiceDetail, String>((ref, id) =>
    ref.watch(serviceCatalogRepositoryProvider).detail(id));
