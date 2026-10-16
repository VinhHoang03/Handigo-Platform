import 'dart:convert';
import 'dart:developer' as developer;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/service_images.dart';
import '../../orders/domain/order_summary.dart';
import '../../orders/presentation/order_screens.dart';
import '../data/provider_repository.dart';
import '../domain/provider_models.dart';
import 'provider_schedule_preview.dart';
import 'provider_history_widgets.dart';

bool _schedulePreviewRegistered = false;
ValueChanged<bool>? _setActiveSchedulePreview;

@visibleForTesting
void setSchedulePreviewForDebug(bool enabled) {
  if (kDebugMode) _setActiveSchedulePreview?.call(enabled);
}

final providerRepositoryProvider = Provider<ProviderRepository>(
  (ref) => ProviderRepository(ref.watch(apiClientProvider)),
);
final providerOverviewProvider = FutureProvider.autoDispose<ProviderOverview>((
  ref,
) {
  if (ref.watch(providerUiPreviewProvider) != null) {
    return const ProviderOverview(
      walletBalance: 2450000,
      pendingBalance: 350000,
      monthlyEarnings: 12500000,
      completedOrders: 128,
      averageRating: 4.9,
      availabilityStatus: 'online',
      pendingWithdrawals: 1,
    );
  }
  return ref.watch(providerRepositoryProvider).overview();
});
final providerOrdersProvider =
    FutureProvider.autoDispose<PagedResult<OrderSummary>>((ref) {
      final preview = ref.watch(providerUiPreviewProvider);
      if (preview != null) {
        return PagedResult(items: preview, page: 1, totalPages: 1);
      }
      return ref.watch(providerRepositoryProvider).orders();
    });
final providerAssignmentsProvider =
    FutureProvider.autoDispose<List<ProviderAssignment>>((ref) {
      if (ref.watch(providerUiPreviewProvider) != null) {
        return [
          ProviderAssignment(
            id: 'preview-assignment',
            orderId: 'preview-pending',
            orderCode: 'XEM-THU-006',
            serviceName: 'Sửa điều hòa rò nước',
            addressLabel: 'Căn hộ Florita, Quận 7',
            orderType: 'immediate',
            totalAmount: 240000,
            responseDeadline: DateTime.now().add(const Duration(hours: 1)),
          ),
        ];
      }
      return ref.watch(providerRepositoryProvider).pendingAssignments();
    });

class ProviderShell extends StatefulWidget {
  const ProviderShell({super.key});
  @override
  State<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends State<ProviderShell> {
  int index = 0;
  void _showSchedule() => setState(() => index = 2);
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: IndexedStack(
        index: index,
        children: [
          ProviderDashboardScreen(
            onOrders: () => setState(() => index = 1),
            onSchedule: _showSchedule,
          ),
          const ProviderOrdersScreen(),
          ProviderScheduleScreen(isActive: index == 2),
          const ProviderAccountScreen(),
        ],
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          color: scheme.surfaceContainerLowest,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              for (final (tabIndex, label, icon) in const [
                (0, 'Tổng quan', Icons.home_rounded),
                (1, 'Đơn hàng', Icons.assignment_outlined),
                (2, 'Lịch hẹn', Icons.calendar_month_outlined),
                (3, 'Tài khoản', Icons.person_outline),
              ])
                Expanded(
                  child: Semantics(
                    selected: index == tabIndex,
                    button: true,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Material(
                        color: index == tabIndex
                            ? scheme.primaryContainer
                            : scheme.surfaceContainerLowest,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => setState(() => index = tabIndex),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  icon,
                                  size: 22,
                                  color: index == tabIndex
                                      ? scheme.onPrimary
                                      : scheme.onSurfaceVariant,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  label,
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context).textTheme.labelSmall
                                      ?.copyWith(
                                        color: index == tabIndex
                                            ? scheme.onPrimary
                                            : scheme.onSurfaceVariant,
                                        fontWeight: index == tabIndex
                                            ? FontWeight.w700
                                            : FontWeight.w500,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class ProviderDashboardScreen extends ConsumerWidget {
  const ProviderDashboardScreen({this.onOrders, this.onSchedule, super.key});
  final VoidCallback? onOrders, onSchedule;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerOverviewProvider);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/brand/handigo-logo.png',
              width: 32,
              height: 32,
              semanticLabel: 'Logo Handigo',
            ),
            const SizedBox(width: 8),
            Text(
              'Handigo',
              style: TextStyle(
                color: scheme.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Thông báo',
            onPressed: () => context.push('/provider/notifications'),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () {
          ref.invalidate(providerAssignmentsProvider);
          ref.invalidate(providerOrdersProvider);
          return ref.refresh(providerOverviewProvider.future);
        },
        child: state.when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: _message(error),
            onRetry: () => ref.invalidate(providerOverviewProvider),
          ),
          data: (data) => ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              _ProviderHero(data: data),
              const SizedBox(height: 16),
              _SectionHeading(
                title: 'Đơn cần phản hồi',
                icon: Icons.assignment_outlined,
                action: onOrders == null
                    ? null
                    : TextButton(
                        onPressed: onOrders,
                        child: const Text('Xem tất cả'),
                      ),
              ),
              const _PendingAssignmentList(),
              const SizedBox(height: 16),
              _WalletSummary(data: data),
              const SizedBox(height: 16),
              const _SectionHeading(
                title: 'Hiệu suất công việc',
                icon: Icons.insights_rounded,
              ),
              LayoutBuilder(
                builder: (context, constraints) {
                  final columns =
                      constraints.maxWidth < 340 ||
                          MediaQuery.textScalerOf(context).scale(1) > 1.3
                      ? 1
                      : 2;
                  final width =
                      (constraints.maxWidth - (columns - 1) * 12) / columns;
                  return Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      SizedBox(
                        width: width,
                        child: _MetricCard(
                          label: 'Thu nhập tháng',
                          value: _money(data.monthlyEarnings),
                          icon: Icons.payments_outlined,
                        ),
                      ),
                      SizedBox(
                        width: width,
                        child: _MetricCard(
                          label: 'Đơn hoàn tất',
                          value: '${data.completedOrders}',
                          icon: Icons.task_alt,
                        ),
                      ),
                      SizedBox(
                        width: width,
                        child: _MetricCard(
                          label: 'Đánh giá trung bình',
                          value: data.averageRating.toStringAsFixed(1),
                          icon: Icons.star_outline,
                        ),
                      ),
                      SizedBox(
                        width: width,
                        child: _MetricCard(
                          label: 'Yêu cầu rút chờ',
                          value: '${data.pendingWithdrawals}',
                          icon: Icons.account_balance_outlined,
                        ),
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 16),
              _SectionHeading(
                title: 'Đơn hàng hiện tại',
                icon: Icons.assignment_outlined,
                action: onOrders == null
                    ? null
                    : TextButton(
                        onPressed: onOrders,
                        child: const Text('Xem tất cả'),
                      ),
              ),
              ref
                  .watch(providerOrdersProvider)
                  .when(
                    loading: () => const LinearProgressIndicator(),
                    error: (error, _) => AppMessage(
                      message: _message(error),
                      onRetry: () => ref.invalidate(providerOrdersProvider),
                    ),
                    data: (page) {
                      final active =
                          page.items
                              .where(
                                (order) =>
                                    order.status == 'accepted' ||
                                    order.status == 'in_progress',
                              )
                              .toList()
                            ..sort((a, b) {
                              if (a.status != b.status) {
                                return a.status == 'in_progress' ? -1 : 1;
                              }
                              return (a.scheduledAt ?? DateTime(9999))
                                  .compareTo(b.scheduledAt ?? DateTime(9999));
                            });
                      if (active.isEmpty) {
                        return const AppMessage(
                          message: 'Chưa có đơn đang xử lý.',
                          icon: Icons.assignment_turned_in_outlined,
                        );
                      }
                      return Column(
                        children: [
                          for (final order in active.take(3))
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _AppointmentCard(
                                order: order,
                                showDate: true,
                                isPreview:
                                    ref.watch(providerUiPreviewProvider) !=
                                    null,
                              ),
                            ),
                        ],
                      );
                    },
                  ),
              const SizedBox(height: 16),
              _SectionHeading(
                title: 'Lịch hẹn hôm nay',
                icon: Icons.event_note_outlined,
                action: onSchedule == null
                    ? null
                    : TextButton(
                        onPressed: onSchedule,
                        child: const Text('Xem lịch'),
                      ),
              ),
              ref
                  .watch(providerOrdersProvider)
                  .when(
                    loading: () => const LinearProgressIndicator(),
                    error: (error, _) => AppMessage(
                      message: _message(error),
                      onRetry: () => ref.invalidate(providerOrdersProvider),
                    ),
                    data: (page) {
                      final today = _ordersOnDay(page.items, DateTime.now());
                      return today.isEmpty
                          ? const AppMessage(
                              message: 'Hôm nay chưa có lịch hẹn.',
                              icon: Icons.event_available_outlined,
                            )
                          : Column(
                              children: [
                                for (final order in today.take(3))
                                  Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: _AppointmentCard(
                                      order: order,
                                      isPreview:
                                          ref.watch(
                                            providerUiPreviewProvider,
                                          ) !=
                                          null,
                                    ),
                                  ),
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

class _AvailabilityCard extends ConsumerStatefulWidget {
  const _AvailabilityCard({required this.data});
  final ProviderOverview data;
  @override
  ConsumerState<_AvailabilityCard> createState() => _AvailabilityCardState();
}

class _AvailabilityCardState extends ConsumerState<_AvailabilityCard> {
  bool busy = false;
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: Theme.of(context).colorScheme.surfaceContainerLow,
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      leading: Icon(
        Icons.circle,
        size: 12,
        color: widget.data.availabilityStatus == 'online'
            ? AppTheme.successGreen
            : Theme.of(context).colorScheme.outline,
      ),
      title: const Text(
        'Trạng thái nhận việc',
        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        _availabilityLabel(widget.data.availabilityStatus),
        style: const TextStyle(fontSize: 12),
      ),
      trailing: Switch(
        value: widget.data.availabilityStatus == 'online',
        onChanged: busy
            ? null
            : (value) async {
                if (ref.read(providerUiPreviewProvider) != null) return;
                setState(() => busy = true);
                try {
                  await ref
                      .read(providerRepositoryProvider)
                      .setAvailability(value ? 'online' : 'offline');
                  ref.invalidate(providerOverviewProvider);
                } catch (error) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text(_message(error))));
                  }
                } finally {
                  if (mounted) setState(() => busy = false);
                }
              },
      ),
    ),
  );
}

class _ProviderHero extends ConsumerWidget {
  const _ProviderHero({required this.data});
  final ProviderOverview data;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                ProviderAvatar(url: user?.avatar),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Xin chào, ${user?.fullName ?? 'Đối tác'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            size: 16,
                            color: AppTheme.starGold,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            data.averageRating > 0
                                ? data.averageRating.toStringAsFixed(1)
                                : 'Chưa có đánh giá',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _AvailabilityCard(data: data),
        ],
      ),
    );
  }
}

class ProviderAvatar extends StatelessWidget {
  const ProviderAvatar({this.url, super.key});
  final String? url;
  @override
  Widget build(BuildContext context) {
    final image = usableMediaUrl(url);
    final scheme = Theme.of(context).colorScheme;
    final placeholder = ColoredBox(
      color: scheme.primaryFixed,
      child: Icon(Icons.handyman_outlined, color: scheme.primary),
    );
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 48,
        height: 48,
        child: image == null
            ? placeholder
            : Image.network(
                image,
                fit: BoxFit.cover,
                errorBuilder: (_, error, stack) => placeholder,
              ),
      ),
    );
  }
}

class _WalletSummary extends StatelessWidget {
  const _WalletSummary({required this.data});
  final ProviderOverview data;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.account_balance_wallet_outlined,
                  color: scheme.primary,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Ví Handigo',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => context.push('/provider/wallet'),
                  child: const Text('Xem ví'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            LayoutBuilder(
              builder: (context, constraints) {
                final stacked =
                    constraints.maxWidth < 280 ||
                    MediaQuery.textScalerOf(context).scale(1) > 1.3;
                Widget balance(
                  String label,
                  double amount,
                  String caption,
                  Color color,
                ) => Container(
                  constraints: const BoxConstraints(minHeight: 116),
                  width: stacked
                      ? constraints.maxWidth
                      : (constraints.maxWidth - 12) / 2,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 4),
                      Text(
                        _money(amount),
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: color,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        caption,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                );
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    balance(
                      'Số dư khả dụng',
                      data.walletBalance,
                      'Có thể sử dụng trong ví',
                      scheme.primary,
                    ),
                    balance(
                      'Số dư chờ xử lý',
                      data.pendingBalance,
                      'Đang chờ đối soát',
                      scheme.onSurface,
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });
  final String label, value;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                icon,
                size: 20,
                color: Theme.of(context).colorScheme.primary,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    ),
  );
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title, required this.icon, this.action});
  final String title;
  final IconData icon;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      children: [
        Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        ?action,
      ],
    ),
  );
}

class _PendingAssignmentList extends ConsumerWidget {
  const _PendingAssignmentList();
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(providerAssignmentsProvider)
      .when(
        loading: () => const LinearProgressIndicator(),
        error: (error, _) => AppMessage(
          message: _message(error),
          onRetry: () => ref.invalidate(providerAssignmentsProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const AppMessage(
              message: 'Hiện không có đơn chờ phản hồi.',
              icon: Icons.assignment_turned_in_outlined,
            );
          }
          return Column(
            children: [
              for (final item in items.take(3))
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _AssignmentCard(key: ValueKey(item.id), item: item),
                ),
            ],
          );
        },
      );
}

class _AssignmentCard extends ConsumerStatefulWidget {
  const _AssignmentCard({required this.item, super.key});
  final ProviderAssignment item;
  @override
  ConsumerState<_AssignmentCard> createState() => _AssignmentCardState();
}

class _AssignmentCardState extends ConsumerState<_AssignmentCard> {
  bool busy = false;
  Future<void> _respond(bool accept) async {
    if (ref.read(providerUiPreviewProvider) != null) return;
    if (busy) return;
    setState(() => busy = true);
    try {
      final repository = ref.read(providerRepositoryProvider);
      if (accept) {
        await repository.acceptAssignment(widget.item.id);
      } else {
        await repository.rejectAssignment(
          widget.item.id,
          'Đối tác chưa thể nhận đơn.',
        );
      }
      ref.invalidate(providerAssignmentsProvider);
      ref.invalidate(providerOrdersProvider);
      ref.invalidate(providerOverviewProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              accept
                  ? 'Đã nhận đơn. Xem công việc trong mục Đơn hàng.'
                  : 'Đã từ chối đơn.',
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(error))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: scheme.primaryContainer.withValues(alpha: .4)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 12,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                ProviderStatusBadge(status: 'created', label: 'Chờ phản hồi'),
                if (item.responseDeadline != null)
                  Text(
                    'Phản hồi trước ${DateFormat('HH:mm, dd/MM').format(item.responseDeadline!.toLocal())}',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: scheme.primary,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (usableMediaUrl(item.serviceImage) != null) ...[
                  SizedBox(
                    width: 64,
                    child: ServiceCoverImage(
                      url: item.serviceImage,
                      name: item.serviceName,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.orderCode,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: scheme.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.serviceName,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (item.addressLabel?.isNotEmpty == true)
                    _MetaLine(
                      icon: Icons.location_on_outlined,
                      text: item.addressLabel!,
                    ),
                  const SizedBox(height: 4),
                  _MetaLine(
                    icon: Icons.schedule_outlined,
                    text: item.scheduledAt != null
                        ? _dateLabel(item.scheduledAt)
                        : item.orderType == 'immediate'
                        ? 'Yêu cầu ngay'
                        : 'Chưa có lịch hẹn',
                  ),
                ],
              ),
            ),
            if (item.totalAmount != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Wrap(
                  spacing: 12,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text('Tổng tiền đơn', style: theme.textTheme.bodySmall),
                    Text(
                      _money(item.totalAmount!),
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: scheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, constraints) {
                final reject = OutlinedButton(
                  onPressed: busy ? null : () => _respond(false),
                  child: const Text('Từ chối'),
                );
                final accept = FilledButton.icon(
                  onPressed: busy ? null : () => _respond(true),
                  icon: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.check_circle_outline, size: 20),
                  label: Text(busy ? 'Đang xử lý...' : 'Nhận đơn'),
                );
                if (MediaQuery.textScalerOf(context).scale(1) > 1.3) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [accept, const SizedBox(height: 8), reject],
                  );
                }
                return Row(
                  children: [
                    Expanded(child: reject),
                    const SizedBox(width: 12),
                    Expanded(flex: 2, child: accept),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class ProviderOrdersScreen extends ConsumerStatefulWidget {
  const ProviderOrdersScreen({super.key});
  @override
  ConsumerState<ProviderOrdersScreen> createState() =>
      _ProviderOrdersScreenState();
}

class _ProviderOrdersScreenState extends ConsumerState<ProviderOrdersScreen> {
  String filter = 'all';
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(providerOrdersProvider);
    final assignments = ref.watch(providerAssignmentsProvider);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: scheme.surfaceContainerLowest,
        shape: Border(bottom: BorderSide(color: scheme.surfaceContainer)),
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: scheme.surfaceContainerLowest,
                border: Border.all(color: scheme.primaryContainer),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.receipt_long_outlined,
                color: scheme.primaryContainer,
                size: 22,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Lịch sử đơn hàng',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: scheme.primaryContainer,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Tải lại đơn hàng',
            onPressed: () {
              ref.invalidate(providerOrdersProvider);
              ref.invalidate(providerAssignmentsProvider);
            },
            icon: Icon(Icons.refresh_rounded, color: scheme.primaryContainer),
          ),
        ],
      ),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                for (final entry in const {
                  'all': 'Tất cả',
                  'pending': 'Chờ phản hồi',
                  'accepted': 'Đã nhận',
                  'in_progress': 'Đang thực hiện',
                  'completed': 'Đã hoàn thành',
                  'cancelled': 'Đã hủy',
                }.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ProviderHistoryFilter(
                      label: entry.value,
                      count: entry.key == 'pending'
                          ? assignments.asData?.value.length
                          : state.asData?.value.items
                                .where(
                                  (order) =>
                                      entry.key == 'all' ||
                                      order.status == entry.key,
                                )
                                .length,
                      selected: filter == entry.key,
                      onSelected: () => setState(() => filter = entry.key),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () {
                ref.invalidate(providerAssignmentsProvider);
                return ref.refresh(providerOrdersProvider.future);
              },
              child: filter == 'pending'
                  ? assignments.when(
                      loading: () => const AppLoading(),
                      error: (error, _) => AppMessage(
                        message: _message(error),
                        onRetry: () =>
                            ref.invalidate(providerAssignmentsProvider),
                      ),
                      data: (items) => items.isEmpty
                          ? const AppMessage(
                              message: 'Hiện không có đơn chờ phản hồi.',
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                              itemCount: items.length,
                              separatorBuilder: (_, index) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (_, index) => _AssignmentCard(
                                key: ValueKey(items[index].id),
                                item: items[index],
                              ),
                            ),
                    )
                  : state.when(
                      loading: () => const AppLoading(),
                      error: (error, _) => AppMessage(
                        message: _message(error),
                        onRetry: () => ref.invalidate(providerOrdersProvider),
                      ),
                      data: (page) {
                        final orders = filter == 'all'
                            ? page.items
                            : page.items
                                  .where((order) => order.status == filter)
                                  .toList();
                        return ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                          itemCount: orders.length + (orders.isEmpty ? 1 : 0),
                          separatorBuilder: (_, index) =>
                              const SizedBox(height: 12),
                          itemBuilder: (_, index) => orders.isEmpty
                              ? const AppMessage(
                                  message: 'Chưa có đơn hàng ở trạng thái này.',
                                )
                              : IgnorePointer(
                                  ignoring:
                                      ref.watch(providerUiPreviewProvider) !=
                                      null,
                                  child: ProviderHistoryOrderCard(
                                    order: orders[index],
                                  ),
                                ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProviderScheduleScreen extends ConsumerStatefulWidget {
  const ProviderScheduleScreen({this.isActive = true, super.key});
  final bool isActive;
  @override
  ConsumerState<ProviderScheduleScreen> createState() =>
      _ProviderScheduleScreenState();
}

class _ProviderScheduleScreenState
    extends ConsumerState<ProviderScheduleScreen> {
  DateTime selected = DateUtils.dateOnly(DateTime.now());
  DateTime weekStart = DateUtils.dateOnly(DateTime.now());
  final dayScrollController = ScrollController();
  final Set<String> viewedOrderIds = {};
  List<OrderSummary>? previewOrders;

  void _setPreview(bool enabled) {
    if (!kDebugMode || !mounted) return;
    ref.read(providerUiPreviewProvider.notifier).setEnabled(enabled);
    setState(() {
      previewOrders = ref.read(providerUiPreviewProvider);
      selected = DateUtils.dateOnly(DateTime.now());
      weekStart = selected;
      viewedOrderIds.clear();
    });
    if (enabled) {
      context.findAncestorStateOfType<_ProviderShellState>()?._showSchedule();
    }
  }

  @override
  void initState() {
    super.initState();
    if (kDebugMode) {
      _setActiveSchedulePreview = _setPreview;
      if (!_schedulePreviewRegistered) {
        developer.registerExtension('ext.handigo.schedulePreview', (
          _,
          parameters,
        ) async {
          final enabled = parameters['enabled'] == 'true';
          if (_setActiveSchedulePreview == null) {
            return developer.ServiceExtensionResponse.error(
              developer.ServiceExtensionResponse.extensionError,
              'Trang lịch hẹn chưa được mở.',
            );
          }
          _setActiveSchedulePreview!(enabled);
          return developer.ServiceExtensionResponse.result(
            jsonEncode({'enabled': enabled}),
          );
        });
        _schedulePreviewRegistered = true;
      }
    }
  }

  void _resetToToday() {
    setState(() {
      selected = DateUtils.dateOnly(DateTime.now());
      weekStart = selected;
    });
    _scrollToStart();
  }

  void _scrollToStart() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && dayScrollController.hasClients) {
        dayScrollController.jumpTo(0);
      }
    });
  }

  void _changeWeek(int days) {
    setState(() {
      weekStart = DateTime(
        weekStart.year,
        weekStart.month,
        weekStart.day + days,
      );
      selected = weekStart;
    });
    _scrollToStart();
  }

  @override
  void didUpdateWidget(covariant ProviderScheduleScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) _resetToToday();
  }

  @override
  void dispose() {
    dayScrollController.dispose();
    if (_setActiveSchedulePreview == _setPreview) {
      _setActiveSchedulePreview = null;
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    previewOrders = ref.watch(providerUiPreviewProvider);
    final state = previewOrders == null
        ? ref.watch(providerOrdersProvider)
        : AsyncData(PagedResult(items: previewOrders!, page: 1, totalPages: 1));
    final orders = state.asData?.value.items ?? <OrderSummary>[];
    // Chỉ ghi nhận các đơn đã tải và hiển thị trong ngày đang mở.
    viewedOrderIds.addAll(
      _ordersOnDay(orders, selected).map((order) => order.id),
    );
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72 * MediaQuery.textScalerOf(context).scale(1),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryFixed,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.calendar_month_rounded,
                color: Theme.of(context).colorScheme.primary,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Lịch làm việc',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat(
                      "'Hôm nay, ngày' d 'tháng' M 'năm' yyyy",
                    ).format(DateTime.now()),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          if (previewOrders != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Dữ liệu xem thử • Tự xóa khi mở lại app hoặc hot restart',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.secondary,
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Tuần trước',
                  onPressed: () => _changeWeek(-7),
                  icon: const Icon(Icons.chevron_left),
                ),
                Expanded(
                  child: Text(
                    DateFormat('MM/yyyy').format(selected),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  tooltip: 'Tuần sau',
                  onPressed: () => _changeWeek(7),
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: _WeekStrip(
              selected: selected,
              start: weekStart,
              controller: dayScrollController,
              orders: orders,
              viewedOrderIds: viewedOrderIds,
              onSelected: (value) => setState(() => selected = value),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                if (previewOrders != null) return;
                ref.invalidate(providerOrdersProvider);
                await ref.read(providerOrdersProvider.future);
              },
              child: state.when(
                loading: () => const AppLoading(),
                error: (error, _) => AppMessage(
                  message: _message(error),
                  onRetry: () => ref.invalidate(providerOrdersProvider),
                ),
                data: (page) {
                  final scheduled = _ordersOnDay(page.items, selected);
                  return ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount:
                        scheduled.length + 1 + (scheduled.isEmpty ? 1 : 0),
                    separatorBuilder: (_, index) => const SizedBox(height: 12),
                    itemBuilder: (_, index) {
                      if (index == 0) {
                        return Card(
                          margin: EdgeInsets.zero,
                          color: Theme.of(
                            context,
                          ).colorScheme.surfaceContainerLow,
                          child: ListTile(
                            leading: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Theme.of(
                                  context,
                                ).colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onPrimary,
                                ),
                              ),
                              child: Icon(
                                Icons.event_note_outlined,
                                color: Theme.of(context).colorScheme.onPrimary,
                              ),
                            ),
                            title: Text(
                              '${scheduled.length} lịch hẹn',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            subtitle: scheduled.isEmpty
                                ? null
                                : Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      if (scheduled.any(
                                        (order) => order.totalAmount != null,
                                      ))
                                        Text(
                                          'Dự kiến: ${_money(scheduled.fold<double>(0, (total, order) => total + (order.totalAmount ?? 0)))}',
                                          style: TextStyle(
                                            color: Theme.of(
                                              context,
                                            ).colorScheme.primary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      if (scheduled.any(
                                        (order) => order.totalAmount == null,
                                      ))
                                        const Text(
                                          'Một số đơn chưa có giá dự kiến.',
                                        ),
                                    ],
                                  ),
                          ),
                        );
                      }
                      if (scheduled.isEmpty) {
                        return const AppMessage(
                          message: 'Không có lịch hẹn trong ngày này.',
                          icon: Icons.event_available_outlined,
                        );
                      }
                      return _AppointmentCard(
                        order: scheduled[index - 1],
                        isPreview: previewOrders != null,
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProviderStatusBadge extends StatelessWidget {
  const ProviderStatusBadge({required this.status, this.label, super.key});
  final String status;
  final String? label;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = switch (status) {
      'completed' => scheme.secondary,
      'cancelled' => scheme.error,
      'in_progress' => scheme.onSecondaryContainer,
      _ => scheme.primary,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label ?? orderStatusLabel(status),
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _WeekStrip extends StatelessWidget {
  const _WeekStrip({
    required this.selected,
    required this.start,
    required this.controller,
    required this.onSelected,
    required this.orders,
    required this.viewedOrderIds,
  });
  final DateTime selected;
  final DateTime start;
  final ScrollController controller;
  final ValueChanged<DateTime> onSelected;
  final List<OrderSummary> orders;
  final Set<String> viewedOrderIds;
  @override
  Widget build(BuildContext context) {
    final today = DateUtils.dateOnly(DateTime.now());
    final tomorrow = DateTime(today.year, today.month, today.day + 1);
    const labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    final scheme = Theme.of(context).colorScheme;
    return SingleChildScrollView(
      controller: controller,
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var index = 0; index < 7; index++)
            Builder(
              builder: (context) {
                final day = DateTime(
                  start.year,
                  start.month,
                  start.day + index,
                );
                final isSelected = DateUtils.isSameDay(day, selected);
                final dailyOrders = _ordersOnDay(orders, day);
                final unread = dailyOrders.any(
                  (order) => !viewedOrderIds.contains(order.id),
                );
                final label = isSelected && DateUtils.isSameDay(day, today)
                    ? 'Hôm nay'
                    : isSelected && DateUtils.isSameDay(day, tomorrow)
                    ? 'Ngày mai'
                    : null;
                return Padding(
                  padding: EdgeInsets.only(right: index == 6 ? 0 : 8),
                  child: SizedBox(
                    width: 76,
                    child: Semantics(
                      selected: isSelected,
                      label:
                          '${labels[day.weekday - 1]}, ${DateFormat('d/M').format(day)}, '
                          '${dailyOrders.length} lịch hẹn${unread ? ', có đơn chưa xem' : ''}',
                      child: TextButton(
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 12,
                          ),
                          backgroundColor: isSelected
                              ? scheme.primaryContainer
                              : scheme.surfaceContainerLowest,
                          foregroundColor: isSelected
                              ? scheme.onPrimary
                              : scheme.onSurfaceVariant,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(
                              color: isSelected
                                  ? scheme.primary
                                  : scheme.outlineVariant.withValues(alpha: .3),
                            ),
                          ),
                        ),
                        onPressed: () => onSelected(day),
                        child: Column(
                          children: [
                            Text(
                              labels[day.weekday - 1],
                              style: const TextStyle(fontSize: 12),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              DateFormat('d/M').format(day),
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 6),
                            SizedBox(
                              height: MediaQuery.textScalerOf(
                                context,
                              ).scale(16),
                              child: Center(
                                child: label != null
                                    ? Text(
                                        label,
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      )
                                    : Container(
                                        key: ValueKey(
                                          'schedule-dot-${DateFormat('yyyy-MM-dd').format(day)}',
                                        ),
                                        width: 6,
                                        height: 6,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: unread
                                              ? scheme.error
                                              : scheme.outlineVariant,
                                        ),
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({
    required this.order,
    this.showDate = false,
    this.isPreview = false,
  });
  final OrderSummary order;
  final bool showDate;
  final bool isPreview;
  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: isPreview
          ? null
          : () => context.push('/provider/orders/${order.id}'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 12,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  order.scheduledAt == null
                      ? 'Chưa có lịch hẹn'
                      : DateFormat(
                          showDate ? 'dd/MM • HH:mm' : 'HH:mm',
                        ).format(order.scheduledAt!.toLocal()),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                ProviderStatusBadge(status: order.status),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              order.serviceName,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            if (order.totalAmount != null) ...[
              const SizedBox(height: 6),
              Text(
                _money(order.totalAmount!),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            const SizedBox(height: 8),
            _MetaLine(
              icon: Icons.location_on_outlined,
              text: order.addressLabel ?? order.code,
            ),
          ],
        ),
      ),
    ),
  );
}

class _MetaLine extends StatelessWidget {
  const _MetaLine({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(
        icon,
        size: 16,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          text,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    ],
  );
}

class ProviderAccountScreen extends ConsumerWidget {
  const ProviderAccountScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Tài khoản')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Card(
            margin: EdgeInsets.zero,
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: ProviderAvatar(url: user?.avatar),
              title: Text(
                user?.fullName ?? 'Đối tác Handigo',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                user?.email ?? '',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/provider/profile'),
            ),
          ),
          const SizedBox(height: 24),
          const _SectionHeading(
            title: 'Quản lý công việc',
            icon: Icons.handyman_outlined,
          ),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: [
                _accountItem(
                  context,
                  'Hồ sơ đối tác',
                  Icons.badge_outlined,
                  '/provider/profile',
                ),
                _accountItem(
                  context,
                  'Ví và thu nhập',
                  Icons.account_balance_wallet_outlined,
                  '/provider/wallet',
                ),
                _accountItem(
                  context,
                  'Tài khoản ngân hàng',
                  Icons.account_balance_outlined,
                  '/provider/banks',
                ),
                _accountItem(
                  context,
                  'Đánh giá khách hàng',
                  Icons.star_outline,
                  '/provider/feedback',
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const _SectionHeading(
            title: 'Cài đặt',
            icon: Icons.settings_outlined,
          ),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: [
                _accountItem(
                  context,
                  'Thông báo',
                  Icons.notifications_outlined,
                  '/provider/notifications',
                ),
                _accountItem(
                  context,
                  'Cài đặt ứng dụng',
                  Icons.tune_rounded,
                  '/provider/settings',
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: scheme.error,
              side: BorderSide(color: scheme.error.withValues(alpha: .4)),
            ),
            onPressed: () => ref.read(authControllerProvider).logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Đăng xuất'),
          ),
        ],
      ),
    );
  }

  Widget _accountItem(
    BuildContext context,
    String title,
    IconData icon,
    String route,
  ) => ListTile(
    leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
    title: Text(title, style: const TextStyle(fontSize: 14)),
    trailing: const Icon(Icons.chevron_right, size: 20),
    onTap: () => context.push(route),
  );
}

List<OrderSummary> _ordersOnDay(List<OrderSummary> orders, DateTime day) =>
    orders
        .where(
          (order) =>
              order.status != 'cancelled' &&
              order.scheduledAt != null &&
              DateUtils.isSameDay(order.scheduledAt!.toLocal(), day),
        )
        .toList()
      ..sort((a, b) => a.scheduledAt!.compareTo(b.scheduledAt!));

String _availabilityLabel(String value) =>
    {
      'online': 'Đang sẵn sàng nhận đơn',
      'busy': 'Đang thực hiện đơn',
      'offline': 'Tạm ngưng nhận đơn',
    }[value] ??
    value;
String _dateLabel(DateTime? value) => value == null
    ? 'Chưa có lịch hẹn'
    : DateFormat('dd/MM/yyyy HH:mm').format(value.toLocal());
String _money(double value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);
String _message(Object error) => error is ApiException
    ? error.message
    : 'Không thể tải dữ liệu. Vui lòng thử lại.';
