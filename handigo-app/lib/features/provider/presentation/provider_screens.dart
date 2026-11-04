import '../../../shared/widgets/app_search_field.dart';
import 'dart:convert';
import 'dart:developer' as developer;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/account_overview_widgets.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/customer_page_header.dart';
import '../../../shared/widgets/provider_avatar.dart';
import '../../../shared/widgets/service_images.dart';
import '../../orders/domain/order_summary.dart';
import '../../orders/presentation/order_screens.dart';
import '../data/provider_repository.dart';
import '../data/provider_location_service.dart';
import '../domain/provider_models.dart';
import 'provider_schedule_preview.dart';
import 'provider_history_widgets.dart';
import 'provider_inbox_visits.dart';
import 'provider_assignment_customer_info.dart';
import 'provider_income_screen.dart';

bool _schedulePreviewRegistered = false;
ValueChanged<bool>? _setActiveSchedulePreview;

@visibleForTesting
void setSchedulePreviewForDebug(bool enabled) {
  if (kDebugMode) _setActiveSchedulePreview?.call(enabled);
}

final providerRepositoryProvider = Provider<ProviderRepository>(
  (ref) => ProviderRepository(ref.watch(apiClientProvider)),
);
final providerLocationServiceProvider =
    ChangeNotifierProvider<ProviderLocationService>((ref) {
      ref.watch(authControllerProvider.select((auth) => auth.user?.id));
      return ProviderLocationService(ref.watch(apiClientProvider));
    });
final providerCurrentLocationProvider = FutureProvider<void>(
  retry: (_, _) => null,
  (ref) async {
    final userId = ref.watch(
      authControllerProvider.select((auth) => auth.user?.id),
    );
    if (userId == null || ref.watch(providerUiPreviewProvider) != null) return;
    await ref
        .watch(providerLocationServiceProvider.notifier)
        .synchronize(
          shouldUpload: () =>
              ref.mounted &&
              ref.read(authControllerProvider).user?.id == userId,
        );
  },
);
final providerWorkingAddressProvider = FutureProvider.autoDispose<String?>((
  ref,
) async {
  if (ref.watch(providerUiPreviewProvider) != null) return null;
  ref.watch(authControllerProvider.select((auth) => auth.user?.id));
  final position = ref.watch(
    providerLocationServiceProvider.select(
      (service) => (
        service.synchronizedPosition?.latitude,
        service.synchronizedPosition?.longitude,
      ),
    ),
  );
  if (position.$1 != null && position.$2 != null) {
    return ref
        .watch(providerRepositoryProvider)
        .workingAddress(latitude: position.$1, longitude: position.$2);
  }
  await ref.watch(providerCurrentLocationProvider.future);
  if (!ref.mounted) return null;
  return ref.watch(providerRepositoryProvider).workingAddress();
});

final providerNotificationBadgeProvider =
    FutureProvider.autoDispose<({int count, DateTime? latestAt})>(
      retry: (_, _) => null,
      (ref) async {
        final userId = ref.watch(
          authControllerProvider.select((auth) => auth.user?.id),
        );
        if (userId == null) return (count: 0, latestAt: null);
        final visits = await ref.watch(providerInboxVisitsProvider.future);
        if (!ref.mounted) return (count: 0, latestAt: null);
        return ref
            .watch(providerRepositoryProvider)
            .notificationBadge(visits.notifications);
      },
    );

final providerMessageBadgeProvider =
    FutureProvider.autoDispose<({int count, DateTime? latestAt})>(
      retry: (_, _) => null,
      (ref) async {
        final userId = ref.watch(
          authControllerProvider.select((auth) => auth.user?.id),
        );
        if (userId == null) return (count: 0, latestAt: null);
        final visits = await ref.watch(providerInboxVisitsProvider.future);
        if (!ref.mounted) return (count: 0, latestAt: null);
        return ref
            .watch(providerRepositoryProvider)
            .messageBadge(userId, visits.messages);
      },
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
final providerOrderPageProvider = FutureProvider.autoDispose
    .family<PagedResult<OrderSummary>, (int, String, String)>((ref, query) {
      final preview = ref.watch(providerUiPreviewProvider);
      if (preview != null) {
        return PagedResult(
          items: preview
              .where((item) => query.$2 == 'all' || item.status == query.$2)
              .toList(),
          page: 1,
          totalPages: 1,
        );
      }
      return ref
          .watch(providerRepositoryProvider)
          .orders(page: query.$1, status: query.$2, search: query.$3);
    });

final providerScheduleOrdersProvider =
    FutureProvider.autoDispose<PagedResult<OrderSummary>>((ref) async {
      final first = await ref.watch(providerOrdersProvider.future);
      if (first.totalPages <= 1) return first;
      final items = [...first.items];
      for (var page = 2; page <= first.totalPages; page++) {
        if (!ref.mounted) return first;
        final next = await ref
            .read(providerRepositoryProvider)
            .orders(page: page);
        items.addAll(next.items);
      }
      return PagedResult(items: items, page: 1, totalPages: 1);
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
  const ProviderShell({this.navigationShell, super.key});
  final StatefulNavigationShell? navigationShell;
  @override
  State<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends State<ProviderShell> {
  int index = 0;
  void _showSchedule() => setState(() => index = 3);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final activeIndex = widget.navigationShell?.currentIndex ?? index;
    final content =
        widget.navigationShell ??
        IndexedStack(
          index: index,
          children: [
            ProviderDashboardScreen(
              onOrders: () => setState(() => index = 1),
              onIncome: () => setState(() => index = 2),
              onSchedule: _showSchedule,
            ),
            const ProviderOrdersScreen(),
            const ProviderIncomeScreen(asTab: true),
            ProviderScheduleScreen(isActive: index == 3),
            const ProviderAccountScreen(),
          ],
        );
    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: Colors.transparent,
      body: _ProviderShellBackground(
        child: Theme(
          data: Theme.of(
            context,
          ).copyWith(scaffoldBackgroundColor: Colors.transparent),
          child: TweenAnimationBuilder<double>(
            key: const ValueKey('provider-tab-transition'),
            tween: Tween(begin: 0, end: 1),
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : const Duration(milliseconds: 260),
            curve: Curves.easeOutCubic,
            builder: (context, value, child) => Opacity(
              opacity: value,
              child: Transform.translate(
                offset: Offset(14 * (1 - value), 0),
                child: child,
              ),
            ),
            child: content,
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(10, 4, 10, 8),
        child: Material(
          color: scheme.surfaceContainerLowest,
          elevation: 8,
          shadowColor: scheme.primary.withValues(alpha: .16),
          borderRadius: BorderRadius.circular(28),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(5, 7, 5, 5),
            child: Row(
              children: [
                for (final (tabIndex, label, icon, activeIcon) in const [
                  (0, 'Tổng quan', Icons.home_outlined, Icons.home_rounded),
                  (
                    1,
                    'Đơn hàng',
                    Icons.assignment_outlined,
                    Icons.assignment_rounded,
                  ),
                  (
                    2,
                    'Thu nhập',
                    Icons.bar_chart_outlined,
                    Icons.bar_chart_rounded,
                  ),
                  (
                    3,
                    'Lịch hẹn',
                    Icons.calendar_month_outlined,
                    Icons.calendar_month_rounded,
                  ),
                  (4, 'Tài khoản', Icons.person_outline, Icons.person_rounded),
                ])
                  Expanded(
                    child: _ProviderNavItem(
                      label: label,
                      icon: icon,
                      activeIcon: activeIcon,
                      selected: activeIndex == tabIndex,
                      emphasized: tabIndex == 2,
                      onTap: () {
                        if (widget.navigationShell case final shell?) {
                          shell.goBranch(
                            tabIndex,
                            initialLocation: tabIndex == activeIndex,
                          );
                        } else {
                          setState(() => index = tabIndex);
                        }
                      },
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

class _ProviderNavItem extends StatelessWidget {
  const _ProviderNavItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.selected,
    required this.emphasized,
    required this.onTap,
  });
  final String label;
  final IconData icon, activeIcon;
  final bool selected, emphasized;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 240);
    return Semantics(
      selected: selected,
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedScale(
                scale: selected ? (emphasized ? 1.16 : 1.1) : 1,
                duration: duration,
                curve: Curves.easeOutBack,
                child: AnimatedContainer(
                  duration: duration,
                  curve: Curves.easeOutCubic,
                  width: selected && emphasized ? 34 : 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: selected
                        ? scheme.primary.withValues(alpha: .1)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(
                    selected ? activeIcon : icon,
                    size: selected ? 22 : 21,
                    color: selected ? scheme.primary : scheme.onSurfaceVariant,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              AnimatedDefaultTextStyle(
                duration: duration,
                curve: Curves.easeOut,
                style: Theme.of(context).textTheme.labelSmall!.copyWith(
                  color: selected ? scheme.primary : scheme.onSurfaceVariant,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  fontSize: 10.5,
                ),
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 3),
              AnimatedContainer(
                duration: duration,
                curve: Curves.easeOutCubic,
                width: selected ? 22 : 0,
                height: 3,
                decoration: BoxDecoration(
                  color: scheme.primary,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProviderShellBackground extends StatelessWidget {
  const _ProviderShellBackground({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFFFCFBFF), Color(0xFFF4F1FF)],
      ),
    ),
    child: Stack(
      children: [
        Positioned(
          top: -80,
          right: -60,
          child: IgnorePointer(
            child: Container(
              width: 220,
              height: 220,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [Color(0x1F8B72FF), Color(0x008B72FF)],
                ),
              ),
            ),
          ),
        ),
        Positioned(
          left: -100,
          bottom: 20,
          child: IgnorePointer(
            child: Transform.rotate(
              angle: -.22,
              child: Container(
                width: 300,
                height: 130,
                decoration: BoxDecoration(
                  color: const Color(0x127D64F5),
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
          ),
        ),
        Positioned.fill(child: child),
      ],
    ),
  );
}

class ProviderDashboardScreen extends ConsumerWidget {
  const ProviderDashboardScreen({
    this.onOrders,
    this.onIncome,
    this.onSchedule,
    super.key,
  });
  final VoidCallback? onOrders, onIncome, onSchedule;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerOverviewProvider);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
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
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Tin nhắn',
            onPressed: () {
              ref
                  .read(providerInboxVisitsProvider.notifier)
                  .open(
                    ProviderInboxSection.messages,
                    latestAt: ref
                        .read(providerMessageBadgeProvider)
                        .asData
                        ?.value
                        .latestAt,
                  );
              context.push('/provider/chat');
            },
            icon: _InboxBadge(
              count:
                  ref.watch(providerMessageBadgeProvider).asData?.value.count ??
                  0,
              icon: Icons.chat_bubble_outline_rounded,
            ),
          ),
          IconButton(
            tooltip: 'Thông báo',
            onPressed: () {
              ref
                  .read(providerInboxVisitsProvider.notifier)
                  .open(
                    ProviderInboxSection.notifications,
                    latestAt: ref
                        .read(providerNotificationBadgeProvider)
                        .asData
                        ?.value
                        .latestAt,
                  );
              context.push('/provider/notifications');
            },
            icon: _InboxBadge(
              count:
                  ref
                      .watch(providerNotificationBadgeProvider)
                      .asData
                      ?.value
                      .count ??
                  0,
              icon: Icons.notifications_none_rounded,
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(providerAssignmentsProvider);
          ref.invalidate(providerOrdersProvider);
          ref.invalidate(providerScheduleOrdersProvider);
          await Future.wait([
            ref.refresh(providerOverviewProvider.future),
            ref.read(providerScheduleOrdersProvider.future),
            ref.read(providerAssignmentsProvider.future),
          ]).catchError((Object _) => <Object>[]);
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
              _HomeAssignments(onOrders: onOrders),
              _SectionHeading(
                title: 'Đơn cần xử lý',
                icon: Icons.assignment_outlined,
                action: TextButton(
                  onPressed: onOrders ?? () => context.go('/provider/orders'),
                  child: const Text('Xem tất cả'),
                ),
              ),
              ref
                  .watch(providerScheduleOrdersProvider)
                  .when(
                    loading: () => const LinearProgressIndicator(),
                    error: (error, _) => AppMessage(
                      message: _message(error),
                      onRetry: () =>
                          ref.invalidate(providerScheduleOrdersProvider),
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
                          for (final order in active.take(1))
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _HomeOrderCard(
                                order: order,
                                isPreview:
                                    ref.watch(providerUiPreviewProvider) !=
                                    null,
                              ),
                            ),
                        ],
                      );
                    },
                  ),
              const SizedBox(height: 24),
              _HomeSummary(data: data, onIncome: onIncome),
              const SizedBox(height: 24),
              _SectionHeading(
                title: 'Lịch hẹn hôm nay',
                icon: Icons.event_note_outlined,
                action: TextButton(
                  onPressed:
                      onSchedule ?? () => context.go('/provider/schedule'),
                  child: const Text('Xem lịch'),
                ),
              ),
              ref
                  .watch(providerScheduleOrdersProvider)
                  .when(
                    loading: () => const LinearProgressIndicator(),
                    error: (error, _) => AppMessage(
                      message: _message(error),
                      onRetry: () =>
                          ref.invalidate(providerScheduleOrdersProvider),
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

class _InboxBadge extends StatelessWidget {
  const _InboxBadge({required this.count, required this.icon});
  final int count;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Badge(
    isLabelVisible: count > 0,
    backgroundColor: Theme.of(context).colorScheme.error,
    textColor: Theme.of(context).colorScheme.onError,
    label: Text(count > 99 ? '99+' : '$count'),
    child: Icon(icon),
  );
}

class _HomeAssignments extends ConsumerWidget {
  const _HomeAssignments({this.onOrders});
  final VoidCallback? onOrders;

  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(providerAssignmentsProvider)
      .when(
        loading: () => const Padding(
          padding: EdgeInsets.only(bottom: 16),
          child: LinearProgressIndicator(),
        ),
        error: (error, _) => Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: AppMessage(
            message: 'Chưa tải được đề nghị nhận việc.',
            onRetry: () => ref.invalidate(providerAssignmentsProvider),
          ),
        ),
        data: (items) {
          final pending = items
              .where(
                (item) =>
                    item.responseDeadline == null ||
                    item.responseDeadline!.isAfter(DateTime.now()),
              )
              .length;
          if (pending == 0) return const SizedBox.shrink();
          final scheme = Theme.of(context).colorScheme;
          return Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Card(
              margin: EdgeInsets.zero,
              color: scheme.secondaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Bạn có $pending đề nghị nhận việc',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: scheme.onSecondaryContainer,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Kiểm tra thông tin và phản hồi trước khi hết hạn.',
                      style: TextStyle(color: scheme.onSecondaryContainer),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed:
                          onOrders ?? () => context.go('/provider/orders'),
                      icon: const Icon(Icons.arrow_forward_rounded),
                      label: const Text('Xem đề nghị'),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
}

class _HomeOrderCard extends StatelessWidget {
  const _HomeOrderCard({required this.order, this.isPreview = false});
  final OrderSummary order;
  final bool isPreview;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final working = order.status == 'in_progress';
    return Card(
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: working ? scheme.primary : scheme.outlineVariant,
        ),
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
                ProviderStatusBadge(status: order.status),
                Text(order.code, style: Theme.of(context).textTheme.labelSmall),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              order.serviceName,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            _MetaLine(
              icon: Icons.schedule_outlined,
              text: order.scheduledAt == null
                  ? 'Đặt ngay'
                  : _dateLabel(order.scheduledAt),
            ),
            if (order.serviceType == 'variable_price') ...[
              const SizedBox(height: 8),
              ProviderAssignmentCustomerInfo(orderId: order.id, order: order),
            ] else if (order.customerName?.isNotEmpty == true) ...[
              const SizedBox(height: 8),
              _MetaLine(icon: Icons.person_outline, text: order.customerName!),
            ],
            if (order.addressLabel?.isNotEmpty == true) ...[
              const SizedBox(height: 8),
              _MetaLine(
                icon: Icons.location_on_outlined,
                text: order.addressLabel!,
              ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: isPreview
                    ? null
                    : () => context.push('/provider/orders/${order.id}'),
                icon: Icon(
                  working ? Icons.handyman_outlined : Icons.arrow_forward,
                ),
                label: Text(working ? 'Tiếp tục xử lý' : 'Xem công việc'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AvailabilityCard extends ConsumerStatefulWidget {
  const _AvailabilityCard({required this.data, super.key});
  final ProviderOverview data;
  @override
  ConsumerState<_AvailabilityCard> createState() => _AvailabilityCardState();
}

class _AvailabilityCardState extends ConsumerState<_AvailabilityCard> {
  bool busy = false;
  bool? _optimisticOnline;
  String? _lastAddress;

  @override
  void didUpdateWidget(covariant _AvailabilityCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!busy && !identical(oldWidget.data, widget.data)) {
      _optimisticOnline = null;
    }
  }

  Future<void> _changeAvailability(bool value) async {
    if (busy || ref.read(providerUiPreviewProvider) != null) return;
    final userId = ref.read(authControllerProvider).user?.id;
    if (userId == null) return;
    bool isCurrent() =>
        mounted && ref.read(authControllerProvider).user?.id == userId;
    final previous = _optimisticOnline;
    setState(() {
      busy = true;
      _optimisticOnline = value;
    });
    try {
      if (value) {
        ref.invalidate(providerCurrentLocationProvider);
        await ref.read(providerCurrentLocationProvider.future);
      }
      if (!isCurrent()) return;
      final result = await ref
          .read(providerRepositoryProvider)
          .setAvailability(value ? 'online' : 'offline', current: widget.data);
      if (!isCurrent()) return;
      setState(() => _optimisticOnline = result.availabilityStatus == 'online');
      if (!value) ref.read(providerLocationServiceProvider).stop();
      ref.invalidate(providerOverviewProvider);
    } catch (error) {
      if (mounted && isCurrent()) {
        setState(() => _optimisticOnline = previous);
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
    final online =
        _optimisticOnline ?? widget.data.availabilityStatus == 'online';
    final location = online ? ref.watch(providerCurrentLocationProvider) : null;
    final tracker = online ? ref.watch(providerLocationServiceProvider) : null;
    final trackingError = tracker?.error;
    final hasSyncedPosition = tracker?.synchronizedPosition != null;
    final address = online ? ref.watch(providerWorkingAddressProvider) : null;
    if (hasSyncedPosition ||
        (location?.hasValue == true && location?.hasError != true)) {
      final resolved = address?.asData?.value;
      if (resolved != null && resolved.trim().isNotEmpty) {
        _lastAddress = resolved;
      }
    }
    final locationFailed =
        (location?.hasError == true && !hasSyncedPosition) ||
        trackingError != null;
    final addressIsStale =
        locationFailed ||
        address?.hasError == true ||
        location?.isLoading == true ||
        address?.isLoading == true;
    return ColoredBox(
      color: Theme.of(context).colorScheme.surfaceContainerLowest,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Icon(
          Icons.circle,
          size: 12,
          color: online
              ? AppTheme.successGreen
              : Theme.of(context).colorScheme.outline,
        ),
        title: const Text(
          'Trạng thái nhận việc',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              busy
                  ? online
                        ? 'Đang bật nhận việc...'
                        : 'Đang tắt nhận việc...'
                  : _availabilityLabel(
                      _optimisticOnline == null
                          ? widget.data.availabilityStatus
                          : online
                          ? 'online'
                          : 'offline',
                    ),
              style: const TextStyle(fontSize: 13),
            ),
            if (location?.isLoading == true)
              const Text(
                'Đang cập nhật vị trí...',
                style: TextStyle(fontSize: 13),
              ),
            if (online && _lastAddress != null)
              Text(
                addressIsStale
                    ? 'Vị trí gần nhất: $_lastAddress'
                    : _lastAddress!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12),
              ),
            if (_lastAddress == null &&
                location?.hasValue == true &&
                !locationFailed)
              Text(
                address?.isLoading == true
                    ? 'Đang tìm địa chỉ theo GPS...'
                    : address?.asData?.value ??
                          'Đã cập nhật GPS. Chưa lấy được địa chỉ.',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12),
              ),
            if (location?.isLoading != true &&
                locationFailed &&
                _lastAddress == null)
              Text(
                'Chưa lấy được vị trí hiện tại.',
                style: TextStyle(
                  fontSize: 13,
                  color: Theme.of(context).colorScheme.error,
                ),
              ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (online) ...[
              IconButton.outlined(
                tooltip: 'Tải lại vị trí',
                style: IconButton.styleFrom(shape: const CircleBorder()),
                onPressed: busy || location?.isLoading == true
                    ? null
                    : () async {
                        try {
                          ref.invalidate(providerCurrentLocationProvider);
                          await ref.read(
                            providerCurrentLocationProvider.future,
                          );
                          if (mounted) {
                            ref.invalidate(providerWorkingAddressProvider);
                          }
                        } catch (error) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(_message(error))),
                            );
                          }
                        }
                      },
                icon: location?.isLoading == true
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh_rounded),
              ),
              const SizedBox(width: 8),
            ],
            Switch(value: online, onChanged: busy ? null : _changeAvailability),
          ],
        ),
      ),
    );
  }
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
                ProviderAvatar(url: user?.avatar, gender: user?.gender),
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
                            ?.copyWith(fontWeight: FontWeight.w600),
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
          const Divider(height: 1),
          _AvailabilityCard(key: ValueKey(user?.id), data: data),
        ],
      ),
    );
  }
}

class _HomeSummary extends StatelessWidget {
  const _HomeSummary({required this.data, this.onIncome});
  final ProviderOverview data;
  final VoidCallback? onIncome;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Card(
          margin: EdgeInsets.zero,
          color: scheme.primaryContainer,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onIncome ?? () => context.push('/provider/income'),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Thu nhập tháng này',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(color: scheme.onPrimary),
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward_rounded,
                        color: scheme.onPrimary,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _money(data.monthlyEarnings),
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: scheme.onPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Theo kết quả quyết toán công việc',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: scheme.onPrimary),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final stacked =
                constraints.maxWidth < 300 ||
                MediaQuery.textScalerOf(context).scale(1) > 1.3;
            final width = stacked
                ? constraints.maxWidth
                : (constraints.maxWidth - 12) / 2;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                SizedBox(
                  width: width,
                  child: _MetricCard(
                    label: 'Đơn hoàn tất',
                    value: '${data.completedOrders}',
                    icon: Icons.task_alt_rounded,
                  ),
                ),
                SizedBox(
                  width: width,
                  child: _MetricCard(
                    label: 'Đánh giá trung bình',
                    value: data.averageRating > 0
                        ? '${data.averageRating.toStringAsFixed(1)}/5'
                        : 'Chưa có',
                    icon: Icons.star_outline_rounded,
                  ),
                ),
              ],
            );
          },
        ),
      ],
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
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
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
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        ?action,
      ],
    ),
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
    if (widget.item.responseDeadline?.isBefore(DateTime.now()) == true) {
      ref.invalidate(providerAssignmentsProvider);
      return;
    }
    String reason = '';
    if (!accept) {
      final controller = TextEditingController();
      final value = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Từ chối đề nghị'),
          content: TextField(
            controller: controller,
            maxLength: 500,
            decoration: const InputDecoration(
              labelText: 'Lý do (không bắt buộc)',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Quay lại'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, controller.text.trim()),
              child: const Text('Từ chối'),
            ),
          ],
        ),
      );
      controller.dispose();
      if (value == null || !mounted) return;
      reason = value;
    }
    setState(() => busy = true);
    final ownerId = ref.read(authControllerProvider).user?.id;
    try {
      final repository = ref.read(providerRepositoryProvider);
      if (accept) {
        await repository.acceptAssignment(widget.item.id);
      } else {
        await repository.rejectAssignment(widget.item.id, reason);
      }
      if (!mounted || ownerId != ref.read(authControllerProvider).user?.id) {
        return;
      }
      ref.invalidate(providerAssignmentsProvider);
      ref.invalidate(providerOrdersProvider);
      ref.invalidate(providerOrderPageProvider);
      ref.invalidate(providerScheduleOrdersProvider);
      ref.invalidate(providerOverviewProvider);
      if (accept) {
        ref.invalidate(orderDetailProvider(widget.item.orderId));
        context.go('/provider/orders/${widget.item.orderId}');
        return;
      }
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Đã từ chối đơn.')));
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
                          fontWeight: FontWeight.w600,
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
                  const SizedBox(height: 8),
                  ProviderAssignmentCustomerInfo(
                    orderId: item.orderId,
                    assignment: item,
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
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, constraints) {
                final reject = OutlinedButton(
                  onPressed:
                      busy ||
                          item.responseDeadline?.isBefore(DateTime.now()) ==
                              true
                      ? null
                      : () => _respond(false),
                  child: const Text('Từ chối'),
                );
                final accept = FilledButton.icon(
                  onPressed:
                      busy ||
                          item.responseDeadline?.isBefore(DateTime.now()) ==
                              true
                      ? null
                      : () => _respond(true),
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
  String filter = 'all', search = '';
  int pageIndex = 1;
  @override
  Widget build(BuildContext context) {
    final query = (pageIndex, filter == 'pending' ? 'all' : filter, search);
    final state = ref.watch(providerOrderPageProvider(query));
    final assignments = ref.watch(providerAssignmentsProvider);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 88 * MediaQuery.textScalerOf(context).scale(1),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: scheme.primaryFixed,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.receipt_long_outlined,
                color: scheme.primary,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Lịch sử đơn hàng',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                  fontWeight: FontWeight.w800,
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
              ref.invalidate(providerOrderPageProvider);
              ref.invalidate(providerAssignmentsProvider);
            },
            icon: Icon(Icons.refresh_rounded, color: scheme.primary),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: AppSearchField(
              maxLength: 100,
              hintText: 'Tìm đơn hàng',
              onSubmitted: (value) => setState(() {
                search = value.trim();
                pageIndex = 1;
              }),
            ),
          ),
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
                      onSelected: () => setState(() {
                        filter = entry.key;
                        pageIndex = 1;
                      }),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () {
                ref.invalidate(providerAssignmentsProvider);
                return ref.refresh(providerOrderPageProvider(query).future);
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

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: selected,
      firstDate: DateTime(1),
      lastDate: DateTime(9999, 12, 31),
      helpText: 'Chọn ngày xem lịch hẹn',
      cancelText: 'Hủy',
      confirmText: 'Chọn',
    );
    if (date == null || !mounted) return;
    setState(() {
      selected = DateUtils.dateOnly(date);
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
        ? ref.watch(providerScheduleOrdersProvider)
        : AsyncData(PagedResult(items: previewOrders!, page: 1, totalPages: 1));
    final orders = state.asData?.value.items ?? <OrderSummary>[];
    // Chỉ ghi nhận các đơn đã tải và hiển thị trong ngày đang mở.
    viewedOrderIds.addAll(
      _ordersOnDay(orders, selected).map((order) => order.id),
    );
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 88 * MediaQuery.textScalerOf(context).scale(1),
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
                    style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    DateFormat('dd-MM-yyyy').format(DateTime.now()),
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
            child: Material(
              color: Colors.white,
              shape: const StadiumBorder(side: BorderSide(color: Colors.black)),
              clipBehavior: Clip.antiAlias,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Row(
                  children: [
                    IconButton(
                      tooltip: 'Tuần trước',
                      onPressed: () => _changeWeek(-7),
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _pickDate,
                        style: OutlinedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: Colors.black,
                          side: BorderSide.none,
                          shape: const StadiumBorder(),
                          minimumSize: const Size(48, 48),
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          textStyle: Theme.of(context).textTheme.titleMedium,
                        ),
                        child: Text(DateFormat('MM/yyyy').format(selected)),
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
                ref.invalidate(providerScheduleOrdersProvider);
                await ref.read(providerScheduleOrdersProvider.future);
              },
              child: state.when(
                loading: () => const AppLoading(),
                error: (error, _) => AppMessage(
                  message: _message(error),
                  onRetry: () => ref.invalidate(providerScheduleOrdersProvider),
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
                                fontWeight: FontWeight.w600,
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
                                            fontWeight: FontWeight.w600,
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
          fontSize: 13,
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
                              : scheme.surfaceContainer,
                          foregroundColor: isSelected
                              ? scheme.onPrimary
                              : scheme.onSurfaceVariant,
                          shape: const StadiumBorder(),
                        ),
                        onPressed: () => onSelected(day),
                        child: Column(
                          children: [
                            Text(
                              labels[day.weekday - 1],
                              style: const TextStyle(fontSize: 13),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              DateFormat('d/M').format(day),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
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
                                          fontSize: 11,
                                          fontWeight: FontWeight.w500,
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
  const _AppointmentCard({required this.order, this.isPreview = false});
  final OrderSummary order;
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
                          'HH:mm',
                        ).format(order.scheduledAt!.toLocal()),
                  style: const TextStyle(fontWeight: FontWeight.w600),
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
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            if (order.totalAmount != null) ...[
              const SizedBox(height: 6),
              Text(
                _money(order.totalAmount!),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w600,
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
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: CustomerPageHeader(
        toolbarHeight: 64 * MediaQuery.textScalerOf(context).scale(1),
        automaticallyImplyLeading: false,
        backgroundColor: accountSurface,
        title: 'Tài khoản & Cài đặt',
        titleColor: accountInk,
        actions: [
          IconButton(
            tooltip: 'Trợ giúp',
            onPressed: () => context.push('/provider/support'),
            icon: SvgPicture.asset(
              '$accountIconPath/app_help.svg',
              width: 22,
              height: 22,
            ),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
              children: [
                AccountProfileSummaryCard(
                  name: user?.fullName ?? 'Đối tác Handigo',
                  contact: user?.email ?? 'Chưa cập nhật email',
                  avatarUrl: user?.avatar,
                  onEdit: () => context.push('/provider/personal-info'),
                ),
                const SizedBox(height: 24),
                AccountSection(
                  title: 'Hồ sơ đối tác',
                  items: [
                    AccountMenuItem(
                      label: 'Xác thực tài khoản',
                      subtitle: 'Email, điện thoại và giấy tờ tùy thân',
                      iconAsset: '$accountIconPath/shield.svg',
                      onTap: () => context.push('/provider/verification'),
                    ),
                    AccountMenuItem(
                      label: 'Thông tin nghề nghiệp',
                      subtitle: 'Chuyên môn, dịch vụ và chứng chỉ',
                      iconAsset: '$accountIconPath/file.svg',
                      onTap: () => context.push('/provider/professional-info'),
                    ),
                    AccountMenuItem(
                      label: 'Đánh giá khách hàng',
                      subtitle: 'Theo dõi chất lượng dịch vụ của bạn',
                      iconAsset: '$accountIconPath/star.svg',
                      onTap: () => context.push('/provider/feedback'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                AccountSection(
                  title: 'Cài đặt ứng dụng',
                  items: [
                    AccountMenuItem(
                      label: 'Thông báo & nhắc lịch',
                      subtitle: 'Lịch hẹn, tin nhắn và cập nhật dịch vụ',
                      iconAsset: '$accountIconPath/bell.svg',
                      onTap: () => context.push('/provider/notifications'),
                    ),
                    AccountMenuItem(
                      label: 'Ngôn ngữ',
                      subtitle: 'Tiếng Việt',
                      iconAsset: '$accountIconPath/globe.svg',
                      comingSoon: true,
                    ),
                    AccountMenuItem(
                      label: 'Bảo mật & đăng nhập',
                      subtitle: 'Mật khẩu, Face ID và vân tay',
                      iconAsset: '$accountIconPath/shield.svg',
                      onTap: () => context.push('/provider/settings'),
                    ),
                    const AccountMenuItem(
                      label: 'Giao diện',
                      subtitle: 'Sáng · Theo cài đặt thiết bị',
                      iconAsset: '$accountIconPath/moon.svg',
                      comingSoon: true,
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                AccountSection(
                  title: 'Hỗ trợ & báo cáo',
                  items: [
                    AccountMenuItem(
                      label: 'Trung tâm hỗ trợ',
                      subtitle: 'Gửi và theo dõi yêu cầu hỗ trợ',
                      iconAsset: '$accountIconPath/help.svg',
                      onTap: () => context.push('/provider/support'),
                    ),
                    AccountMenuItem(
                      label: 'Báo cáo sự cố',
                      subtitle: 'Phản ánh vấn đề trong quá trình làm việc',
                      iconAsset: '$accountIconPath/chat.svg',
                      onTap: () => context.push('/provider/reports'),
                    ),
                    AccountMenuItem(
                      label: 'Đề xuất dịch vụ',
                      subtitle: 'Gửi ý tưởng dịch vụ mới cho Handigo',
                      iconAsset: '$accountIconPath/gift.svg',
                      onTap: () =>
                          context.push('/provider/service-suggestions'),
                    ),
                    AccountMenuItem(
                      label: 'Điều khoản & quyền riêng tư',
                      subtitle: 'Cách Handigo bảo vệ dữ liệu của bạn',
                      iconAsset: '$accountIconPath/file.svg',
                      onTap: () => context.push('/provider/settings'),
                    ),
                    AccountMenuItem(
                      label: 'Đánh giá Handigo',
                      subtitle: 'Chia sẻ trải nghiệm của bạn',
                      iconAsset: '$accountIconPath/star.svg',
                      onTap: () => context.push('/provider/app-feedback'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                AccountLogoutButton(
                  onPressed: () async {
                    final confirmed = await showAccountLogoutConfirmation(
                      context,
                      userName: user?.fullName ?? 'Đối tác Handigo',
                    );
                    if (confirmed) {
                      await ref.read(authControllerProvider).logout();
                    }
                  },
                ),
                const AccountVersionFooter(),
              ],
            ),
          ),
        ),
      ),
    );
  }
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
