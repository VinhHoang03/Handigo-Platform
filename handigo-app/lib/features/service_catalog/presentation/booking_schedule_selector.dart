import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../booking/presentation/booking_provider.dart';
import '../../../shared/widgets/app_feedback.dart';

class BookingScheduleSelector extends ConsumerWidget {
  const BookingScheduleSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(bookingDraftProvider).scheduledAt;
    final controller = ref.read(bookingDraftProvider.notifier);
    final theme = Theme.of(context);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    void selectDate(DateTime date) => controller.setScheduledAt(
      DateTime(
        date.year,
        date.month,
        date.day,
        selected?.hour ?? 9,
        selected?.minute ?? 0,
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Chọn ngày thực hiện', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            icon: const Icon(Icons.calendar_month_outlined, size: 20),
            label: Text(
              selected == null
                  ? 'Chọn ngày bất kỳ'
                  : DateFormat('dd/MM/yyyy').format(selected),
            ),
            onPressed: () async {
              final date = await showDatePicker(
                context: context,
                firstDate: today,
                lastDate: DateTime(today.year + 1, today.month, today.day),
                initialDate: selected != null && !selected.isBefore(today)
                    ? selected
                    : today,
                helpText: 'Chọn ngày thực hiện',
                cancelText: 'Hủy',
                confirmText: 'Xác nhận',
                builder: (context, child) => Theme(
                  data: theme.copyWith(
                    datePickerTheme: theme.datePickerTheme.copyWith(
                      backgroundColor: theme.colorScheme.surface,
                      surfaceTintColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      headerBackgroundColor:
                          theme.colorScheme.surfaceContainerLow,
                      headerForegroundColor: theme.colorScheme.onSurface,
                      headerHeadlineStyle: theme.textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w700),
                      dayBackgroundColor: WidgetStateProperty.resolveWith(
                        (states) => states.contains(WidgetState.selected)
                            ? theme.colorScheme.primary
                            : Colors.transparent,
                      ),
                      dayForegroundColor: WidgetStateProperty.resolveWith(
                        (states) => states.contains(WidgetState.selected)
                            ? Colors.white
                            : states.contains(WidgetState.disabled)
                            ? theme.colorScheme.onSurface.withValues(alpha: .35)
                            : theme.colorScheme.onSurface,
                      ),
                      yearBackgroundColor: WidgetStateProperty.resolveWith(
                        (states) => states.contains(WidgetState.selected)
                            ? theme.colorScheme.primary
                            : Colors.transparent,
                      ),
                      yearForegroundColor: WidgetStateProperty.resolveWith(
                        (states) => states.contains(WidgetState.selected)
                            ? Colors.white
                            : theme.colorScheme.onSurface,
                      ),
                      todayForegroundColor: WidgetStateProperty.resolveWith(
                        (states) => states.contains(WidgetState.selected)
                            ? Colors.white
                            : theme.colorScheme.primary,
                      ),
                      confirmButtonStyle: TextButton.styleFrom(
                        backgroundColor: theme.colorScheme.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(100, 44),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      cancelButtonStyle: TextButton.styleFrom(
                        foregroundColor: theme.colorScheme.primary,
                      ),
                    ),
                  ),
                  child: child!,
                ),
              );
              if (date != null && context.mounted) selectDate(date);
            },
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Hoặc chọn nhanh trong 5 ngày tới',
          style: theme.textTheme.labelMedium,
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            for (var index = 0; index < 5; index++) ...[
              if (index > 0) const SizedBox(width: 4),
              Expanded(
                child: _QuickDate(
                  date: DateTime(today.year, today.month, today.day + index),
                  selected: selected,
                  onSelected: selectDate,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),
        Text('Chọn giờ thực hiện', style: theme.textTheme.titleSmall),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            icon: const Icon(Icons.access_time_rounded, size: 20),
            label: Text(
              selected == null
                  ? 'Chọn ngày trước khi chọn giờ'
                  : DateFormat('HH:mm').format(selected),
            ),
            onPressed: selected == null
                ? null
                : () async {
                    final time = await showDialog<TimeOfDay>(
                      context: context,
                      builder: (_) => _BookingTimePicker(date: selected),
                    );
                    if (time != null && context.mounted) {
                      controller.setScheduledAt(
                        DateTime(
                          selected.year,
                          selected.month,
                          selected.day,
                          time.hour,
                          time.minute,
                        ),
                      );
                    }
                  },
          ),
        ),
      ],
    );
  }
}

class _QuickDate extends StatelessWidget {
  const _QuickDate({
    required this.date,
    required this.selected,
    required this.onSelected,
  });
  final DateTime date;
  final DateTime? selected;
  final ValueChanged<DateTime> onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final active = DateUtils.isSameDay(date, selected);
    final color = active ? scheme.onPrimary : scheme.onSurface;
    final now = DateTime.now();
    final tomorrow = DateTime(now.year, now.month, now.day + 1);
    final label = DateUtils.isSameDay(date, now)
        ? 'Hôm nay'
        : DateUtils.isSameDay(date, tomorrow)
        ? 'Ngày mai'
        : date.weekday == DateTime.sunday
        ? 'Chủ nhật'
        : 'Thứ ${date.weekday + 1}';
    return Semantics(
      selected: active,
      child: OutlinedButton(
        onPressed: () => onSelected(date),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          minimumSize: const Size(0, 48),
          backgroundColor: active ? scheme.primary : scheme.surface,
          foregroundColor: color,
          side: BorderSide(
            color: active ? scheme.primary : scheme.outlineVariant,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: Column(
          children: [
            FittedBox(fit: BoxFit.scaleDown, child: Text(
              label,
              style: TextStyle(fontSize: 11, color: color),
            )),
            const SizedBox(height: 2),
            FittedBox(fit: BoxFit.scaleDown, child: Text(
              '${date.day}/${date.month}',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            )),
          ],
        ),
      ),
    );
  }
}

class _BookingTimePicker extends StatefulWidget {
  const _BookingTimePicker({required this.date});
  final DateTime date;
  @override
  State<_BookingTimePicker> createState() => _BookingTimePickerState();
}

class _BookingTimePickerState extends State<_BookingTimePicker> {
  late int _hour;
  late int _minute;
  late final FixedExtentScrollController _hours;
  late final FixedExtentScrollController _minutes;

  @override
  void initState() {
    super.initState();
    _hour = widget.date.hour.clamp(8, 21);
    _minute = widget.date.minute;
    _hours = FixedExtentScrollController(initialItem: _hour - 8);
    _minutes = FixedExtentScrollController(initialItem: _minute);
  }

  @override
  void dispose() {
    _hours.dispose();
    _minutes.dispose();
    super.dispose();
  }

  Widget _wheel(
    String label,
    FixedExtentScrollController controller,
    int start,
    int count,
    int value,
    ValueChanged<int> onChanged,
  ) {
    final theme = Theme.of(context);
    return Expanded(
      child: Column(
        children: [
          Text(label, style: theme.textTheme.labelLarge),
          const SizedBox(height: 8),
          SizedBox(
            height: 180,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: theme.colorScheme.outlineVariant),
              ),
              child: Stack(
                children: [
                  Center(
                    child: Container(
                      height: 44,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  ListWheelScrollView.useDelegate(
                    controller: controller,
                    itemExtent: 44,
                    physics: const FixedExtentScrollPhysics(),
                    onSelectedItemChanged: (index) => onChanged(index + start),
                    childDelegate: ListWheelChildBuilderDelegate(
                      childCount: count,
                      builder: (_, index) => Center(
                        child: Text(
                          '${index + start}'.padLeft(2, '0'),
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: value == index + start
                                ? FontWeight.w800
                                : FontWeight.w500,
                            color: value == index + start
                                ? Colors.white
                                : theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    backgroundColor: Theme.of(context).colorScheme.surface,
    surfaceTintColor: Colors.transparent,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    titlePadding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
    contentPadding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
    actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
    title: Text(
      'Chọn giờ thực hiện',
      style: Theme.of(
        context,
      ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
    ),
    content: SizedBox(
      width: 280,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              _wheel(
                'Giờ',
                _hours,
                8,
                14,
                _hour,
                (value) => setState(() {
                  _hour = value;
                }),
              ),
              const SizedBox(width: 12),
              _wheel(
                'Phút',
                _minutes,
                0,
                60,
                _minute,
                (value) => setState(() {
                  _minute = value;
                }),
              ),
            ],
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Hủy'),
      ),
      FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: Theme.of(context).colorScheme.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(140, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: Theme.of(
            context,
          ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
        onPressed: () {
          final date = widget.date;
          final chosen = DateTime(
            date.year,
            date.month,
            date.day,
            _hour,
            _minute,
          );
          final now = DateTime.now();
          if (chosen.isBefore(
            DateTime(now.year, now.month, now.day, now.hour, now.minute),
          )) {
            AppToast.show(context, 'Vui lòng chọn thời gian từ phút hiện tại trở đi.', type: AppToastType.warning);
            return;
          }
          Navigator.pop(context, TimeOfDay(hour: _hour, minute: _minute));
        },
        child: Text(
          'Chọn ${_hour.toString().padLeft(2, '0')}:${_minute.toString().padLeft(2, '0')}',
        ),
      ),
    ],
  );
}
