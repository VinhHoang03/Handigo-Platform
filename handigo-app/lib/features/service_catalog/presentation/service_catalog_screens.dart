import '../../../shared/widgets/service_images.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../account/presentation/account_screens.dart';
import '../../../app/providers/app_providers.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import '../../orders/presentation/order_screens.dart';
import '../../booking/data/pending_booking_store.dart';
import '../../booking/presentation/booking_provider_selector.dart';
import '../../booking/presentation/booking_policy_panel.dart';
import '../../../app/theme/app_theme.dart';
import '../../booking/domain/booking_models.dart';
import '../../booking/presentation/booking_provider.dart';
import '../../services/domain/service.dart';
import '../../services/domain/service_category.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../../../core/network/api_exception.dart';
import '../domain/service_detail.dart';
import '../domain/automatic_promotion.dart';
import 'service_catalog_provider.dart';
import 'service_reviews_screen.dart';
import 'service_option_selector.dart';
import 'booking_schedule_selector.dart';
import 'booking_note_input.dart';
import 'booking_address_selector.dart';
import 'booking_voucher_selector.dart';

enum _CatalogSort {
  popular('Phổ biến nhất'),
  price('Giá thấp nhất'),
  rating('Đánh giá cao');

  const _CatalogSort(this.label);
  final String label;
}

class ServiceCatalogScreen extends ConsumerStatefulWidget {
  const ServiceCatalogScreen({
    this.initialSearch,
    this.initialCategoryId,
    super.key,
  });
  final String? initialSearch;
  final String? initialCategoryId;
  @override
  ConsumerState<ServiceCatalogScreen> createState() =>
      _ServiceCatalogScreenState();
}

class _ServiceCatalogScreenState extends ConsumerState<ServiceCatalogScreen> {
  late String? _categoryId = widget.initialCategoryId;
  late String _search = widget.initialSearch ?? '';
  late final TextEditingController _searchController = TextEditingController(
    text: _search,
  );
  _CatalogSort _sort = _CatalogSort.popular;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _showFilters(List<ServiceCategory> categories) async {
    var categoryId = _categoryId;
    var sort = _sort;
    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Lọc dịch vụ',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              const Text('Danh mục'),
              _CategoryChips(
                categories: categories,
                selectedId: categoryId,
                onSelected: (value) => setSheetState(() => categoryId = value),
              ),
              const SizedBox(height: 16),
              const Text('Sắp xếp'),
              _SortChips(
                selected: sort,
                onSelected: (value) => setSheetState(() => sort = value),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Áp dụng'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (applied == true && mounted) {
      setState(() {
        _categoryId = categoryId;
        _sort = sort;
      });
    }
  }

  List<Service> _visibleServices(List<Service> items) {
    final keyword = _search.trim().toLowerCase();
    final visible = items
        .where(
          (service) =>
              keyword.isEmpty ||
              '${service.name} ${service.description}'.toLowerCase().contains(
                keyword,
              ),
        )
        .toList();
    visible.sort((a, b) {
      final comparison = switch (_sort) {
        _CatalogSort.popular => b.totalCompletedOrders.compareTo(
          a.totalCompletedOrders,
        ),
        _CatalogSort.price =>
          (a.fixedPrice ?? a.minOptionPrice ?? double.infinity).compareTo(
            b.fixedPrice ?? b.minOptionPrice ?? double.infinity,
          ),
        _CatalogSort.rating => b.averageRating.compareTo(a.averageRating),
      };
      if (comparison != 0) return comparison;
      final feedbackComparison = b.totalFeedbacks.compareTo(a.totalFeedbacks);
      return feedbackComparison != 0
          ? feedbackComparison
          : a.name.compareTo(b.name);
    });
    return visible;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final categories = ref.watch(serviceCatalogCategoriesProvider);
    final services = ref.watch(serviceCatalogServicesProvider(_categoryId));
    final promotion = ref.watch(serviceCatalogPromotionProvider).asData?.value;
    final visible = _visibleServices(services.asData?.value.items ?? const []);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: scheme.surface,
        surfaceTintColor: Colors.transparent,
        shape: Border(
          bottom: BorderSide(
            color: scheme.outlineVariant.withValues(alpha: .3),
          ),
        ),
        title: Row(
          children: [
            Icon(Icons.handyman_outlined, color: scheme.primary, size: 24),
            const SizedBox(width: 8),
            Text(
              'Handigo',
              style: theme.textTheme.titleLarge?.copyWith(
                color: scheme.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => context.push('/customer/notifications'),
            icon: const Icon(Icons.notifications_none_rounded),
            tooltip: 'Thông báo',
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(serviceCatalogCategoriesProvider);
            ref.invalidate(serviceCatalogServicesProvider(_categoryId));
            ref.invalidate(accountVouchersProvider);
            await ref.read(serviceCatalogServicesProvider(_categoryId).future);
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              onChanged: (value) =>
                                  setState(() => _search = value),
                              textInputAction: TextInputAction.search,
                              style: theme.textTheme.bodyMedium,
                              decoration: InputDecoration(
                                hintText: 'Tìm dịch vụ: máy lạnh, ống nước...',
                                hintStyle: theme.textTheme.bodySmall?.copyWith(
                                  color: scheme.outline,
                                ),
                                prefixIcon: Icon(
                                  Icons.search,
                                  size: 20,
                                  color: scheme.outline,
                                ),
                                fillColor: scheme.surfaceContainerLowest,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 14,
                                ),
                                suffixIcon: _search.isEmpty
                                    ? null
                                    : IconButton(
                                        tooltip: 'Xóa tìm kiếm',
                                        icon: const Icon(Icons.close, size: 20),
                                        onPressed: () {
                                          _searchController.clear();
                                          setState(() => _search = '');
                                        },
                                      ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            onPressed: () => _showFilters(
                              categories.asData?.value ?? const [],
                            ),
                            style: IconButton.styleFrom(
                              backgroundColor: scheme.primaryContainer,
                              foregroundColor: scheme.onPrimary,
                              minimumSize: const Size(48, 48),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            icon: const Icon(Icons.tune, size: 22),
                            tooltip: 'Lọc dịch vụ',
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      categories.when(
                        loading: () =>
                            const SizedBox(height: 48, child: AppLoading()),
                        error: (error, _) => AppMessage(
                          message: 'Không thể tải danh mục dịch vụ.',
                          onRetry: () =>
                              ref.invalidate(serviceCatalogCategoriesProvider),
                        ),
                        data: (items) => _CategoryChips(
                          categories: items,
                          selectedId: _categoryId,
                          onSelected: (id) => setState(() => _categoryId = id),
                        ),
                      ),
                      if (promotion != null) ...[
                        const SizedBox(height: 16),
                        _CatalogPromotionBanner(voucher: promotion),
                      ],
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Tất cả dịch vụ',
                              style: theme.textTheme.titleLarge?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          if (services.hasValue)
                            Text(
                              '${visible.length} dịch vụ khả dụng',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: scheme.onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      _SortChips(
                        selected: _sort,
                        onSelected: (sort) => setState(() => _sort = sort),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ),
              services.when(
                loading: () => const SliverToBoxAdapter(
                  child: SizedBox(height: 240, child: AppLoading()),
                ),
                error: (error, _) => SliverToBoxAdapter(
                  child: AppMessage(
                    message: 'Không thể tải danh sách dịch vụ.',
                    onRetry: () => ref.invalidate(
                      serviceCatalogServicesProvider(_categoryId),
                    ),
                  ),
                ),
                data: (_) => visible.isEmpty
                    ? const SliverToBoxAdapter(
                        child: AppMessage(message: 'Không có dịch vụ phù hợp.'),
                      )
                    : SliverPadding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        sliver: SliverList.separated(
                          itemCount: visible.length,
                          separatorBuilder: (_, index) =>
                              const SizedBox(height: 12),
                          itemBuilder: (_, index) => _ServiceListTile(
                            key: ValueKey(visible[index].id),
                            service: visible[index],
                          ),
                        ),
                      ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          ),
        ),
      ),
    );
  }
}

class _CatalogPromotionBanner extends StatelessWidget {
  const _CatalogPromotionBanner({required this.voucher});
  final AutomaticPromotion voucher;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primary, Color(0xFF6256EB)],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.primaryDark.withValues(alpha: .4)),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: .12),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: null,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryFixed,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.local_fire_department_outlined,
                              size: 14,
                              color: AppTheme.primaryDark,
                            ),
                            SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                'Ưu đãi đang diễn ra',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: AppTheme.primaryDark,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        voucher.name,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          height: 1.15,
                        ),
                      ),
                      if (voucher.description?.trim().isNotEmpty == true) ...[
                        const SizedBox(height: 6),
                        Text(
                          voucher.description!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  constraints: const BoxConstraints(maxWidth: 112),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: .18),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: .25),
                    ),
                  ),
                  child: Column(
                    children: [
                      Text(
                        voucher.discountType == 'PERCENT'
                            ? '-${voucher.discountValue.toStringAsFixed(0)}%'
                            : '-${NumberFormat.decimalPattern('vi').format(voucher.discountValue)}đ',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Tự động áp dụng',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CategoryChips extends StatelessWidget {
  const _CategoryChips({
    required this.categories,
    required this.selectedId,
    required this.onSelected,
  });
  final List<ServiceCategory> categories;
  final String? selectedId;
  final ValueChanged<String?> onSelected;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        _CatalogChip(
          label: 'Tất cả',
          selected: selectedId == null,
          onPressed: () => onSelected(null),
        ),
        ...categories.map(
          (category) => Padding(
            padding: const EdgeInsets.only(left: 8),
            child: _CatalogChip(
              label: category.name,
              selected: selectedId == category.id,
              onPressed: () => onSelected(category.id),
            ),
          ),
        ),
      ],
    ),
  );
}

class _SortChips extends StatelessWidget {
  const _SortChips({required this.selected, required this.onSelected});
  final _CatalogSort selected;
  final ValueChanged<_CatalogSort> onSelected;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: _CatalogSort.values
          .map(
            (sort) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _CatalogChip(
                label: sort.label,
                selected: selected == sort,
                onPressed: () => onSelected(sort),
              ),
            ),
          )
          .toList(),
    ),
  );
}

class _CatalogChip extends StatelessWidget {
  const _CatalogChip({
    required this.label,
    required this.selected,
    required this.onPressed,
  });
  final String label;
  final bool selected;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onPressed(),
      materialTapTargetSize: MaterialTapTargetSize.padded,
    );
  }
}

class _ServiceListTile extends StatelessWidget {
  const _ServiceListTile({required this.service, super.key});
  final Service service;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final price = service.fixedPrice ?? service.minOptionPrice;
    final category = service.categoryName;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: .3)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/customer/services/${service.id}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  ServiceCoverImage(
                    url:
                        service.coverImage ?? service.galleryImages.firstOrNull,
                    name: service.name,
                    fit: BoxFit.cover,
                  ),
                  if (category != null && category.trim().isNotEmpty)
                    Positioned(
                      top: 8,
                      left: 8,
                      right: 8,
                      child: Align(
                        alignment: Alignment.topLeft,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: scheme.secondaryContainer,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            category,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: scheme.onSecondaryContainer,
                            ),
                          ),
                        ),
                      ),
                    ),
                  if (service.totalFeedbacks > 0)
                    Positioned(
                      bottom: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: scheme.surfaceContainerLowest.withValues(
                            alpha: .95,
                          ),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.star_rounded,
                              color: AppTheme.starGold,
                              size: 14,
                            ),
                            const SizedBox(width: 3),
                            Text(
                              '${service.averageRating.toStringAsFixed(1)} (${service.totalFeedbacks})',
                              style: theme.textTheme.labelSmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                service.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                service.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 16),
              LayoutBuilder(
                builder: (context, constraints) {
                  final priceBlock = Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (price != null)
                        Text(
                          'Giá từ',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: scheme.outline,
                          ),
                        ),
                      Text(
                        price == null
                            ? 'Liên hệ để biết giá'
                            : '${NumberFormat.decimalPattern('vi').format(price)}đ',
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  );
                  final button = FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: scheme.primaryContainer,
                      foregroundColor: scheme.onPrimary,
                      minimumSize: const Size(96, 48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: () =>
                        context.push('/customer/services/${service.id}'),
                    child: const Text('Đặt ngay'),
                  );
                  if (constraints.maxWidth < 280 ||
                      MediaQuery.textScalerOf(context).scale(14) > 20) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        priceBlock,
                        const SizedBox(height: 8),
                        Align(alignment: Alignment.centerRight, child: button),
                      ],
                    );
                  }
                  return Row(
                    children: [
                      Expanded(child: priceBlock),
                      const SizedBox(width: 12),
                      button,
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({required this.serviceId, super.key});
  final String serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(serviceDetailProvider(serviceId));
    final value = detail.asData?.value;
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết dịch vụ')),
      body: detail.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: 'Không thể tải chi tiết dịch vụ.',
          onRetry: () => ref.invalidate(serviceDetailProvider(serviceId)),
        ),
        data: (value) => _ServiceDetailContent(detail: value),
      ),
      bottomNavigationBar: value == null
          ? null
          : _StickyBookingBar(
              service: value.service,
              priceLabel: value.options.isEmpty
                  ? _priceLabel(value.service)
                  : 'Từ ${_money(value.options.map((option) => option.price).reduce((a, b) => a < b ? a : b))}',
              onPressed: () => _openBooking(context, ref, value),
            ),
    );
  }
}

class _ServiceDetailContent extends ConsumerWidget {
  const _ServiceDetailContent({required this.detail});
  final ServiceDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = detail.service;
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.only(bottom: 112),
      children: [
        ServiceImageGallery(
          key: ValueKey(
            [
              service.id,
              service.coverImage,
              ...service.galleryImages,
            ].join('|'),
          ),
          images: service.galleryImages,
          coverImage: service.coverImage,
          name: service.name,
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (service.categoryName != null)
                Text(
                  service.categoryName!,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.secondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              const SizedBox(height: 8),
              Text(
                service.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 14,
                runSpacing: 6,
                children: [
                  _ServiceStat(
                    icon: Icons.star_rounded,
                    color: AppTheme.starGold,
                    label: service.totalFeedbacks > 0
                        ? '${service.averageRating.toStringAsFixed(1)} (${service.totalFeedbacks} đánh giá)'
                        : 'Chưa có đánh giá',
                  ),
                  _ServiceStat(
                    icon: Icons.check_circle_outline,
                    color: theme.colorScheme.primary,
                    label: '${service.totalCompletedOrders} lượt hoàn thành',
                  ),
                ],
              ),
              if (service.description.trim().isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(service.description, style: theme.textTheme.bodyMedium),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        _ServiceHighlights(),
        if (service.processSteps.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Quy trình thực hiện',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                for (final entry in service.processSteps.asMap().entries)
                  _ProcessStep(
                    number: entry.key + 1,
                    title: entry.value.title,
                    description: entry.value.description,
                    isLast: entry.key == service.processSteps.length - 1,
                  ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: ServiceReviewPreview(serviceId: service.id),
        ),
      ],
    );
  }
}

class _ServiceHighlights extends StatelessWidget {
  const _ServiceHighlights();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const items = [
      (Icons.verified_user_outlined, 'Thợ đã xác thực'),
      (Icons.schedule_outlined, 'Đặt lịch linh hoạt'),
      (Icons.receipt_long_outlined, 'Giá minh bạch'),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0) const SizedBox(width: 8),
            Expanded(
              child: Container(
                constraints: const BoxConstraints(minHeight: 72),
                padding: const EdgeInsets.symmetric(
                  horizontal: 6,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: theme.colorScheme.outlineVariant),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      items[index].$1,
                      size: 20,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(height: 5),
                    Text(
                      items[index].$2,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ServiceStat extends StatelessWidget {
  const _ServiceStat({
    required this.icon,
    required this.color,
    required this.label,
  });
  final IconData icon;
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, color: color, size: 18),
      const SizedBox(width: 4),
      Flexible(
        child: Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
    ],
  );
}

void _openBooking(BuildContext context, WidgetRef ref, ServiceDetail detail) {
  final controller = ref.read(bookingDraftProvider.notifier);
  if (ref.read(bookingDraftProvider).serviceId != detail.service.id) {
    controller.reset();
    controller.startService(detail.service.id);
  }
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    constraints: BoxConstraints.tightFor(
      height: MediaQuery.sizeOf(context).height * .65,
    ),
    clipBehavior: Clip.antiAlias,
    builder: (_) => BookingScreen(detail: detail, isSheet: true),
  );
}

class _StickyBookingBar extends StatelessWidget {
  const _StickyBookingBar({
    required this.service,
    required this.priceLabel,
    required this.onPressed,
  });
  final Service service;
  final String priceLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
              blurRadius: 18,
              offset: Offset(0, 6),
              color: Color(0x33000000),
            ),
          ],
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final price = Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Giá từ', style: Theme.of(context).textTheme.labelSmall),
                Text(
                  priceLabel.replaceFirst(RegExp(r'^Từ\s+'), ''),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: scheme.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            );
            final button = FilledButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.calendar_month_outlined, size: 18),
              iconAlignment: IconAlignment.end,
              label: const Text(
                'Đặt lịch dịch vụ ngay',
                textAlign: TextAlign.center,
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size(0, 48),
                foregroundColor: scheme.onPrimary,
                textStyle: Theme.of(
                  context,
                ).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            );
            if (MediaQuery.textScalerOf(context).scale(14) > 20) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  price,
                  const SizedBox(height: 8),
                  Align(alignment: Alignment.centerRight, child: button),
                ],
              );
            }
            return Row(
              children: [
                Expanded(child: price),
                const SizedBox(width: 12),
                SizedBox(width: constraints.maxWidth * .58, child: button),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _ProcessStep extends StatelessWidget {
  const _ProcessStep({
    required this.number,
    required this.title,
    required this.description,
    required this.isLast,
  });
  final int number;
  final String title, description;
  final bool isLast;
  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Column(
          children: [
            const SizedBox(height: 10),
            CircleAvatar(
              radius: 14,
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              child: Text(
                '$number',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (!isLast)
              Expanded(
                child: Container(
                  width: 2,
                  color: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: .18),
                ),
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class BookingRouteScreen extends ConsumerWidget {
  const BookingRouteScreen({required this.serviceId, super.key});

  final String serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(serviceDetailProvider(serviceId));
    return detail.when(
      loading: () => const Scaffold(body: AppLoading()),
      error: (_, __) => Scaffold(
        body: AppMessage(
          message: 'Không thể tải dịch vụ để đặt lịch.',
          onRetry: () => ref.invalidate(serviceDetailProvider(serviceId)),
        ),
      ),
      data: (value) => BookingScreen(detail: value),
    );
  }
}

class BookingScreen extends ConsumerStatefulWidget {
  const BookingScreen({required this.detail, this.isSheet = false, super.key});
  final ServiceDetail detail;
  final bool isSheet;
  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  int _step = 0;
  bool _busy = false;
  BookingPreview? _preview;
  List<Address> _addresses = const [];
  final _descriptionController = TextEditingController();
  final _voucherController = TextEditingController();
  bool _policyAccepted = false;
  Map<String, dynamic>? _policies;
  String? _pendingOrderId;
  bool _uncertainCreate = false;
  bool _uploading = false;
  bool get _inspection => widget.detail.service.serviceType == 'variable_price';
  bool get _uniformQuantity =>
      widget.detail.options.isEmpty &&
      (widget.detail.service.slug == 've-sinh-dieu-hoa' ||
          (widget.detail.service.slug == null &&
              widget.detail.service.name.toLowerCase().trim() ==
                  'vệ sinh điều hòa')) &&
      widget.detail.service.serviceType == 'fixed_price';

  @override
  void initState() {
    super.initState();
    final draft = ref.read(bookingDraftProvider);
    _descriptionController.text = draft.problemDescription;
    _voucherController.text = draft.voucherCode ?? '';
    if (_inspection && draft.paymentMethod == PaymentMethod.cash)
      Future.microtask(
        () => ref
            .read(bookingDraftProvider.notifier)
            .setPaymentMethod(PaymentMethod.bank),
      );
    Future<void>.microtask(() async {
      await Future.wait([
        _loadAddresses(),
        _reloadPolicies(),
        _restorePending(),
      ]);
    });
  }

  Future<void> _loadAddresses() async {
    try {
      final addresses = await ref
          .read(serviceCatalogRepositoryProvider)
          .addresses();
      if (mounted) {
        final selectedId = ref.read(bookingDraftProvider).addressId;
        if (addresses.isNotEmpty &&
            !addresses.any((address) => address.id == selectedId)) {
          final address =
              addresses.where((address) => address.isDefault).firstOrNull ??
              addresses.first;
          ref.read(bookingDraftProvider.notifier).setAddress(address.id);
        }
        setState(() => _addresses = addresses);
      }
    } catch (_) {
      if (mounted)
        AppToast.show(
          context,
          'Không thể tải sổ địa chỉ. Vui lòng thử lại.',
          type: AppToastType.error,
        );
    }
  }

  Future<void> _restorePending() async {
    final userId = ref.read(authControllerProvider).user?.id;
    if (userId == null) return;
    try {
      var pending = await const PendingBookingStore().read(userId);
      if (!mounted) return;
      if (pending != null) {
        try {
          final current = await ref
              .read(orderRepositoryProvider)
              .detail(pending);
          if (current.paymentStatus != 'unpaid' ||
              current.depositPaidAt != null ||
              current.paymentMethod == 'cash' ||
              ['completed', 'cancelled'].contains(current.status)) {
            await const PendingBookingStore().clear(userId);
            pending = null;
          }
        } on ApiException catch (error) {
          if (error.statusCode == 404) {
            await const PendingBookingStore().clear(userId);
            pending = null;
          }
        }
      }
      if (mounted) setState(() => _pendingOrderId = pending);
    } catch (_) {
      /* Sổ địa chỉ và chính sách vẫn tải độc lập khi chưa đọc được đơn chờ. */
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _voucherController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingDraftProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(_step == 0 ? 'Đặt dịch vụ' : 'Xác nhận & Thanh toán'),
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => _step == 0
              ? Navigator.of(context).pop()
              : setState(() => _step = 0),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      body: _busy
          ? const AppLoading()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                _StepIndicator(step: _step),
                const SizedBox(height: 16),
                if (_step == 0)
                  _BookingForm(
                    detail: widget.detail,
                    addresses: _addresses,
                    descriptionController: _descriptionController,
                    voucherController: _voucherController,
                    onAddAddress: _addAddress,
                    onUploadingChanged: (value) {
                      if (mounted) setState(() => _uploading = value);
                    },
                  )
                else
                  _BookingReview(
                    detail: widget.detail,
                    draft: draft,
                    preview: _preview,
                  ),
                if (_addresses.isEmpty && _step == 0)
                  OutlinedButton(
                    onPressed: _loadAddresses,
                    child: const Text('Tải lại sổ địa chỉ'),
                  ),
                if (_pendingOrderId != null)
                  Card(
                    child: ListTile(
                      title: const Text('Bạn có đơn đang cần kiểm tra'),
                      trailing: const Icon(Icons.arrow_forward),
                      onTap: () =>
                          context.push('/customer/orders/$_pendingOrderId'),
                    ),
                  ),
                if (_step == 0 && _uniformQuantity)
                  Row(
                    children: [
                      const Expanded(child: Text('Số lượng máy')),
                      IconButton(
                        onPressed: () => ref
                            .read(bookingDraftProvider.notifier)
                            .setUniformQuantity(draft.uniformQuantity - 1),
                        icon: const Icon(Icons.remove),
                      ),
                      Text('${draft.uniformQuantity}'),
                      IconButton(
                        onPressed: () => ref
                            .read(bookingDraftProvider.notifier)
                            .setUniformQuantity(draft.uniformQuantity + 1),
                        icon: const Icon(Icons.add),
                      ),
                    ],
                  ),
                if (_step == 1) ...[
                  if (_policies == null)
                    OutlinedButton(
                      onPressed: _reloadPolicies,
                      child: const Text('Tải lại chính sách đặt dịch vụ'),
                    )
                  else
                    BookingPolicyPanel(policies: _policies!),
                  CheckboxListTile(
                    value: _policyAccepted,
                    onChanged: _policies == null
                        ? null
                        : (value) =>
                              setState(() => _policyAccepted = value == true),
                    title: const Text(
                      'Tôi đã đọc và đồng ý với chính sách Handigo',
                    ),
                  ),
                  for (final address in _addresses.where(
                    (item) => item.id == draft.addressId,
                  ))
                    ListTile(
                      title: Text(
                        '${address.recipientName} · ${address.recipientPhone}',
                      ),
                      subtitle: Text(address.displayAddress),
                    ),
                  for (final option in widget.detail.options.where(
                    (item) => draft.selectedOptionIds.contains(item.id),
                  ))
                    ListTile(
                      title: Text(option.name),
                      trailing: Text('× ${draft.quantities[option.id] ?? 1}'),
                    ),
                ],
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _busy || _uploading
                ? null
                : () => _step == 0 ? _loadPreview() : _submitOrder(),
            child: Text(
              _busy
                  ? 'Đang xử lý...'
                  : _step == 0
                  ? 'Tiếp tục'
                  : _inspection
                  ? 'Thanh toán tiền cọc'
                  : draft.paymentMethod == PaymentMethod.cash
                  ? 'Xác nhận đặt dịch vụ'
                  : 'Thanh toán ngay',
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _reloadPolicies() async {
    try {
      final policies = await ref
          .read(serviceCatalogRepositoryProvider)
          .bookingPolicies();
      if (mounted) setState(() => _policies = policies);
    } catch (_) {
      if (mounted)
        AppToast.show(
          context,
          'Chưa thể tải chính sách. Vui lòng thử lại.',
          type: AppToastType.error,
        );
    }
  }

  String? _validateDraft(BookingDraft draft) {
    final timeError = bookingTimeError(draft, DateTime.now());
    if (timeError != null) return timeError;
    if (_inspection && draft.paymentMethod == PaymentMethod.cash)
      return 'Tiền cọc khảo sát cần thanh toán qua PayOS hoặc ví Handigo.';
    return null;
  }

  Future<void> _loadPreview() async {
    final draft = ref.read(bookingDraftProvider);
    if (_busy) return;
    final selectionError = widget.detail.selectionError(
      draft.selectedOptionIds,
    );
    if (selectionError != null) {
      AppToast.show(context, selectionError, type: AppToastType.warning);
      return;
    }
    if (draft.addressId == null) {
      AppToast.show(
        context,
        'Vui lòng chọn địa chỉ thực hiện.',
        type: AppToastType.warning,
      );
      return;
    }
    final validation = _validateDraft(draft);
    if (validation != null) {
      AppToast.show(context, validation, type: AppToastType.warning);
      return;
    }
    if ((draft.type == BookingType.scheduled ||
            draft.type == BookingType.recurring) &&
        draft.scheduledAt == null) {
      AppToast.show(
        context,
        'Vui lòng chọn lịch thực hiện.',
        type: AppToastType.warning,
      );
      return;
    }
    setState(() {
      _busy = true;
    });
    try {
      final providerQuery = bookingProviderQuery(draft);
      if (providerQuery == null)
        throw const ApiException('Vui lòng chọn địa chỉ và lịch thực hiện.');
      final providers = await ref.read(
        bookingNearbyProviders(providerQuery).future,
      );
      if (providers.isEmpty)
        throw const ApiException(
          'Chưa có chuyên gia phù hợp. Vui lòng đổi lịch hoặc địa chỉ.',
        );
      if (draft.preferredProviderId != null &&
          !providers.any((item) => item['id'] == draft.preferredProviderId))
        throw const ApiException(
          'Chuyên gia đã chọn không còn phù hợp. Vui lòng chọn lại.',
        );
      final preview = await ref
          .read(serviceCatalogRepositoryProvider)
          .preview(
            serviceId: widget.detail.service.id,
            type: draft.type,
            selectedOptions: _selectedOptions(draft),
            voucherCode: draft.voucherCode,
            uniformQuantity: _uniformQuantity ? draft.uniformQuantity : null,
          );
      if (mounted)
        setState(() {
          _preview = preview;
          _step = 1;
        });
    } catch (error) {
      if (mounted) {
        AppToast.show(
          context,
          error is ApiException
              ? error.message
              : 'Không thể tính tổng tiền. Vui lòng thử lại.',
          type: AppToastType.error,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitOrder() async {
    if (_busy) return;
    final draft = ref.read(bookingDraftProvider);
    final validation = _validateDraft(draft);
    if (validation != null ||
        !_policyAccepted ||
        _policies == null ||
        _preview == null) {
      AppToast.show(
        context,
        validation ?? 'Vui lòng đọc và đồng ý chính sách trước khi đặt đơn.',
        type: AppToastType.warning,
      );
      return;
    }
    if (_uncertainCreate) {
      AppToast.show(
        context,
        'Chưa xác định kết quả tạo đơn. Vui lòng kiểm tra lịch sử đơn trước khi đặt lại.',
        type: AppToastType.warning,
      );
      context.push('/customer/orders');
      return;
    }
    if (_pendingOrderId != null) {
      context.push('/customer/orders/$_pendingOrderId');
      return;
    }
    setState(() => _busy = true);
    CreatedOrder? created;
    final userId = ref.read(authControllerProvider).user!.id;
    try {
      final repository = ref.read(serviceCatalogRepositoryProvider);
      created = await repository.createOrder(
        serviceId: widget.detail.service.id,
        selectedOptions: _selectedOptions(draft),
        addressId: draft.addressId!,
        type: draft.type,
        paymentMethod: draft.paymentMethod,
        scheduledAt: draft.scheduledAt,
        recurrenceUnit: draft.recurrenceUnit,
        recurrenceCount: draft.recurrenceCount,
        problemDescription: _descriptionController.text,
        attachments: draft.attachments,
        voucherCode: draft.voucherCode,
        preferredProviderId: draft.preferredProviderId,
        uniformQuantity: _uniformQuantity ? draft.uniformQuantity : null,
        expectedBookingAmount: _preview!.bookingAmount,
        expectedFinalAmount: _preview!.discountedAmount,
      );
      _pendingOrderId = created.id;
      await const PendingBookingStore().save(userId, created.id);
      final payment = await repository.createPayment(
        orderId: created.id,
        method: draft.paymentMethod,
        inspectionRequired: _inspection,
        expectedAmount: _preview!.discountedAmount,
      );
      if (!mounted) return;
      ref.read(bookingDraftProvider.notifier).reset();
      ref.invalidate(orderListProvider);
      ref.invalidate(orderPageProvider);
      ref.invalidate(pendingOrderProvider);
      context.go('/customer/bookings/success?orderId=${created.id}');
      if (payment.checkoutUrl != null && payment.status != 'paid') {
        final uri = Uri.tryParse(payment.checkoutUrl!);
        if (uri != null && ['http', 'https'].contains(uri.scheme))
          await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (failure) {
      if (!mounted) return;
      if (created != null) {
        ref.invalidate(orderListProvider);
        AppToast.show(
          context,
          failure is ApiException
              ? failure.message
              : 'Đơn đã tạo. Vui lòng tiếp tục thanh toán từ chi tiết đơn.',
          type: AppToastType.warning,
        );
        context.go('/customer/orders/${created.id}');
      } else {
        _uncertainCreate =
            failure is! ApiException ||
            failure.statusCode == null ||
            failure.statusCode! >= 500;
        if (failure is ApiException && failure.statusCode == 409)
          setState(() {
            _step = 0;
            _preview = null;
            _policyAccepted = false;
          });
        AppToast.show(
          context,
          _uncertainCreate
              ? 'Chưa xác định kết quả tạo đơn. Kiểm tra lịch sử đơn trước khi đặt lại.'
              : failure is ApiException
              ? failure.message
              : 'Không thể tạo đơn.',
          type: AppToastType.error,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<Map<String, dynamic>> _selectedOptions(BookingDraft draft) => draft
      .selectedOptionIds
      .map((id) => {'optionId': id, 'quantity': draft.quantities[id] ?? 1})
      .toList();

  Future<void> _addAddress() async {
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => const _AddAddressDialog(),
    );
    if (result == null || !mounted) return;
    try {
      final address = await ref
          .read(serviceCatalogRepositoryProvider)
          .createAddress(
            recipientName: result['recipientName']!,
            recipientPhone: result['recipientPhone']!,
            fullAddress: result['fullAddress']!,
            province: result['province']!,
            ward: result['ward']!,
            latitude: double.tryParse(result['latitude'] ?? ''),
            longitude: double.tryParse(result['longitude'] ?? ''),
          );
      if (!mounted) return;
      setState(() => _addresses = [..._addresses, address]);
      ref.read(bookingDraftProvider.notifier).setAddress(address.id);
      AppToast.show(context, 'Đã thêm địa chỉ.', type: AppToastType.success);
    } catch (_) {
      if (mounted)
        AppToast.show(
          context,
          'Không thể thêm địa chỉ. Vui lòng kiểm tra thông tin.',
          type: AppToastType.error,
        );
    }
  }
}

class _BookingForm extends ConsumerWidget {
  const _BookingForm({
    required this.detail,
    required this.addresses,
    required this.descriptionController,
    required this.voucherController,
    required this.onAddAddress,
    required this.onUploadingChanged,
  });
  final ServiceDetail detail;
  final List<Address> addresses;
  final TextEditingController descriptionController;
  final TextEditingController voucherController;
  final VoidCallback onAddAddress;
  final ValueChanged<bool> onUploadingChanged;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingDraftProvider);
    final controller = ref.read(bookingDraftProvider.notifier);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.location_on_outlined,
              size: 19,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Địa chỉ làm việc',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        BookingAddressSelector(
          addresses: addresses,
          onAddAddress: onAddAddress,
        ),
        const SizedBox(height: 12),
        if (detail.options.isNotEmpty) ...[
          Text('Chọn gói dịch vụ', style: theme.textTheme.titleMedium),
          ServiceOptionSelector(detail: detail),
          const SizedBox(height: 16),
        ],
        Text(
          'Thời gian thực hiện',
          style: theme.textTheme.titleMedium?.copyWith(
            color: theme.colorScheme.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        const BookingScheduleButton(),
        const SizedBox(height: 12),
        const Divider(height: 1),
        const SizedBox(height: 16),
        _SectionLabel(
          title: 'Ghi chú cho thợ',
          icon: Icons.sticky_note_2_outlined,
        ),
        BookingNoteInput(
          controller: descriptionController,
          onUploadingChanged: onUploadingChanged,
        ),
        const SizedBox(height: 16),
        const BookingProviderSelector(),
        const SizedBox(height: 8),
        BookingVoucherSelector(
          controller: voucherController,
          inspectionRequired: detail.service.serviceType == 'variable_price',
        ),
        const SizedBox(height: 8),
        const SizedBox(height: 12),
        _SectionLabel(
          title: 'Phương thức thanh toán',
          icon: Icons.payments_outlined,
        ),
        ...PaymentMethod.values
            .where(
              (method) =>
                  detail.service.serviceType != 'variable_price' ||
                  method != PaymentMethod.cash,
            )
            .map(
              (method) => Card(
                margin: const EdgeInsets.only(bottom: 6),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: BorderSide(
                    color: draft.paymentMethod == method
                        ? theme.colorScheme.primary
                        : theme.colorScheme.outlineVariant,
                    width: draft.paymentMethod == method ? 2 : 1,
                  ),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => controller.setPaymentMethod(method),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 12,
                    ),
                    child: Row(
                      children: [
                        _PaymentArtwork(method: method),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _paymentLabel(method),
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                _paymentHint(method),
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        Radio<PaymentMethod>(
                          value: method,
                          groupValue: draft.paymentMethod,
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                          activeColor: theme.colorScheme.primary,
                          onChanged: (value) {
                            if (value != null)
                              controller.setPaymentMethod(value);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
      ],
    );
  }
}

class _AddAddressDialog extends ConsumerStatefulWidget {
  const _AddAddressDialog();
  @override
  ConsumerState<_AddAddressDialog> createState() => _AddAddressDialogState();
}

class _AddAddressDialogState extends ConsumerState<_AddAddressDialog> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _province = TextEditingController();
  final _ward = TextEditingController();

  double? latitude, longitude;
  bool locating = false;
  String? locationError;
  Future<void> locate() async {
    if (locating) return;
    setState(() {
      locating = true;
      locationError = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled())
        throw const ApiException('Vui lòng bật vị trí thiết bị.');
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied)
        permission = await Geolocator.requestPermission();
      if ([
        LocationPermission.denied,
        LocationPermission.deniedForever,
      ].contains(permission))
        throw const ApiException(
          'Chưa cấp quyền vị trí. Bạn có thể nhập địa chỉ thủ công.',
        );
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      ).timeout(const Duration(seconds: 15));
      final response = await ref
          .read(apiClientProvider)
          .request(
            '/locations/reverse-geocode',
            query: {
              'latitude': position.latitude,
              'longitude': position.longitude,
            },
            authenticated: true,
          );
      if (!mounted) return;
      final data = response['data'] as Map;
      setState(() {
        latitude = position.latitude;
        longitude = position.longitude;
        _address.text = '${data['fullAddress'] ?? ''}';
        _province.text = '${data['province'] ?? ''}';
        _ward.text = '${data['ward'] ?? ''}';
      });
    } catch (failure) {
      if (mounted)
        setState(
          () => locationError = failure is ApiException
              ? failure.message
              : 'Chưa xác định được vị trí. Vui lòng thử lại.',
        );
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _province.dispose();
    _ward.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Thêm địa chỉ'),
    content: Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          children: [
            OutlinedButton.icon(
              onPressed: locating ? null : locate,
              icon: const Icon(Icons.my_location),
              label: Text(
                locating ? 'Đang xác định vị trí...' : 'Dùng vị trí hiện tại',
              ),
            ),
            if (locationError != null) Text(locationError!),
            _field(_name, 'Họ tên người nhận'),
            _field(_phone, 'Số điện thoại', keyboardType: TextInputType.phone),
            _field(_address, 'Địa chỉ đầy đủ'),
            _field(_province, 'Tỉnh/thành phố'),
            _field(_ward, 'Phường/xã'),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Hủy'),
      ),
      FilledButton(
        onPressed: () {
          if (_formKey.currentState!.validate())
            Navigator.pop(context, {
              'recipientName': _name.text.trim(),
              'recipientPhone': _phone.text.trim(),
              'fullAddress': _address.text.trim(),
              'province': _province.text.trim(),
              'ward': _ward.text.trim(),
              if (latitude != null) 'latitude': '$latitude',
              if (longitude != null) 'longitude': '$longitude',
            });
        },
        child: const Text('Lưu'),
      ),
    ],
  );

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: controller,
      onChanged: (_) {
        if (controller == _address ||
            controller == _province ||
            controller == _ward) {
          latitude = null;
          longitude = null;
        }
      },
      keyboardType: keyboardType,
      decoration: InputDecoration(labelText: label),
      validator: (value) =>
          value == null || value.trim().isEmpty ? 'Vui lòng nhập $label' : null,
    ),
  );
}

class _BookingReview extends StatelessWidget {
  const _BookingReview({
    required this.detail,
    required this.draft,
    required this.preview,
  });
  final ServiceDetail detail;
  final BookingDraft draft;
  final BookingPreview? preview;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Card(
        child: ListTile(
          leading: const Icon(Icons.home_repair_service_outlined),
          title: Text(
            detail.service.name,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          subtitle: Text(
            '${_bookingTypeLabel(draft.type)} · ${_paymentLabel(draft.paymentMethod)}',
          ),
        ),
      ),
      const SizedBox(height: 12),
      if (draft.scheduledAt != null)
        Card(
          child: ListTile(
            leading: const Icon(Icons.calendar_month_outlined),
            title: const Text('Lịch hẹn'),
            subtitle: Text(_date(draft.scheduledAt!)),
          ),
        ),
      const SizedBox(height: 8),
      Text(
        'Chi tiết thanh toán',
        style: Theme.of(
          context,
        ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
      ),
      if (preview != null)
        Card(
          margin: const EdgeInsets.only(top: 8),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                _PriceRow(label: 'Phí dịch vụ', value: preview!.baseAmount),
                if (preview!.promotionDiscountAmount > 0)
                  _PriceRow(
                    label: preview!.promotionName ?? 'Ưu đãi tự động',
                    value: -preview!.promotionDiscountAmount,
                  ),
                if (preview!.voucherDiscountAmount > 0)
                  _PriceRow(
                    label: 'Giảm giá từ voucher',
                    value: -preview!.voucherDiscountAmount,
                  ),
                if (preview!.immediateFee > 0)
                  _PriceRow(label: 'Phụ phí', value: preview!.immediateFee),
                if (draft.voucherCode != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Voucher đã chọn: ${draft.voucherCode}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                const Divider(),
                _PriceRow(
                  label: 'Tổng thanh toán',
                  value: preview!.discountedAmount,
                  emphasized: true,
                ),
                if (preview!.depositAmount > 0)
                  Text('Tiền đặt cọc: ${_money(preview!.depositAmount)}'),
              ],
            ),
          ),
        ),
      const SizedBox(height: 8),
      const Text(
        'Vui lòng kiểm tra thông tin và số tiền trước khi xác nhận đặt dịch vụ.',
      ),
    ],
  );
}

class BookingSuccessScreen extends ConsumerStatefulWidget {
  const BookingSuccessScreen({
    this.orderId,
    this.orderCode,
    this.paymentStatus,
    this.checkoutUrl,
    super.key,
  });
  final String? orderId;
  final String? orderCode;
  final String? paymentStatus;
  final String? checkoutUrl;
  @override
  ConsumerState<BookingSuccessScreen> createState() =>
      _BookingSuccessScreenState();
}

class _BookingSuccessScreenState extends ConsumerState<BookingSuccessScreen> {
  @override
  Widget build(BuildContext context) {
    final id = widget.orderId;
    if (id == null)
      return Scaffold(
        appBar: AppBar(title: const Text('Kết quả đặt dịch vụ')),
        body: Center(
          child: FilledButton(
            onPressed: () => context.go('/customer/orders'),
            child: const Text('Xem lịch sử đơn'),
          ),
        ),
      );
    return OrderDetailScreen(orderId: id);
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title, required this.icon});
  final String title;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      children: [
        Icon(icon, size: 19, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
      ],
    ),
  );
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.step});
  final int step;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final labels = ['Chọn gói & lịch', 'Thanh toán'];
    return Row(
      children: [
        for (var index = 0; index < labels.length; index++) ...[
          CircleAvatar(
            radius: 14,
            backgroundColor: index <= step
                ? theme.colorScheme.primary
                : theme.colorScheme.surfaceContainerHighest,
            foregroundColor: index <= step
                ? theme.colorScheme.onPrimary
                : theme.colorScheme.onSurfaceVariant,
            child: index < step
                ? const Icon(Icons.check, size: 16)
                : Text('${index + 1}'),
          ),
          const SizedBox(width: 8),
          Text(
            labels[index],
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: index == step ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
          if (index < labels.length - 1)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Divider(
                  color: index < step
                      ? theme.colorScheme.primary
                      : theme.colorScheme.outlineVariant,
                  thickness: 2,
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });
  final String label;
  final double value;
  final bool emphasized;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: emphasized
              ? const TextStyle(fontWeight: FontWeight.bold)
              : null,
        ),
        Text(
          _money(value),
          style: emphasized
              ? TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.primary,
                )
              : null,
        ),
      ],
    ),
  );
}

String _money(double value) =>
    '${NumberFormat.decimalPattern('vi').format(value)}đ';
String _priceLabel(Service service) {
  final price = service.fixedPrice ?? service.minOptionPrice;
  return price == null ? 'Liên hệ để biết giá' : 'Từ ${_money(price)}';
}

String _date(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
String _paymentLabel(PaymentMethod value) => switch (value) {
  PaymentMethod.wallet => 'Ví Handigo',
  PaymentMethod.bank => 'Chuyển khoản/PayOS',
  PaymentMethod.cash => 'Tiền mặt',
};

class _PaymentArtwork extends StatelessWidget {
  const _PaymentArtwork({required this.method});
  final PaymentMethod method;

  @override
  Widget build(BuildContext context) {
    final color = method == PaymentMethod.cash
        ? const Color(0xFF16864B)
        : Theme.of(context).colorScheme.primary;
    return Container(
      width: 44,
      height: 40,
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: method == PaymentMethod.bank
            ? Colors.white
            : color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: method == PaymentMethod.bank
          ? Image.asset(
              'assets/payments/payos-logo.png',
              fit: BoxFit.contain,
              semanticLabel: 'payOS',
            )
          : Icon(
              method == PaymentMethod.wallet
                  ? Icons.account_balance_wallet_rounded
                  : Icons.payments_rounded,
              color: color,
              size: 26,
            ),
    );
  }
}

String _paymentHint(PaymentMethod value) => switch (value) {
  PaymentMethod.wallet => 'Thanh toán nhanh bằng số dư ví Handigo',
  PaymentMethod.bank => 'Thanh toán qua cổng PayOS',
  PaymentMethod.cash => 'Thanh toán trực tiếp khi hoàn tất dịch vụ',
};
String _bookingTypeLabel(BookingType value) => switch (value) {
  BookingType.normal => 'Bình thường',
  BookingType.urgent => 'Khẩn cấp',
  BookingType.scheduled => 'Đặt lịch',
  BookingType.recurring => 'Định kỳ',
};
