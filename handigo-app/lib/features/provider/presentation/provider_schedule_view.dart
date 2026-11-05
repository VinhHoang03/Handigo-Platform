import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/paged_result.dart';
import '../../../shared/widgets/app_states.dart';
import '../../chat/presentation/order_chat_button.dart';
import '../../orders/domain/order_summary.dart';

enum ProviderScheduleMode { month, week }

class ProviderScheduleView extends StatefulWidget {
  const ProviderScheduleView({
    required this.state,
    required this.onRefresh,
    required this.onRetry,
    this.isActive = true,
    this.isPreview = false,
    super.key,
  });

  final AsyncValue<PagedResult<OrderSummary>> state;
  final Future<void> Function() onRefresh;
  final VoidCallback onRetry;
  final bool isActive;
  final bool isPreview;

  @override
  State<ProviderScheduleView> createState() => _ProviderScheduleViewState();
}

class _ProviderScheduleViewState extends State<ProviderScheduleView> {
  ProviderScheduleMode mode = ProviderScheduleMode.month;
  DateTime selected = DateUtils.dateOnly(DateTime.now());
  late DateTime visibleMonth = DateTime(selected.year, selected.month);
  final GlobalKey _dayScheduleKey = GlobalKey();

  DateTime get weekStart =>
      selected.subtract(Duration(days: selected.weekday - DateTime.monday));

  @override
  void didUpdateWidget(covariant ProviderScheduleView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) _goToday();
  }

  void _goToday() {
    final today = DateUtils.dateOnly(DateTime.now());
    setState(() {
      selected = today;
      visibleMonth = DateTime(today.year, today.month);
    });
  }

  void _select(DateTime value) {
    final day = DateUtils.dateOnly(value);
    setState(() {
      selected = day;
      visibleMonth = DateTime(day.year, day.month);
    });
  }

  void _selectAndReveal(DateTime value) {
    _select(value);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final targetContext = _dayScheduleKey.currentContext;
      if (!mounted || targetContext == null) return;
      Scrollable.ensureVisible(
        targetContext,
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
        alignment: .08,
      );
    });
  }

  void _moveMonth(int offset) {
    final next = DateTime(visibleMonth.year, visibleMonth.month + offset);
    setState(() {
      visibleMonth = next;
      selected = next;
    });
  }

  void _moveWeek(int offset) =>
      _select(weekStart.add(Duration(days: offset * 7)));

  void _openOptions() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Tùy chọn lịch',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              ListTile(
                minTileHeight: 48,
                leading: const Icon(Icons.calendar_view_month_outlined),
                title: const Text('Xem theo tháng'),
                trailing: mode == ProviderScheduleMode.month
                    ? const Icon(Icons.check_rounded)
                    : null,
                onTap: () {
                  Navigator.pop(sheetContext);
                  setState(() => mode = ProviderScheduleMode.month);
                },
              ),
              ListTile(
                minTileHeight: 48,
                leading: const Icon(Icons.view_week_outlined),
                title: const Text('Xem theo tuần'),
                trailing: mode == ProviderScheduleMode.week
                    ? const Icon(Icons.check_rounded)
                    : null,
                onTap: () {
                  Navigator.pop(sheetContext);
                  setState(() => mode = ProviderScheduleMode.week);
                },
              ),
              ListTile(
                minTileHeight: 48,
                leading: const Icon(Icons.today_outlined),
                title: const Text('Về hôm nay'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _goToday();
                },
              ),
              const Divider(),
              const _StatusLegend(),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        centerTitle: true,
        title: const Text('Lịch làm việc'),
        leading: Padding(
          padding: const EdgeInsets.all(10),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.calendar_month_rounded,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Tùy chọn lịch',
            onPressed: _openOptions,
            icon: const Icon(Icons.tune_rounded),
          ),
        ],
      ),
      body: widget.state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: 'Không thể tải lịch làm việc.',
          onRetry: widget.onRetry,
        ),
        data: (page) {
          final orders = page.items;
          final selectedOrders = _ordersOnDay(orders, selected);
          final periodOrders = mode == ProviderScheduleMode.month
              ? orders.where((order) {
                  final date = order.calendarAt?.toLocal();
                  return date != null &&
                      date.year == visibleMonth.year &&
                      date.month == visibleMonth.month;
                }).toList()
              : orders.where((order) {
                  final date = order.calendarAt?.toLocal();
                  if (date == null) return false;
                  final end = weekStart.add(const Duration(days: 7));
                  return !date.isBefore(weekStart) && date.isBefore(end);
                }).toList();
          return RefreshIndicator(
            onRefresh: widget.onRefresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                  sliver: SliverList.list(
                    children: [
                      if (widget.isPreview) ...[
                        Text(
                          'Dữ liệu xem thử • Tự xóa khi mở lại app hoặc hot restart',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Theme.of(context).colorScheme.secondary,
                              ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      Text(
                        'Tháng ${visibleMonth.month}, ${visibleMonth.year}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _ScheduleStats(orders: periodOrders),
                      const SizedBox(height: 12),
                      _ScheduleModeSwitch(
                        value: mode,
                        onChanged: (value) => setState(() => mode = value),
                      ),
                      const SizedBox(height: 10),
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 220),
                        child: mode == ProviderScheduleMode.month
                            ? _MonthCalendar(
                                key: const ValueKey('month-calendar'),
                                month: visibleMonth,
                                selected: selected,
                                orders: orders,
                                onSelected: _selectAndReveal,
                                onPrevious: () => _moveMonth(-1),
                                onNext: () => _moveMonth(1),
                                onToday: _goToday,
                              )
                            : _WeekCalendar(
                                key: const ValueKey('week-calendar'),
                                start: weekStart,
                                selected: selected,
                                orders: orders,
                                onSelected: _selectAndReveal,
                                onPrevious: () => _moveWeek(-1),
                                onNext: () => _moveWeek(1),
                                onToday: _goToday,
                              ),
                      ),
                      const SizedBox(height: 16),
                      KeyedSubtree(
                        key: _dayScheduleKey,
                        child: _DayScheduleHeader(
                          date: selected,
                          orders: selectedOrders,
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (selectedOrders.isEmpty)
                        const _EmptySchedule()
                      else
                        for (final order in selectedOrders) ...[
                          _ScheduleOrderCard(
                            order: order,
                            isPreview: widget.isPreview,
                          ),
                          const SizedBox(height: 10),
                        ],
                    ],
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

class _ScheduleStats extends StatelessWidget {
  const _ScheduleStats({required this.orders});

  final List<OrderSummary> orders;

  @override
  Widget build(BuildContext context) {
    final confirmed = orders
        .where((order) => ['accepted', 'in_progress'].contains(order.status))
        .length;
    final pending = orders.where((order) => order.status == 'created').length;
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - 16) / 3;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _ScheduleStat(
              width: width,
              value: '${orders.length}',
              label: 'Tổng công việc',
              color: Theme.of(context).colorScheme.onSurface,
            ),
            const SizedBox(width: 8),
            _ScheduleStat(
              width: width,
              value: '$confirmed',
              label: 'Đã xác nhận',
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 8),
            _ScheduleStat(
              width: width,
              value: '$pending',
              label: 'Chờ xác nhận',
              color: const Color(0xFFC76B13),
            ),
          ],
        );
      },
    );
  }
}

class _ScheduleStat extends StatelessWidget {
  const _ScheduleStat({
    required this.width,
    required this.value,
    required this.label,
    required this.color,
  });

  final double width;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: color,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          maxLines: 2,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    ),
  );
}

class _ScheduleModeSwitch extends StatelessWidget {
  const _ScheduleModeSwitch({required this.value, required this.onChanged});

  final ProviderScheduleMode value;
  final ValueChanged<ProviderScheduleMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: scheme.primaryContainer.withValues(alpha: .5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          for (final entry in const [
            (ProviderScheduleMode.month, 'Tháng'),
            (ProviderScheduleMode.week, 'Tuần'),
          ])
            Expanded(
              child: Semantics(
                selected: value == entry.$1,
                button: true,
                child: InkWell(
                  borderRadius: BorderRadius.circular(9),
                  onTap: () => onChanged(entry.$1),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    constraints: const BoxConstraints(minHeight: 44),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: value == entry.$1
                          ? scheme.surfaceContainerLowest
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(9),
                      boxShadow: value == entry.$1
                          ? [
                              BoxShadow(
                                color: scheme.shadow.withValues(alpha: .08),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Text(
                      entry.$2,
                      style: TextStyle(
                        color: value == entry.$1
                            ? scheme.primary
                            : scheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MonthCalendar extends StatelessWidget {
  const _MonthCalendar({
    required this.month,
    required this.selected,
    required this.orders,
    required this.onSelected,
    required this.onPrevious,
    required this.onNext,
    required this.onToday,
    super.key,
  });

  final DateTime month;
  final DateTime selected;
  final List<OrderSummary> orders;
  final ValueChanged<DateTime> onSelected;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onToday;

  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month);
    final start = first.subtract(Duration(days: first.weekday - 1));
    final last = DateTime(month.year, month.month + 1, 0);
    final end = last.add(Duration(days: 7 - last.weekday));
    final dayCount = end.difference(start).inDays + 1;
    return _CalendarCard(
      title: 'Tháng ${month.month}, ${month.year}',
      subtitle: 'Chọn ngày để xem công việc',
      onPrevious: onPrevious,
      onNext: onNext,
      onToday: onToday,
      child: Column(
        children: [
          const _WeekdayHeader(),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: dayCount,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              mainAxisExtent: 58,
            ),
            itemBuilder: (context, index) {
              final day = start.add(Duration(days: index));
              return _CalendarDay(
                day: day,
                selected: DateUtils.isSameDay(day, selected),
                outside: day.month != month.month,
                orders: _ordersOnDay(orders, day),
                onTap: () => onSelected(day),
              );
            },
          ),
          const SizedBox(height: 8),
          const _StatusLegend(),
        ],
      ),
    );
  }
}

class _WeekCalendar extends StatelessWidget {
  const _WeekCalendar({
    required this.start,
    required this.selected,
    required this.orders,
    required this.onSelected,
    required this.onPrevious,
    required this.onNext,
    required this.onToday,
    super.key,
  });

  final DateTime start;
  final DateTime selected;
  final List<OrderSummary> orders;
  final ValueChanged<DateTime> onSelected;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onToday;

  @override
  Widget build(BuildContext context) {
    final end = start.add(const Duration(days: 6));
    final weekOrders = orders.where((order) {
      final date = order.calendarAt?.toLocal();
      return date != null &&
          !date.isBefore(start) &&
          date.isBefore(end.add(const Duration(days: 1)));
    }).length;
    return _CalendarCard(
      title: '${start.day} – ${end.day} tháng ${end.month}',
      subtitle: 'Tuần ${_isoWeek(start)} • $weekOrders công việc',
      onPrevious: onPrevious,
      onNext: onNext,
      onToday: onToday,
      child: Column(
        children: [
          const _WeekdayHeader(),
          Row(
            children: [
              for (var index = 0; index < 7; index++)
                Expanded(
                  child: _CalendarDay(
                    day: start.add(Duration(days: index)),
                    selected: DateUtils.isSameDay(
                      start.add(Duration(days: index)),
                      selected,
                    ),
                    orders: _ordersOnDay(
                      orders,
                      start.add(Duration(days: index)),
                    ),
                    onTap: () => onSelected(start.add(Duration(days: index))),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          const _StatusLegend(),
        ],
      ),
    );
  }
}

class _CalendarCard extends StatelessWidget {
  const _CalendarCard({
    required this.title,
    required this.subtitle,
    required this.onPrevious,
    required this.onNext,
    required this.onToday,
    required this.child,
  });

  final String title;
  final String subtitle;
  final VoidCallback onPrevious;
  final VoidCallback onNext;
  final VoidCallback onToday;
  final Widget child;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    elevation: 0,
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              IconButton(
                tooltip: 'Kỳ trước',
                onPressed: onPrevious,
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              IconButton(
                tooltip: 'Kỳ sau',
                onPressed: onNext,
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
          Row(
            children: [
              Expanded(
                child: Text(
                  subtitle,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
              TextButton(onPressed: onToday, child: const Text('Hôm nay')),
            ],
          ),
          child,
        ],
      ),
    ),
  );
}

class _WeekdayHeader extends StatelessWidget {
  const _WeekdayHeader();

  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (final label in ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              label,
              textAlign: TextAlign.center,
              textScaler: TextScaler.noScaling,
              style: const TextStyle(fontSize: 11),
            ),
          ),
        ),
    ],
  );
}

class _CalendarDay extends StatelessWidget {
  const _CalendarDay({
    required this.day,
    required this.selected,
    required this.orders,
    required this.onTap,
    this.outside = false,
  });

  final DateTime day;
  final bool selected;
  final bool outside;
  final List<OrderSummary> orders;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final today = DateUtils.isSameDay(day, DateTime.now());
    final revenue = orders
        .where((order) => order.status != 'cancelled')
        .fold<double>(0, (total, order) => total + (order.providerAmount ?? 0));
    return Semantics(
      button: true,
      selected: selected,
      label:
          '${day.day}/${day.month}, ${orders.length} công việc${revenue > 0 ? ', thu nhập ${_money(revenue)}' : ''}',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          key: ValueKey('schedule-day-${DateFormat('yyyy-MM-dd').format(day)}'),
          duration: const Duration(milliseconds: 160),
          constraints: const BoxConstraints(minHeight: 58),
          margin: const EdgeInsets.all(2),
          padding: const EdgeInsets.symmetric(vertical: 2),
          decoration: BoxDecoration(
            color: selected ? scheme.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: today && !selected
                ? Border.all(color: scheme.primary.withValues(alpha: .45))
                : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${day.day}',
                textScaler: TextScaler.noScaling,
                style: TextStyle(
                  color: selected
                      ? scheme.onPrimary
                      : outside
                      ? scheme.outlineVariant
                      : scheme.onSurface,
                  fontWeight: selected || today
                      ? FontWeight.w700
                      : FontWeight.w500,
                  fontSize: 13,
                  height: 1,
                ),
              ),
              const SizedBox(height: 3),
              SizedBox(
                height: 4,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final (index, order) in orders.take(3).indexed) ...[
                      Container(
                        key: index == 0
                            ? ValueKey(
                                'schedule-dot-${DateFormat('yyyy-MM-dd').format(day)}',
                              )
                            : null,
                        width: 4,
                        height: 4,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: selected
                              ? scheme.onPrimary
                              : _statusColor(order.status),
                        ),
                      ),
                      const SizedBox(width: 2),
                    ],
                  ],
                ),
              ),
              if (revenue > 0) ...[
                const SizedBox(height: 2),
                Text(
                  _compactRevenue(revenue),
                  maxLines: 1,
                  overflow: TextOverflow.fade,
                  softWrap: false,
                  textScaler: TextScaler.noScaling,
                  style: TextStyle(
                    color: selected
                        ? scheme.onPrimary
                        : const Color(0xFFB05A00),
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                    height: 1,
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

class _StatusLegend extends StatelessWidget {
  const _StatusLegend();

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 10,
    runSpacing: 6,
    children: const [
      _LegendItem(label: 'Đã xác nhận', color: Color(0xFF4C35E8)),
      _LegendItem(label: 'Chờ xác nhận', color: Color(0xFFC76B13)),
      _LegendItem(label: 'Hoàn thành', color: Color(0xFF198754)),
      _LegendItem(label: 'Đã hủy', color: Color(0xFF8B8B98)),
    ],
  );
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 4),
      Text(label, style: Theme.of(context).textTheme.labelSmall),
    ],
  );
}

class _DayScheduleHeader extends StatelessWidget {
  const _DayScheduleHeader({required this.date, required this.orders});
  final DateTime date;
  final List<OrderSummary> orders;

  @override
  Widget build(BuildContext context) {
    final confirmed = orders
        .where((order) => ['accepted', 'in_progress'].contains(order.status))
        .length;
    final pending = orders.where((order) => order.status == 'created').length;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Lịch ngày ${date.day}/${date.month}',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                '${_weekday(date.weekday)} • $confirmed đã xác nhận${pending > 0 ? ', $pending chờ xác nhận' : ''}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        Text(
          '${orders.length} công việc',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _ScheduleOrderCard extends StatelessWidget {
  const _ScheduleOrderCard({required this.order, required this.isPreview});

  final OrderSummary order;
  final bool isPreview;

  @override
  Widget build(BuildContext context) {
    final start = order.calendarAt?.toLocal();
    final end =
        order.expectedEndAt?.toLocal() ??
        (start != null && order.durationMinutes != null
            ? start.add(Duration(minutes: order.durationMinutes!))
            : null);
    final amount = order.providerAmount;
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                start == null
                    ? 'Chưa chọn thời gian'
                    : '${DateFormat('HH:mm').format(start)}${end == null ? '' : ' – ${DateFormat('HH:mm').format(end)}'}',
                style: TextStyle(
                  color: scheme.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (order.durationMinutes != null)
              Text(
                '${order.durationMinutes} phút',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        Card(
          margin: EdgeInsets.zero,
          elevation: 0,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '#${order.code}',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                    _ScheduleStatus(status: order.status),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  order.serviceName,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                if (order.customerName?.isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  _ScheduleMeta(
                    icon: Icons.person_outline_rounded,
                    text: order.customerName!,
                  ),
                ],
                if (order.addressLabel?.isNotEmpty == true) ...[
                  const SizedBox(height: 5),
                  _ScheduleMeta(
                    icon: Icons.location_on_outlined,
                    text: order.addressLabel!,
                  ),
                ],
                if (order.problemDescription?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  Text(
                    order.problemDescription!.trim(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                const SizedBox(height: 12),
                Divider(color: scheme.outlineVariant.withValues(alpha: .45)),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        amount != null
                            ? _money(amount)
                            : order.inspectionRequired
                            ? 'Chưa báo giá'
                            : _money(0),
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: isPreview
                          ? null
                          : () => context.push('/provider/orders/${order.id}'),
                      child: const Text('Xem chi tiết'),
                    ),
                    const SizedBox(width: 4),
                    SizedBox.square(
                      dimension: 44,
                      child: OrderChatButton(
                        orderId: order.id,
                        status: order.status,
                        hasProvider: true,
                        providerView: true,
                        iconOnly: true,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ScheduleStatus extends StatelessWidget {
  const _ScheduleStatus({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          _statusLabel(status),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: color,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _ScheduleMeta extends StatelessWidget {
  const _ScheduleMeta({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 6),
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

class _EmptySchedule extends StatelessWidget {
  const _EmptySchedule();

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    elevation: 0,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      child: Column(
        children: [
          Icon(
            Icons.event_available_outlined,
            size: 38,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 10),
          const Text(
            'Chưa có công việc',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'Ngày này chưa có lịch hẹn.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    ),
  );
}

List<OrderSummary> _ordersOnDay(List<OrderSummary> orders, DateTime day) =>
    orders.where((order) {
      final date = order.calendarAt?.toLocal();
      return date != null && DateUtils.isSameDay(date, day);
    }).toList()..sort((a, b) => a.calendarAt!.compareTo(b.calendarAt!));

Color _statusColor(String status) => switch (status) {
  'created' => const Color(0xFFC76B13),
  'completed' => const Color(0xFF198754),
  'cancelled' => const Color(0xFF8B8B98),
  _ => const Color(0xFF4C35E8),
};

String _statusLabel(String status) => switch (status) {
  'created' => 'Chờ xác nhận',
  'accepted' => 'Đã xác nhận',
  'in_progress' => 'Đang thực hiện',
  'completed' => 'Hoàn thành',
  'cancelled' => 'Đã hủy',
  _ => status,
};

String _weekday(int weekday) => const [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ Nhật',
][weekday - 1];

int _isoWeek(DateTime date) {
  final thursday = date.add(Duration(days: 4 - date.weekday));
  final yearStart = DateTime(thursday.year);
  return ((thursday.difference(yearStart).inDays + 1) / 7).ceil();
}

String _compactRevenue(double value) {
  if (value >= 1000000) {
    final amount = value / 1000000;
    return '+${amount == amount.roundToDouble() ? amount.toInt() : amount.toStringAsFixed(1)}tr';
  }
  if (value >= 1000) return '+${(value / 1000).round()}k';
  return '+${value.round()}đ';
}

String _money(double value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);
