import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../../../shared/widgets/app_states.dart';
import '../data/notification_repository.dart';
import '../domain/notification_models.dart';
import '../../home/presentation/customer_home_provider.dart';

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
    return Scaffold(appBar: AppBar(title: const Text('Thông báo'), actions: [TextButton(onPressed: () async { await ref.read(notificationRepositoryProvider).markAllRead(); ref.invalidate(notificationListProvider); ref.invalidate(customerHomeProvider); }, child: const Text('Đánh dấu đã đọc'))]), body: state.when(
      loading: () => const AppLoading(), error: (_, __) => AppMessage(message: 'Không thể tải thông báo.', onRetry: () => ref.invalidate(notificationListProvider)),
      data: (page) {
        final items = _selectedType == 'ALL' ? page.items : page.items.where((item) => item.type == _selectedType).toList();
        if (page.items.isEmpty) return const AppMessage(message: 'Bạn chưa có thông báo nào.');
        return RefreshIndicator(onRefresh: () => ref.refresh(notificationListProvider.future), child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          itemCount: items.isEmpty ? 2 : items.length + 1,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (_, index) {
            if (index == 0) return _NotificationFilters(selected: _selectedType, onSelected: (type) => setState(() => _selectedType = type));
            if (items.isEmpty) return const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('Chưa có thông báo thuộc nhóm này.')));
            return _NotificationTile(item: items[index - 1]);
          },
        ));
      },
    ));
  }
}

class _NotificationFilters extends StatelessWidget {
  const _NotificationFilters({required this.selected, required this.onSelected});
  final String selected;
  final ValueChanged<String> onSelected;
  @override
  Widget build(BuildContext context) => SizedBox(height: 42, child: ListView(scrollDirection: Axis.horizontal, children: [
    _NotificationChip(label: 'Tất cả', value: 'ALL', selected: selected, onSelected: onSelected),
    _NotificationChip(label: 'Đơn hàng', value: 'ORDER', selected: selected, onSelected: onSelected),
    _NotificationChip(label: 'Thanh toán', value: 'PAYMENT', selected: selected, onSelected: onSelected),
    _NotificationChip(label: 'Báo giá', value: 'QUOTATION', selected: selected, onSelected: onSelected),
  ]));
}

class _NotificationChip extends StatelessWidget {
  const _NotificationChip({required this.label, required this.value, required this.selected, required this.onSelected});
  final String label, value, selected;
  final ValueChanged<String> onSelected;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(label), selected: selected == value, onSelected: (_) => onSelected(value)));
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
          padding: const EdgeInsets.all(14),
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
                    child: Icon(_icon(item.type), color: iconColor),
                  ),
                  const SizedBox(width: 12),
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
                                style: theme.textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            if (!item.isRead) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
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
                        const SizedBox(height: 4),
                        Text(item.content, style: theme.textTheme.bodySmall),
                        if (!item.isRead)
                          Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton.icon(
                              onPressed: () async {
                                await ref
                                    .read(notificationRepositoryProvider)
                                    .markRead(item.id);
                                ref.invalidate(notificationListProvider);
                                ref.invalidate(customerHomeProvider);
                              },
                              style: TextButton.styleFrom(
                                foregroundColor: theme.colorScheme.primary,
                                padding: const EdgeInsets.only(top: 6),
                                minimumSize: const Size(0, 32),
                              ),
                              icon: const Icon(Icons.done, size: 16),
                              label: const Text('Đánh dấu đã đọc'),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (!item.isRead)
                    Padding(
                      padding: const EdgeInsets.only(left: 8, top: 5),
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: theme.colorScheme.primary,
                          shape: BoxShape.circle,
                        ),
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
