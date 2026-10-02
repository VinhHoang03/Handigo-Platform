import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_states.dart';
import '../../orders/domain/order_summary.dart';
import '../../orders/presentation/order_screens.dart';
import '../data/provider_repository.dart';
import '../domain/provider_models.dart';

final providerRepositoryProvider = Provider<ProviderRepository>(
  (ref) => ProviderRepository(ref.watch(apiClientProvider)),
);
final providerOverviewProvider = FutureProvider.autoDispose<ProviderOverview>(
  (ref) => ref.watch(providerRepositoryProvider).overview(),
);
final providerOrdersProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).orders(),
);
final providerAssignmentsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).pendingAssignments(),
);

class ProviderShell extends StatefulWidget {
  const ProviderShell({super.key});
  @override
  State<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends State<ProviderShell> {
  int index = 0;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: IndexedStack(
      index: index,
      children: const [
        ProviderDashboardScreen(),
        ProviderOrdersScreen(),
        ProviderScheduleScreen(),
        ProviderAccountScreen(),
      ],
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: index,
      onDestinationSelected: (value) => setState(() => index = value),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Tổng quan',
        ),
        NavigationDestination(
          icon: Icon(Icons.assignment_outlined),
          selectedIcon: Icon(Icons.assignment),
          label: 'Đơn được giao',
        ),
        NavigationDestination(
          icon: Icon(Icons.calendar_month_outlined),
          selectedIcon: Icon(Icons.calendar_month),
          label: 'Lịch hẹn',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline),
          selectedIcon: Icon(Icons.person),
          label: 'Tài khoản',
        ),
      ],
    ),
  );
}

class ProviderDashboardScreen extends ConsumerWidget {
  const ProviderDashboardScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerOverviewProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Handigo Đối tác'),
        actions: [
          IconButton(
            tooltip: 'Thông báo',
            onPressed: () => context.push('/provider/notifications'),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(providerOverviewProvider.future),
        child: state.when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: _message(error),
            onRetry: () => ref.invalidate(providerOverviewProvider),
          ),
          data: (data) => ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _ProviderHero(data: data),
              const SizedBox(height: 12),
              _AvailabilityCard(data: data),
              const SizedBox(height: 16),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.55,
                children: [
                  _MetricCard(
                    label: 'Thu nhập tháng',
                    value: _money(data.monthlyEarnings),
                    icon: Icons.payments_outlined,
                  ),
                  _MetricCard(
                    label: 'Số dư ví',
                    value: _money(data.walletBalance),
                    icon: Icons.account_balance_wallet_outlined,
                  ),
                  _MetricCard(
                    label: 'Đơn hoàn tất',
                    value: '${data.completedOrders}',
                    icon: Icons.task_alt,
                  ),
                  _MetricCard(
                    label: 'Đánh giá',
                    value: data.averageRating.toStringAsFixed(1),
                    icon: Icons.star_outline,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                'Đơn cần phản hồi',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              const _PendingAssignmentList(),
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
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: Icon(
        Icons.circle,
        color: widget.data.availabilityStatus == 'online'
            ? AppTheme.successGreen
            : Colors.grey,
      ),
      title: const Text('Trạng thái nhận việc'),
      subtitle: Text(_availabilityLabel(widget.data.availabilityStatus)),
      trailing: Switch(
        value: widget.data.availabilityStatus == 'online',
        onChanged: busy
            ? null
            : (value) async {
                setState(() => busy = true);
                try {
                  await ref
                      .read(providerRepositoryProvider)
                      .setAvailability(value ? 'online' : 'offline');
                  ref.invalidate(providerOverviewProvider);
                } catch (error) {
                  if (context.mounted)
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text(_message(error))));
                } finally {
                  if (mounted) setState(() => busy = false);
                }
              },
      ),
    ),
  );
}

class _ProviderHero extends StatelessWidget {
  const _ProviderHero({required this.data});
  final ProviderOverview data;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          colors: [AppTheme.primaryDark, scheme.primary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Xin chào, Đối tác',
                  style: TextStyle(
                    color: scheme.onPrimary.withValues(alpha: .82),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Sẵn sàng tạo thêm thu nhập?',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: scheme.onPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Theo dõi đơn, lịch hẹn và thu nhập tại một nơi.',
                  style: TextStyle(
                    color: scheme.onPrimary.withValues(alpha: .82),
                  ),
                ),
              ],
            ),
          ),
          Icon(
            Icons.handyman_rounded,
            size: 54,
            color: scheme.onPrimary.withValues(alpha: .9),
          ),
        ],
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
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: Theme.of(context).colorScheme.primary),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    ),
  );
}

class _PendingAssignmentList extends ConsumerWidget {
  const _PendingAssignmentList();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerAssignmentsProvider);
    return state.when(
      loading: () => const LinearProgressIndicator(),
      error: (error, _) => AppMessage(
        message: _message(error),
        onRetry: () => ref.invalidate(providerAssignmentsProvider),
      ),
      data: (items) {
        if (items.isEmpty)
          return const AppMessage(message: 'Hiện không có đơn chờ phản hồi.');
        return Column(
          children: items
              .take(3)
              .map(
                (item) => Card(
                  child: ListTile(
                    title: Text(item.serviceName),
                    subtitle: Text(
                      '${item.orderCode}\n${_dateLabel(item.scheduledAt)}',
                    ),
                    isThreeLine: true,
                    onTap: () =>
                        context.push('/provider/orders/${item.orderId}'),
                    trailing: PopupMenuButton<String>(
                      tooltip: 'Phản hồi đơn',
                      onSelected: (value) async {
                        try {
                          if (value == 'accept')
                            await ref
                                .read(providerRepositoryProvider)
                                .acceptAssignment(item.id);
                          else
                            await ref
                                .read(providerRepositoryProvider)
                                .rejectAssignment(
                                  item.id,
                                  'Provider chưa thể nhận đơn.',
                                );
                          ref.invalidate(providerAssignmentsProvider);
                          ref.invalidate(providerOrdersProvider);
                          ref.invalidate(providerOverviewProvider);
                        } catch (error) {
                          if (context.mounted)
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(_message(error))),
                            );
                        }
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(value: 'accept', child: Text('Nhận đơn')),
                        PopupMenuItem(value: 'reject', child: Text('Từ chối')),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class ProviderOrdersScreen extends ConsumerWidget {
  const ProviderOrdersScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerOrdersProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đơn việc của tôi'),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(providerOrdersProvider),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(providerOrdersProvider.future),
        child: state.when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: _message(error),
            onRetry: () => ref.invalidate(providerOrdersProvider),
          ),
          data: (page) => page.items.isEmpty
              ? const AppMessage(message: 'Chưa có đơn được giao.')
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: page.items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, index) =>
                      _ProviderOrderCard(order: page.items[index]),
                ),
        ),
      ),
    );
  }
}

class _ProviderOrderCard extends StatelessWidget {
  const _ProviderOrderCard({required this.order});
  final OrderSummary order;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/provider/orders/${order.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      order.code,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  _StatusBadge(
                    label: orderStatusLabel(order.status),
                    color: scheme.primary,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                order.serviceName,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              if (order.addressLabel?.isNotEmpty == true) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 17),
                    const SizedBox(width: 6),
                    Expanded(child: Text(order.addressLabel!)),
                  ],
                ),
              ],
              if (order.scheduledAt != null) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.schedule_outlined, size: 17),
                    const SizedBox(width: 6),
                    Text(_dateLabel(order.scheduledAt)),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  'Xem chi tiết  ›',
                  style: TextStyle(
                    color: scheme.primary,
                    fontWeight: FontWeight.w700,
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

class ProviderScheduleScreen extends ConsumerWidget {
  const ProviderScheduleScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerOrdersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Lịch làm việc của tôi')),
      body: state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: _message(error),
          onRetry: () => ref.invalidate(providerOrdersProvider),
        ),
        data: (page) {
          final scheduled =
              page.items.where((order) => order.scheduledAt != null).toList()
                ..sort((a, b) => a.scheduledAt!.compareTo(b.scheduledAt!));
          if (scheduled.isEmpty)
            return const AppMessage(
              message: 'Chưa có lịch hẹn từ các đơn được giao.',
            );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            children: [
              _WeekStrip(selected: DateTime.now()),
              const SizedBox(height: 16),
              _ScheduleSummary(count: scheduled.length),
              const SizedBox(height: 20),
              Text(
                'Lịch trình công việc',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              ...scheduled.map(
                (order) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _AppointmentCard(order: order),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});
  final String label;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: color.withValues(alpha: .12),
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(
      label,
      style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
    ),
  );
}

class _WeekStrip extends StatelessWidget {
  const _WeekStrip({required this.selected});
  final DateTime selected;
  @override
  Widget build(BuildContext context) {
    final start = selected.subtract(Duration(days: selected.weekday - 1));
    const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    return SizedBox(
      height: 78,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: 7,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, index) {
          final day = start.add(Duration(days: index));
          final active = day.day == selected.day;
          final color = Theme.of(context).colorScheme;
          return Container(
            width: 52,
            padding: const EdgeInsets.symmetric(vertical: 9),
            decoration: BoxDecoration(
              color: active ? color.primary : color.surfaceContainerLow,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  weekdayLabels[index],
                  style: TextStyle(
                    fontSize: 11,
                    color: active ? Colors.white : null,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${day.day}',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: active ? Colors.white : null,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ScheduleSummary extends StatelessWidget {
  const _ScheduleSummary({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: Icon(
        Icons.event_note_rounded,
        color: Theme.of(context).colorScheme.primary,
      ),
      title: Text('$count lịch hẹn'),
      subtitle: const Text('Hôm nay'),
      trailing: const Icon(Icons.chevron_right),
    ),
  );
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({required this.order});
  final OrderSummary order;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: Container(
        width: 5,
        height: 54,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary,
          borderRadius: BorderRadius.circular(4),
        ),
      ),
      title: Text(
        order.serviceName,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        '${_dateLabel(order.scheduledAt)}\n${order.addressLabel ?? order.code}',
      ),
      isThreeLine: true,
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.push('/provider/orders/${order.id}'),
    ),
  );
}

class ProviderAccountScreen extends ConsumerWidget {
  const ProviderAccountScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Tài khoản Provider')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person)),
              title: Text(auth.user?.fullName ?? 'Provider'),
              subtitle: Text(auth.user?.email ?? ''),
              onTap: () => context.push('/provider/profile'),
            ),
          ),
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.account_balance_wallet_outlined),
            title: const Text('Ví và thu nhập'),
            onTap: () => context.push('/provider/wallet'),
          ),
          ListTile(
            leading: const Icon(Icons.account_balance_outlined),
            title: const Text('Tài khoản ngân hàng'),
            onTap: () => context.push('/provider/banks'),
          ),
          ListTile(
            leading: const Icon(Icons.star_outline),
            title: const Text('Đánh giá khách hàng'),
            onTap: () => context.push('/provider/feedback'),
          ),
          ListTile(
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Thông báo'),
            onTap: () => context.push('/provider/notifications'),
          ),
          ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: const Text('Cài đặt'),
            onTap: () => context.push('/provider/settings'),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () => ref.read(authControllerProvider).logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Đăng xuất'),
          ),
        ],
      ),
    );
  }
}

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
