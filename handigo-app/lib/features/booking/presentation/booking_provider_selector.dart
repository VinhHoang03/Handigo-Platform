import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/provider_avatar.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../../booking/domain/booking_models.dart';
import 'booking_provider.dart';

final bookingNearbyProviders = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>(
      (ref, query) => ref
          .watch(serviceCatalogRepositoryProvider)
          .nearbyProviders(Map<String, dynamic>.from(jsonDecode(query) as Map)),
    );

String? bookingProviderQuery(BookingDraft draft) {
  if (draft.serviceId == null ||
      draft.addressId == null ||
      ([BookingType.scheduled, BookingType.recurring].contains(draft.type) &&
          draft.scheduledAt == null)) {
    return null;
  }
  return jsonEncode({
    'serviceId': draft.serviceId,
    'addressId': draft.addressId,
    if ([BookingType.scheduled, BookingType.recurring].contains(draft.type))
      'scheduledAt': draft.scheduledAt!.toUtc().toIso8601String(),
    if (draft.type == BookingType.recurring)
      'recurrenceUnit': draft.recurrenceUnit,
    if (draft.type == BookingType.recurring)
      'recurrenceCount': draft.recurrenceCount,
    if (draft.selectedOptionIds.isNotEmpty)
      'selectedOptions': jsonEncode(
        draft.selectedOptionIds
            .map(
              (id) => {'optionId': id, 'quantity': draft.quantities[id] ?? 1},
            )
            .toList(),
      ),
  });
}

class BookingProviderSelector extends ConsumerStatefulWidget {
  const BookingProviderSelector({super.key});
  @override
  ConsumerState<BookingProviderSelector> createState() =>
      _BookingProviderSelectorState();
}

class _BookingProviderSelectorState
    extends ConsumerState<BookingProviderSelector> {
  void _chooseProvider(String id) {
    ref.read(bookingDraftProvider.notifier).setPreferredProvider(id);
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingDraftProvider);
    final query = bookingProviderQuery(draft);
    final result = query == null
        ? null
        : ref.watch(bookingNearbyProviders(query));
    final providers = result?.asData?.value
        .where((item) => bookingProviderId(item).isNotEmpty)
        .toList();
    final manual = draft.preferredProviderId != null;
    final loading = result?.isLoading ?? false;
    final hasProviders =
        !loading &&
        result?.hasError != true &&
        providers != null &&
        providers.isNotEmpty;
    final theme = Theme.of(context);
    final note = query == null
        ? 'Vui lòng chọn địa chỉ và thời gian thực hiện để xem danh sách thợ phù hợp.'
        : loading
        ? 'Đang tìm thợ phù hợp...'
        : result!.hasError
        ? 'Chưa tải được danh sách thợ. Vui lòng thử lại.'
        : !hasProviders
        ? 'Hiện tại chưa có thợ phù hợp, vui lòng đặt lịch lại sau'
        : 'Xem các thợ phù hợp với đơn của bạn';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, color: theme.colorScheme.outlineVariant),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          child: Row(
            children: [
              Icon(
                Icons.person_outline_rounded,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Lựa chọn thợ phù hợp',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        _choice(
          context,
          title: 'Hệ thống Handigo sẽ điều phối tự động',
          subtitle: 'Hệ thống sẽ lần lượt gửi yêu cầu đến các thợ phù hợp.',
          selected: !manual,
          onTap: () {
            ref.read(bookingDraftProvider.notifier).setPreferredProvider(null);
          },
        ),
        const SizedBox(height: 8),
        _choice(
          context,
          title: 'Chọn thợ từ danh sách',
          subtitle: note,
          selected: manual,
          manual: true,
          showArrow: hasProviders,
          expanded: true,
          loading: loading,
          retry: query != null && !loading && !hasProviders
              ? () => ref.invalidate(bookingNearbyProviders(query))
              : null,
          retryLabel: result?.hasError == true ? 'Thử lại' : 'Tải lại',
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          alignment: Alignment.topCenter,
          child: hasProviders
              ? _ProviderDropdown(
                  key: ValueKey(query),
                  onSelected: _chooseProvider,
                )
              : const SizedBox(width: double.infinity),
        ),
        const SizedBox(height: 12),
        Divider(height: 1, color: theme.colorScheme.outlineVariant),
      ],
    );
  }

  Widget _choice(
    BuildContext context, {
    required String title,
    String? subtitle,
    required bool selected,
    VoidCallback? onTap,
    bool manual = false,
    bool loading = false,
    VoidCallback? retry,
    String retryLabel = 'Thử lại',
    bool showArrow = false,
    bool expanded = false,
  }) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: selected
              ? theme.colorScheme.primary
              : theme.colorScheme.outlineVariant,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        selected: selected,
        leading: Icon(
          manual ? Icons.person_search_outlined : Icons.auto_awesome_outlined,
          color: selected
              ? theme.colorScheme.primary
              : theme.colorScheme.onSurfaceVariant,
        ),
        title: Text(
          title,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
        subtitle: subtitle == null
            ? null
            : Text(subtitle, style: theme.textTheme.bodySmall),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (selected)
              Icon(
                Icons.check_circle_outline_rounded,
                color: theme.colorScheme.primary,
              ),
            if (loading)
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: theme.colorScheme.primary,
                ),
              ),
            if (retry != null)
              IconButton.outlined(
                onPressed: retry,
                tooltip: retryLabel,
                style: IconButton.styleFrom(
                  shape: const CircleBorder(),
                  foregroundColor: theme.colorScheme.primary,
                  side: BorderSide(color: theme.colorScheme.primary),
                ),
                icon: const Icon(Icons.refresh_rounded),
              ),
            if (showArrow)
              Icon(
                expanded
                    ? Icons.keyboard_arrow_up_rounded
                    : Icons.keyboard_arrow_down_rounded,
              ),
          ],
        ),
        onTap: onTap,
      ),
    );
  }
}

String bookingProviderId(Map<String, dynamic> item) =>
    '${item['id'] ?? item['providerId'] ?? item['_id'] ?? ''}';
String bookingProviderName(Map<String, dynamic> item) =>
    '${(item['user'] is Map ? (item['user'] as Map)['fullName'] : null) ?? item['fullName'] ?? item['name'] ?? 'Thợ Handigo'}';

class _ProviderDropdown extends ConsumerStatefulWidget {
  const _ProviderDropdown({super.key, required this.onSelected});
  final ValueChanged<String> onSelected;
  @override
  ConsumerState<_ProviderDropdown> createState() => _ProviderDropdownState();
}

class _ProviderDropdownState extends ConsumerState<_ProviderDropdown> {
  final _scrollController = ScrollController();
  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Widget _message(String text) => Padding(
    padding: const EdgeInsets.all(20),
    child: Text(text, textAlign: TextAlign.center),
  );
  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingDraftProvider);
    final query = bookingProviderQuery(draft);
    if (query == null) {
      return _message(
        'Vui lòng chọn địa chỉ và thời gian thực hiện để xem danh sách thợ phù hợp.',
      );
    }
    return ref
        .watch(bookingNearbyProviders(query))
        .when(
          loading: () => const Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 12),
                Text('Đang tìm thợ phù hợp...'),
              ],
            ),
          ),
          error: (_, _) => Column(
            children: [
              _message('Chưa tải được danh sách thợ. Vui lòng thử lại.'),
              OutlinedButton.icon(
                onPressed: () => ref.invalidate(bookingNearbyProviders(query)),
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
          data: (items) {
            final providers = items
                .where((item) => bookingProviderId(item).isNotEmpty)
                .toList();
            if (providers.isEmpty) {
              return _message(
                'Chưa có thợ phù hợp với dịch vụ, địa chỉ và lịch đã chọn.',
              );
            }
            final rowHeight = 80.0 * MediaQuery.textScalerOf(context).scale(1);
            final scrollable = providers.length > 4;
            return Padding(
              padding: const EdgeInsets.only(top: 8),
              child: SizedBox(
                height: rowHeight * (scrollable ? 4 : providers.length),
                child: Scrollbar(
                  controller: _scrollController,
                  thumbVisibility: scrollable,
                  child: ListView.builder(
                    key: const ValueKey('booking-provider-dropdown-list'),
                    controller: _scrollController,
                    primary: false,
                    padding: EdgeInsets.zero,
                    itemExtent: rowHeight,
                    physics: scrollable
                        ? const ClampingScrollPhysics()
                        : const NeverScrollableScrollPhysics(),
                    itemCount: providers.length,
                    itemBuilder: (context, index) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _ProviderChoiceCard(
                        provider: providers[index],
                        selected:
                            bookingProviderId(providers[index]) ==
                            draft.preferredProviderId,
                        onTap: () => widget.onSelected(
                          bookingProviderId(providers[index]),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
  }
}

class _ProviderChoiceCard extends StatelessWidget {
  const _ProviderChoiceCard({
    required this.provider,
    required this.selected,
    required this.onTap,
  });
  final VoidCallback onTap;
  final Map<String, dynamic> provider;
  final bool selected;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = bookingProviderName(provider);
    final user = provider['user'] is Map
        ? Map<String, dynamic>.from(provider['user'] as Map)
        : const <String, dynamic>{};
    final rating = num.tryParse('${provider['averageRating']}');
    final completed = num.tryParse('${provider['totalCompletedOrders']}') ?? 0;
    final distance = num.tryParse('${provider['distanceMeters']}');
    final distanceLabel = distance == null || distance < 0
        ? null
        : distance < 1000
        ? '${distance.round()} m'
        : '${(distance / 1000).toStringAsFixed(1)} km';
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: selected
              ? theme.colorScheme.primary
              : theme.colorScheme.outlineVariant,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ProviderAvatar(
                url: user['avatar'] as String?,
                gender: (user['gender'] ?? provider['gender']) as String?,
                size: 32,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          [
                            if (rating != null)
                              '★ ${rating.toStringAsFixed(1)}',
                            '${completed.toInt()} đơn',
                          ].join(' · '),
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    if (distanceLabel != null)
                      Text(
                        'Cách bạn $distanceLabel',
                        style: theme.textTheme.bodySmall,
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                selected
                    ? Icons.check_circle_outline_rounded
                    : Icons.circle_outlined,
                color: theme.colorScheme.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

bool isImmediateBookingAvailable(DateTime now) =>
    now.hour >= 8 && (now.hour < 21 || (now.hour == 21 && now.minute == 0));

String? bookingTimeError(BookingDraft draft, DateTime now) {
  if (draft.type == BookingType.normal) {
    return !isImmediateBookingAvailable(now)
        ? 'Đặt ngay chỉ khả dụng từ 08:00 đến 21:00.'
        : null;
  }
  final date = draft.scheduledAt;
  if (date == null) return 'Vui lòng chọn thời gian thực hiện.';
  if (date.isBefore(
        DateTime(now.year, now.month, now.day, now.hour, now.minute),
      ) ||
      date.hour < 8 ||
      date.hour > 21 ||
      (date.hour == 21 && date.minute > 0)) {
    return 'Chọn thời gian từ phút hiện tại, trong khoảng 08:00–21:00.';
  }
  return null;
}
