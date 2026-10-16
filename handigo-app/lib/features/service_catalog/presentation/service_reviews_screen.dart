import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/service_images.dart';
import '../domain/service_review.dart';
import 'service_catalog_provider.dart';

class ServiceReviewPreview extends ConsumerWidget {
  const ServiceReviewPreview({required this.serviceId, super.key});
  final String serviceId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = (
      serviceId: serviceId,
      page: 1,
      rating: null,
      hasImages: false,
      keyword: '',
      optionId: null,
      positiveOnly: true,
    );
    final reviews = ref.watch(serviceReviewsProvider(query));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Đánh giá thực tế',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            TextButton(
              onPressed: () =>
                  context.push('/customer/services/$serviceId/reviews'),
              child: const Text('Xem tất cả ›'),
            ),
          ],
        ),
        Text(
          'Đánh giá nổi bật từ 4 sao',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 12),
        reviews.when(
          loading: () =>
              const Padding(padding: EdgeInsets.all(16), child: AppLoading()),
          error: (_, _) => AppMessage(
            message: 'Không thể tải đánh giá.',
            onRetry: () => ref.invalidate(serviceReviewsProvider(query)),
          ),
          data: (result) {
            final items =
                result.items.where((review) => review.rating >= 4).toList()
                  ..sort((a, b) {
                    final rating = b.rating.compareTo(a.rating);
                    return rating != 0
                        ? rating
                        : (b.createdAt ?? DateTime(0)).compareTo(
                            a.createdAt ?? DateTime(0),
                          );
                  });
            return items.isEmpty
                ? const Text('Chưa có đánh giá nổi bật.')
                : Column(
                    children: items
                        .take(4)
                        .map((review) => ServiceReviewCard(review: review))
                        .toList(),
                  );
          },
        ),
      ],
    );
  }
}

class ServiceReviewsScreen extends ConsumerStatefulWidget {
  const ServiceReviewsScreen({required this.serviceId, super.key});
  final String serviceId;
  @override
  ConsumerState<ServiceReviewsScreen> createState() =>
      _ServiceReviewsScreenState();
}

class _ServiceReviewsScreenState extends ConsumerState<ServiceReviewsScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;
  int _page = 1;
  int? _rating;
  bool _hasImages = false;
  String _keyword = '';
  String? _optionId;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _searchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) {
        setState(() {
          _keyword = value.trim();
          _page = 1;
        });
      }
    });
  }

  void _changePage(int page) {
    setState(() => _page = page);
    if (_scroll.hasClients) {
      _scroll.animateTo(
        0,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = (
      serviceId: widget.serviceId,
      page: _page,
      rating: _rating,
      hasImages: _hasImages,
      keyword: _keyword,
      optionId: _optionId,
      positiveOnly: false,
    );
    final reviews = ref.watch(serviceReviewsProvider(query));
    final detail = ref.watch(serviceDetailProvider(widget.serviceId));
    return Scaffold(
      appBar: AppBar(title: const Text('Đánh giá dịch vụ')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(serviceReviewsProvider(query));
          await ref.read(serviceReviewsProvider(query).future);
        },
        child: CustomScrollView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (detail.asData?.value case final value?) ...[
                      Text(
                        value.service.name,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        value.service.totalFeedbacks > 0
                            ? '${value.service.averageRating.toStringAsFixed(1)}/5 · ${value.service.totalFeedbacks} đánh giá'
                            : 'Chưa có đánh giá',
                      ),
                      const SizedBox(height: 16),
                    ],
                    TextField(
                      controller: _search,
                      maxLength: 100,
                      onChanged: _searchChanged,
                      decoration: InputDecoration(
                        hintText: 'Tìm trong nội dung đánh giá',
                        counterText: '',
                        prefixIcon: const Icon(Icons.search),
                        suffixIcon: IconButton(
                          tooltip: 'Xóa tìm kiếm',
                          icon: const Icon(Icons.close),
                          onPressed: () {
                            _search.clear();
                            _searchChanged('');
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (final rating in [null, 5, 4, 3, 2, 1])
                            Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(
                                  rating == null ? 'Tất cả sao' : '$rating sao',
                                ),
                                selected: rating == _rating,
                                onSelected: (_) => setState(() {
                                  _rating = rating;
                                  _page = 1;
                                }),
                              ),
                            ),
                        ],
                      ),
                    ),
                    FilterChip(
                      label: const Text('Có hình ảnh'),
                      avatar: const Icon(Icons.photo_outlined, size: 18),
                      selected: _hasImages,
                      onSelected: (value) => setState(() {
                        _hasImages = value;
                        _page = 1;
                      }),
                    ),
                    const SizedBox(height: 8),
                    detail.when(
                      loading: () => const LinearProgressIndicator(),
                      error: (_, _) => TextButton(
                        onPressed: () => ref.invalidate(
                          serviceDetailProvider(widget.serviceId),
                        ),
                        child: const Text('Tải lại bộ lọc gói dịch vụ'),
                      ),
                      data: (value) => value.options.isEmpty
                          ? const SizedBox.shrink()
                          : DropdownButtonFormField<String>(
                              key: ValueKey(_optionId),
                              initialValue: _optionId,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Gói dịch vụ',
                              ),
                              items: [
                                const DropdownMenuItem<String>(
                                  value: null,
                                  child: Text('Tất cả gói dịch vụ'),
                                ),
                                ...value.options.map(
                                  (option) => DropdownMenuItem(
                                    value: option.id,
                                    child: Text(
                                      option.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                              ],
                              onChanged: (value) => setState(() {
                                _optionId = value;
                                _page = 1;
                              }),
                            ),
                    ),
                    const SizedBox(height: 16),
                    const Text('Đánh giá mới nhất'),
                  ],
                ),
              ),
            ),
            ...reviews.when(
              loading: () => [const SliverToBoxAdapter(child: AppLoading())],
              error: (_, _) => [
                SliverToBoxAdapter(
                  child: AppMessage(
                    message: 'Không thể tải đánh giá.',
                    onRetry: () =>
                        ref.invalidate(serviceReviewsProvider(query)),
                  ),
                ),
              ],
              data: (result) => [
                if (result.items.isEmpty)
                  const SliverToBoxAdapter(
                    child: AppMessage(message: 'Không có đánh giá phù hợp.'),
                  ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList.builder(
                    itemCount: result.items.length,
                    itemBuilder: (_, index) => ServiceReviewCard(
                      key: ValueKey(result.items[index].id),
                      review: result.items[index],
                    ),
                  ),
                ),
                if (result.totalPages > 1)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            tooltip: 'Trang trước',
                            onPressed: _page > 1
                                ? () => _changePage(_page - 1)
                                : null,
                            icon: const Icon(Icons.chevron_left),
                          ),
                          Text('Trang $_page/${result.totalPages}'),
                          IconButton(
                            tooltip: 'Trang tiếp theo',
                            onPressed: _page < result.totalPages
                                ? () => _changePage(_page + 1)
                                : null,
                            icon: const Icon(Icons.chevron_right),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 24)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ServiceReviewCard extends StatelessWidget {
  const ServiceReviewCard({required this.review, super.key});
  final ServiceReview review;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final names = review.customerName
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    final initials = names.isEmpty
        ? 'KH'
        : names
              .take(2)
              .map((part) => part.characters.first)
              .join()
              .toUpperCase();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final inlineStars =
                    constraints.maxWidth >= 260 &&
                    MediaQuery.textScalerOf(context).scale(14) <= 20;
                final stars = Semantics(
                  label: '${review.rating} trên 5 sao',
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (var star = 1; star <= 5; star++)
                        Icon(
                          star <= review.rating
                              ? Icons.star_rounded
                              : Icons.star_outline_rounded,
                          size: 16,
                          color: AppTheme.starGold,
                        ),
                    ],
                  ),
                );
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      backgroundColor: theme.colorScheme.surfaceContainer,
                      foregroundColor: theme.colorScheme.primary,
                      child: review.avatar?.isNotEmpty == true
                          ? ClipOval(
                              child: Image.network(
                                review.avatar!,
                                width: 40,
                                height: 40,
                                fit: BoxFit.cover,
                                errorBuilder: (_, _, _) => Text(initials),
                              ),
                            )
                          : Text(initials),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            review.customerName,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (review.createdAt != null)
                            Text(
                              DateFormat(
                                'dd/MM/yyyy',
                              ).format(review.createdAt!.toLocal()),
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.outline,
                              ),
                            ),
                          if (!inlineStars) ...[
                            const SizedBox(height: 4),
                            stars,
                          ],
                        ],
                      ),
                    ),
                    if (inlineStars) ...[
                      const SizedBox(width: 8),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: stars,
                      ),
                    ],
                  ],
                );
              },
            ),
            if (review.optionNames.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  review.optionNames.join(' · '),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            if (review.comment.trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  review.comment,
                  style: theme.textTheme.bodyMedium?.copyWith(height: 1.5),
                ),
              ),
            if (review.images.isNotEmpty) ...[
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, constraints) => Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final url in review.images)
                      SizedBox(
                        width: (constraints.maxWidth - 8) / 2,
                        child: InkWell(
                          onTap: () => showDialog<void>(
                            context: context,
                            builder: (context) => Dialog(
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    ServiceImageGallery(
                                      images: [
                                        url,
                                        ...review.images.where(
                                          (image) => image != url,
                                        ),
                                      ],
                                      name: 'Ảnh đánh giá',
                                    ),
                                    TextButton(
                                      onPressed: () => Navigator.pop(context),
                                      child: const Text('Đóng'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          child: ServiceCoverImage(
                            url: url,
                            name: 'Ảnh đánh giá của ${review.customerName}',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
