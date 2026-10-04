import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../../../shared/widgets/app_states.dart';
import '../data/notification_repository.dart';
import '../domain/notification_models.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) => NotificationRepository(ref.watch(apiClientProvider)));
final notificationListProvider = FutureProvider.autoDispose((ref) => ref.watch(notificationRepositoryProvider).list());

class NotificationCenterScreen extends ConsumerStatefulWidget {
  const NotificationCenterScreen({super.key});
  @override
  ConsumerState<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends ConsumerState<NotificationCenterScreen> {
  String _selectedType = 'ALL';

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(notificationListProvider);
    return Scaffold(appBar: AppBar(title: const Text('Thông báo')), body: state.when(
      loading: () => const AppLoading(), error: (_, __) => AppMessage(message: 'Không thể tải thông báo.', onRetry: () => ref.invalidate(notificationListProvider)),
      data: (page) {
        final items = _selectedType == 'ALL' ? page.items : page.items.where((item) => item.type == _selectedType).toList();
        final counts = <String, int>{
          'ALL': page.items.length,
          'ORDER': page.items.where((item) => item.type == 'ORDER').length,
          'PAYMENT': page.items.where((item) => item.type == 'PAYMENT').length,
          'QUOTATION': page.items.where((item) => item.type == 'QUOTATION').length,
          'PROMOTION': page.items.where((item) => item.type == 'PROMOTION').length,
        };
        if (page.items.isEmpty) return const AppMessage(message: 'Bạn chưa có thông báo nào.');
        return RefreshIndicator(onRefresh: () => ref.refresh(notificationListProvider.future), child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          itemCount: items.isEmpty ? 2 : items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, index) {
            if (index == 0) {
              return _NotificationFilters(
                selected: _selectedType,
                counts: counts,
                onSelected: (type) => setState(() => _selectedType = type),
              );
            }
            if (items.isEmpty) return const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('Chưa có thông báo thuộc nhóm này.')));
            return _NotificationTile(item: items[index - 1]);
          },
        ));
      },
    ));
  }
}

class _NotificationFilters extends StatelessWidget {
  const _NotificationFilters({required this.selected, required this.counts, required this.onSelected});
  final String selected;
  final Map<String, int> counts;
  final ValueChanged<String> onSelected;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 42,
    child: ListView(
      scrollDirection: Axis.horizontal,
      children: [
        _NotificationChip(label: 'Tất cả', value: 'ALL', count: counts['ALL'] ?? 0, selected: selected, onSelected: onSelected),
        _NotificationChip(label: 'Đơn hàng', value: 'ORDER', count: counts['ORDER'] ?? 0, selected: selected, onSelected: onSelected),
        _NotificationChip(label: 'Thanh toán', value: 'PAYMENT', count: counts['PAYMENT'] ?? 0, selected: selected, onSelected: onSelected),
        _NotificationChip(label: 'Báo giá', value: 'QUOTATION', count: counts['QUOTATION'] ?? 0, selected: selected, onSelected: onSelected),
        _NotificationChip(label: 'Ưu đãi', value: 'PROMOTION', count: counts['PROMOTION'] ?? 0, selected: selected, onSelected: onSelected),
      ],
    ),
  );
}

class _NotificationChip extends StatelessWidget {
  const _NotificationChip({required this.label, required this.value, required this.count, required this.selected, required this.onSelected});
  final String label, value, selected;
  final int count;
  final ValueChanged<String> onSelected;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isSelected = selected == value;
    final scheme = theme.colorScheme;
    final backgroundColor = isSelected ? scheme.primary : scheme.surfaceContainerLow;
    final foregroundColor = isSelected ? scheme.onPrimary : scheme.onSurfaceVariant;
    final badgeColor = isSelected ? scheme.onPrimary : scheme.primary.withValues(alpha: .12);
    final badgeTextColor = isSelected ? scheme.primary : scheme.primary;

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: () => onSelected(value),
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: foregroundColor,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
                if (count > 0) ...[
                  const SizedBox(width: 6),
                  Container(
                    constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: badgeColor,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '$count',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: badgeTextColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.item}); final AppNotification item;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final iconColor = _notificationColor(theme, item.type);
    return Card(
      color: item.isRead ? theme.colorScheme.surfaceContainerLowest : theme.colorScheme.surfaceContainerLow,
      child: InkWell(
        onTap: item.isRead ? null : () async { await ref.read(notificationRepositoryProvider).markRead(item.id); ref.invalidate(notificationListProvider); },
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: iconColor.withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: Icon(_icon(item.type), color: iconColor),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                item.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            if (!item.isRead) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 7,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: theme.colorScheme.primaryContainer,
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  'Chưa đọc',
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: theme.colorScheme.onPrimaryContainer,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          item.content,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (item.createdAt != null) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    _notificationTime(item.createdAt!),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
IconData _icon(String type) => switch (type) { 'ORDER' => Icons.receipt_long_outlined, 'PAYMENT' => Icons.payments_outlined, 'QUOTATION' => Icons.request_quote_outlined, _ => Icons.notifications_outlined };
Color _notificationColor(ThemeData theme, String type) => switch (type) { 'ORDER' => theme.colorScheme.primary, 'PAYMENT' => theme.colorScheme.secondary, 'QUOTATION' => theme.colorScheme.tertiary, _ => theme.colorScheme.primary };
String _notificationTime(DateTime value) => '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
