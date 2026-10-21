import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../booking/domain/booking_models.dart';
import '../../booking/presentation/booking_provider.dart';
import '../../booking/presentation/booking_provider_selector.dart';

final bookingScheduleClockProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

DateTime _nextMorning(DateTime now) =>
    DateTime(now.year, now.month, now.day + 1, 8);

class BookingScheduleButton extends ConsumerStatefulWidget {
  const BookingScheduleButton({super.key});

  @override
  ConsumerState<BookingScheduleButton> createState() =>
      _BookingScheduleButtonState();
}

class _BookingScheduleButtonState extends ConsumerState<BookingScheduleButton> {
  bool _pickerOpen = false;
  final _scheduleHelpKey = GlobalKey<TooltipState>();
  Timer? _clockTimer;

  @override
  void initState() {
    super.initState();
    _clockTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    super.dispose();
  }

  void _ensureDefaultSchedule() {
    if (!mounted) return;
    final now = ref.read(bookingScheduleClockProvider)();
    final draft = ref.read(bookingDraftProvider);
    if (!isImmediateBookingAvailable(now) &&
        draft.type == BookingType.normal &&
        draft.scheduledAt == null) {
      ref.read(bookingDraftProvider.notifier).setScheduledAt(_nextMorning(now));
    }
  }

  void _resetSchedule() {
    final now = ref.read(bookingScheduleClockProvider)();
    final controller = ref.read(bookingDraftProvider.notifier);
    if (isImmediateBookingAvailable(now)) {
      controller.clearSchedule();
    } else {
      controller.setScheduledAt(_nextMorning(now));
    }
  }

  Future<void> _openPicker() async {
    if (_pickerOpen) return;
    setState(() => _pickerOpen = true);
    try {
      await showDialog<void>(
        context: context,
        builder: (_) => const BookingScheduleSelector(),
      );
    } finally {
      if (mounted) setState(() => _pickerOpen = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = ref.watch(bookingDraftProvider).scheduledAt;
    final now = ref.watch(bookingScheduleClockProvider)();
    final immediateAvailable = isImmediateBookingAvailable(now);
    if (!immediateAvailable && selected == null) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _ensureDefaultSchedule(),
      );
    }
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Flexible(
              child: Text(
                immediateAvailable
                    ? 'Nếu không chọn ngày giờ, đơn sẽ được tính là đặt ngay'
                    : 'Đã ngoài khung giờ làm việc, đơn của bạn sẽ được xử lý vào ngày mai.',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  height: 1.3,
                ),
              ),
            ),
            Tooltip(
              key: _scheduleHelpKey,
              triggerMode: TooltipTriggerMode.manual,
              showDuration: const Duration(seconds: 12),
              preferBelow: true,
              constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width - 48,
              ),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: theme.colorScheme.inverseSurface,
                borderRadius: BorderRadius.circular(12),
              ),
              textStyle: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onInverseSurface,
                height: 1.5,
              ),
              message: immediateAvailable
                  ? 'Đặt ngay: đơn được gửi để tìm thợ sau khi bạn xác nhận đặt đơn. '
                        'Nếu muốn thực hiện vào thời điểm khác, bấm “Hẹn lịch”, chọn ngày giờ và xác nhận. '
                        'Bạn có thể bấm dấu × trong nút hẹn lịch để bỏ thời gian đã chọn.'
                  : 'Đặt ngay chỉ khả dụng từ 08:00 đến 21:00. '
                        'Ngoài khung giờ này, lịch mặc định là 08:00 ngày mai. '
                        'Bạn có thể bấm “Hẹn lịch” để chọn thời gian khác. '
                        'Dấu × sẽ đưa lịch về 08:00 ngày mai.',
              child: IconButton(
                onPressed: () =>
                    _scheduleHelpKey.currentState?.ensureTooltipVisible(),
                icon: const Icon(Icons.error_outline_rounded, size: 18),
                color: theme.colorScheme.primary,
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                style: IconButton.styleFrom(
                  padding: const EdgeInsets.all(4),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        SizedBox(
          width: double.infinity,
          child: Stack(
            fit: StackFit.passthrough,
            children: [
              OutlinedButton.icon(
                icon: const Icon(Icons.calendar_month_outlined, size: 20),
                label: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    selected == null
                        ? 'Hẹn lịch'
                        : 'Hẹn lịch · ${DateFormat('dd/MM/yyyy · HH:mm').format(selected)}',
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 48),
                  padding: selected != null
                      ? const EdgeInsets.only(left: 12, right: 52)
                      : null,
                  backgroundColor: selected != null || _pickerOpen
                      ? theme.colorScheme.primary
                      : null,
                  foregroundColor: selected != null || _pickerOpen
                      ? theme.colorScheme.onPrimary
                      : null,
                ),
                onPressed: _openPicker,
              ),
              if (selected != null)
                Positioned(
                  top: 0,
                  bottom: 0,
                  right: 2,
                  child: IconButton(
                    tooltip: 'Xóa lịch hẹn',
                    color: theme.colorScheme.onPrimary,
                    onPressed: _resetSchedule,
                    icon: const Icon(Icons.close, size: 20),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class BookingScheduleSelector extends ConsumerStatefulWidget {
  const BookingScheduleSelector({super.key});

  @override
  ConsumerState<BookingScheduleSelector> createState() =>
      _BookingScheduleSelectorState();
}

class _BookingScheduleSelectorState
    extends ConsumerState<BookingScheduleSelector> {
  late final DateTime _today;
  late final int _dayCount;
  late int _dayIndex;
  late int _hour;
  late int _minute;
  late final FixedExtentScrollController _days;
  late final FixedExtentScrollController _hours;
  late final FixedExtentScrollController _minutes;
  String? _confirmationError;

  @override
  void initState() {
    super.initState();
    final now = ref.read(bookingScheduleClockProvider)();
    _today = DateUtils.dateOnly(now);
    final lastDate = DateTime(_today.year + 1, _today.month, _today.day);
    _dayCount = lastDate.difference(_today).inDays + 1;
    var initial = ref.read(bookingDraftProvider).scheduledAt;
    final currentMinute = DateTime(
      now.year,
      now.month,
      now.day,
      now.hour,
      now.minute,
    );
    if (initial == null ||
        initial.isBefore(currentMinute) ||
        initial.hour < 8 ||
        initial.hour > 21 ||
        (initial.hour == 21 && initial.minute > 0)) {
      initial = isImmediateBookingAvailable(now)
          ? currentMinute
          : _nextMorning(now);
    }
    _dayIndex = DateUtils.dateOnly(
      initial,
    ).difference(_today).inDays.clamp(0, _dayCount - 1);
    _hour = initial.hour;
    _minute = initial.minute;
    _days = FixedExtentScrollController(initialItem: _dayIndex);
    _hours = FixedExtentScrollController(initialItem: _hour - 8);
    _minutes = FixedExtentScrollController(initialItem: _minute);
  }

  @override
  void dispose() {
    _days.dispose();
    _hours.dispose();
    _minutes.dispose();
    super.dispose();
  }

  DateTime _date(int index) =>
      DateTime(_today.year, _today.month, _today.day + index);

  DateTime _chosen({int? day, int? hour, int? minute}) {
    final date = _date(day ?? _dayIndex);
    return DateTime(
      date.year,
      date.month,
      date.day,
      hour ?? _hour,
      minute ?? _minute,
    );
  }

  String? _validate(DateTime chosen) {
    if (chosen.hour == 21 && chosen.minute > 0) {
      return 'Giờ thực hiện không được sau 21:00.';
    }
    final now = ref.read(bookingScheduleClockProvider)();
    if (chosen.isBefore(
      DateTime(now.year, now.month, now.day, now.hour, now.minute),
    )) {
      return 'Vui lòng chọn thời gian từ phút hiện tại trở đi.';
    }
    return null;
  }

  String _dateLabel(int index) {
    final date = _date(index);
    final day = index == 0
        ? 'Hôm nay'
        : index == 1
        ? 'Ngày mai'
        : date.weekday == DateTime.sunday
        ? 'Chủ nhật'
        : 'Thứ ${date.weekday + 1}';
    return '$day ${DateFormat('dd/MM').format(date)}';
  }

  Widget _wheel({
    required String label,
    required FixedExtentScrollController controller,
    required int count,
    required int selected,
    required String Function(int) format,
    required ValueChanged<int> onChanged,
    required bool Function(int) unavailable,
    int flex = 1,
  }) {
    final theme = Theme.of(context);
    return Expanded(
      flex: flex,
      child: Column(
        children: [
          Text(label, style: theme.textTheme.labelLarge),
          const SizedBox(height: 8),
          SizedBox(
            height: 192,
            child: Stack(
              children: [
                Center(
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary.withValues(alpha: .10),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.symmetric(
                        horizontal: BorderSide(
                          color: theme.colorScheme.primary.withValues(
                            alpha: .25,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Semantics(
                  label: label,
                  child: ListWheelScrollView.useDelegate(
                    key: ValueKey('schedule-$label'),
                    controller: controller,
                    itemExtent: 48,
                    physics: const FixedExtentScrollPhysics(),
                    diameterRatio: 1.6,
                    overAndUnderCenterOpacity: .55,
                    onSelectedItemChanged: onChanged,
                    childDelegate: ListWheelChildBuilderDelegate(
                      childCount: count,
                      builder: (_, index) => GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => controller.animateToItem(
                          index,
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOut,
                        ),
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                format(index),
                                style: theme.textTheme.titleMedium?.copyWith(
                                  fontWeight: selected == index
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                  color: unavailable(index)
                                      ? theme.colorScheme.onSurface.withValues(
                                          alpha: .3,
                                        )
                                      : selected == index
                                      ? theme.colorScheme.primary
                                      : theme.colorScheme.onSurfaceVariant,
                                ),
                              ),
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
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final error = _confirmationError ?? _validate(_chosen());
    return AlertDialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      contentPadding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      scrollable: true,
      title: Row(
        children: [
          Expanded(
            child: Text(
              'Chọn ngày và giờ hẹn',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          IconButton(
            tooltip: 'Đóng',
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close),
          ),
        ],
      ),
      content: SizedBox(
        width: 400,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _wheel(
                      label: 'Ngày',
                      flex: 2,
                      controller: _days,
                      count: _dayCount,
                      selected: _dayIndex,
                      format: _dateLabel,
                      unavailable: (index) =>
                          _validate(_chosen(day: index, hour: 21, minute: 0)) !=
                          null,
                      onChanged: (index) => setState(() {
                        _dayIndex = index;
                        _confirmationError = null;
                      }),
                    ),
                    const SizedBox(width: 6),
                    _wheel(
                      label: 'Giờ',
                      controller: _hours,
                      count: 14,
                      selected: _hour - 8,
                      format: (index) => '${index + 8}'.padLeft(2, '0'),
                      unavailable: (index) =>
                          _validate(
                            _chosen(
                              hour: index + 8,
                              minute: index == 13 ? 0 : 59,
                            ),
                          ) !=
                          null,
                      onChanged: (index) => setState(() {
                        _hour = index + 8;
                        _confirmationError = null;
                        if (_hour == 21 && _minute > 0) {
                          _minute = 0;
                          _minutes.jumpToItem(0);
                        }
                      }),
                    ),
                    const SizedBox(width: 6),
                    _wheel(
                      label: 'Phút',
                      controller: _minutes,
                      count: 60,
                      selected: _minute,
                      format: (index) => '$index'.padLeft(2, '0'),
                      unavailable: (index) =>
                          _validate(_chosen(minute: index)) != null,
                      onChanged: (index) => setState(() {
                        _minute = index;
                        _confirmationError = null;
                      }),
                    ),
                  ],
                ),
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 8),
              Text(
                error,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        FilledButton(
          onPressed: error != null
              ? null
              : () {
                  final chosen = _chosen();
                  final latestError = _validate(chosen);
                  if (latestError != null) {
                    setState(() => _confirmationError = latestError);
                    return;
                  }
                  ref
                      .read(bookingDraftProvider.notifier)
                      .setScheduledAt(chosen);
                  Navigator.pop(context);
                },
          child: const Text('Xác nhận'),
        ),
      ],
    );
  }
}
