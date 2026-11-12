import 'package:flutter/material.dart';

import '../../../shared/widgets/account_overview_widgets.dart';

const rescheduleVietnamOffset = Duration(hours: 7);

bool isAllowedRescheduleTime(DateTime value, DateTime earliest) {
  final local = value.toUtc().add(rescheduleVietnamOffset);
  return !value.isBefore(earliest) &&
      local.hour >= 8 &&
      (local.hour < 21 || (local.hour == 21 && local.minute == 0));
}

DateTime? firstAvailableRescheduleTime(DateTime day, DateTime earliest) {
  final start = DateTime.utc(
    day.year,
    day.month,
    day.day,
    8,
  ).subtract(rescheduleVietnamOffset);
  final end = start.add(const Duration(hours: 13));
  const minute = Duration.microsecondsPerMinute;
  final rounded = DateTime.fromMicrosecondsSinceEpoch(
    ((earliest.microsecondsSinceEpoch + minute - 1) ~/ minute) * minute,
    isUtc: true,
  );
  final first = rounded.isAfter(start) ? rounded : start;
  return first.isAfter(end) ? null : first;
}

class OrderRescheduleDateTimePicker extends StatelessWidget {
  const OrderRescheduleDateTimePicker({
    required this.value,
    required this.earliest,
    required this.onChanged,
    super.key,
  });

  final DateTime value, earliest;
  final ValueChanged<DateTime> onChanged;

  DateTime _time(DateTime day, int hour, int minute) => DateTime.utc(
    day.year,
    day.month,
    day.day,
    hour,
    minute,
  ).subtract(rescheduleVietnamOffset);

  @override
  Widget build(BuildContext context) {
    final local = value.toUtc().add(rescheduleVietnamOffset);
    final minimum = earliest.toUtc().add(rescheduleVietnamOffset);
    final theme = Theme.of(context);
    final hours = [
      for (var hour = 8; hour <= 21; hour++)
        if (isAllowedRescheduleTime(
          _time(local, hour, hour == 21 ? 0 : 59),
          earliest,
        ))
          hour,
    ];
    final selectedHour = hours.contains(local.hour)
        ? local.hour
        : hours.firstOrNull;
    final minutes = [
      if (selectedHour != null)
        for (var minute = 0; minute < 60; minute++)
          if (isAllowedRescheduleTime(
            _time(local, selectedHour, minute),
            earliest,
          ))
            minute,
    ];
    final calendar = Theme(
      data: theme.copyWith(
        colorScheme: theme.colorScheme.copyWith(
          primary: accountPrimary,
          onPrimary: Colors.white,
          surface: accountSurface,
        ),
      ),
      child: CalendarDatePicker(
        key: ValueKey((minimum.year, minimum.month, minimum.day)),
        initialDate: DateTime(local.year, local.month, local.day),
        firstDate:
            DateTime(
              minimum.year,
              minimum.month,
              minimum.day,
            ).isAfter(DateTime(local.year, local.month, local.day))
            ? DateTime(local.year, local.month, local.day)
            : DateTime(minimum.year, minimum.month, minimum.day),
        lastDate: DateTime(local.year + 100, 12, 31),
        currentDate: DateTime.now().toUtc().add(rescheduleVietnamOffset),
        selectableDayPredicate: (day) =>
            firstAvailableRescheduleTime(day, earliest) != null ||
            DateUtils.isSameDay(
              day,
              DateTime(local.year, local.month, local.day),
            ),
        onDateChanged: (day) {
          final candidate = _time(day, local.hour, local.minute);
          final next = isAllowedRescheduleTime(candidate, earliest)
              ? candidate
              : firstAvailableRescheduleTime(day, earliest);
          if (next != null) onChanged(next);
        },
      ),
    );
    final clock = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Giờ hẹn mới', style: theme.textTheme.titleSmall),
        const SizedBox(height: 4),
        Text(
          'Cuộn để chọn · Giờ Việt Nam',
          style: theme.textTheme.bodySmall?.copyWith(color: accountMuted),
        ),
        const SizedBox(height: 10),
        if (hours.isEmpty || minutes.isEmpty)
          const Text('Ngày này đã hết giờ nhận lịch. Vui lòng chọn ngày khác.')
        else
          Row(
            children: [
              Expanded(
                child: _TimeWheel(
                  label: 'Giờ',
                  values: hours,
                  value: selectedHour!,
                  onChanged: (hour) {
                    final candidate = _time(local, hour, local.minute);
                    final hourStart = _time(local, hour, 0);
                    final next = isAllowedRescheduleTime(candidate, earliest)
                        ? candidate
                        : firstAvailableRescheduleTime(
                            local,
                            hourStart.isAfter(earliest) ? hourStart : earliest,
                          );
                    if (next != null) onChanged(next);
                  },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _TimeWheel(
                  label: 'Phút',
                  values: minutes,
                  value: minutes.contains(local.minute)
                      ? local.minute
                      : minutes.first,
                  onChanged: (minute) =>
                      onChanged(_time(local, selectedHour, minute)),
                ),
              ),
            ],
          ),
        const SizedBox(height: 8),
        const Text(
          '08:00 – 21:00',
          textAlign: TextAlign.center,
          style: TextStyle(color: accountPrimary, fontWeight: FontWeight.w600),
        ),
      ],
    );
    return LayoutBuilder(
      builder: (context, constraints) =>
          constraints.maxWidth >= 560 &&
              MediaQuery.textScalerOf(context).scale(1) <= 1.3
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: calendar),
                const SizedBox(width: 16),
                Expanded(flex: 2, child: clock),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                calendar,
                const Divider(height: 24, color: accountDivider),
                clock,
              ],
            ),
    );
  }
}

class _TimeWheel extends StatefulWidget {
  const _TimeWheel({
    required this.label,
    required this.values,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final List<int> values;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  State<_TimeWheel> createState() => _TimeWheelState();
}

class _TimeWheelState extends State<_TimeWheel> {
  late final _controller = FixedExtentScrollController(
    initialItem: widget.values.indexOf(widget.value),
  );

  @override
  void didUpdateWidget(covariant _TimeWheel oldWidget) {
    super.didUpdateWidget(oldWidget);
    final index = widget.values.indexOf(widget.value);
    if (_controller.hasClients && _controller.selectedItem != index) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _controller.hasClients) {
          _controller.jumpToItem(widget.values.indexOf(widget.value));
        }
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(widget.label, style: Theme.of(context).textTheme.labelMedium),
      const SizedBox(height: 6),
      DecoratedBox(
        decoration: BoxDecoration(
          color: accountBackground,
          border: Border.all(color: accountDivider),
          borderRadius: BorderRadius.circular(14),
        ),
        child: SizedBox(
          height: 156,
          child: Stack(
            children: [
              Align(
                child: Container(
                  height: 44 * MediaQuery.textScalerOf(context).scale(1),
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: accountPrimarySoft,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: accountPrimary.withValues(alpha: .16),
                    ),
                  ),
                ),
              ),
              ListWheelScrollView.useDelegate(
                key: ValueKey('reschedule-${widget.label}'),
                controller: _controller,
                physics: const FixedExtentScrollPhysics(),
                itemExtent: 44 * MediaQuery.textScalerOf(context).scale(1),
                diameterRatio: 2.5,
                overAndUnderCenterOpacity: 1,
                onSelectedItemChanged: (index) {
                  if (index < widget.values.length) {
                    widget.onChanged(widget.values[index]);
                  }
                },
                childDelegate: ListWheelChildListDelegate(
                  children: [
                    for (final (index, value) in widget.values.indexed)
                      Semantics(
                        selected: value == widget.value,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _controller.animateToItem(
                            index,
                            duration: const Duration(milliseconds: 180),
                            curve: Curves.easeOutCubic,
                          ),
                          child: Center(
                            child: Text(
                              value.toString().padLeft(2, '0'),
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(
                                    fontSize: 20,
                                    color: value == widget.value
                                        ? accountPrimary
                                        : accountInk,
                                    fontWeight: value == widget.value
                                        ? FontWeight.w800
                                        : FontWeight.w500,
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
        ),
      ),
    ],
  );
}
