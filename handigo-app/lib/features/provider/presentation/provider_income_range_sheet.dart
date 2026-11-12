import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../shared/widgets/account_overview_widgets.dart';

Future<DateTimeRange?> showProviderIncomeRangeSheet(
  BuildContext context, {
  required DateTime now,
  DateTimeRange? initialRange,
}) => showModalBottomSheet<DateTimeRange>(
  context: context,
  useRootNavigator: true,
  isScrollControlled: true,
  useSafeArea: true,
  showDragHandle: true,
  backgroundColor: accountSurface,
  constraints: BoxConstraints(
    maxWidth: 480,
    maxHeight: MediaQuery.sizeOf(context).height * .9,
  ),
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
  ),
  builder: (_) => _IncomeRangeSheet(now: now, initialRange: initialRange),
);

class _IncomeRangeSheet extends StatefulWidget {
  const _IncomeRangeSheet({required this.now, this.initialRange});
  final DateTime now;
  final DateTimeRange? initialRange;

  @override
  State<_IncomeRangeSheet> createState() => _IncomeRangeSheetState();
}

class _IncomeRangeSheetState extends State<_IncomeRangeSheet> {
  late final DateTime _today;
  late DateTime _start, _end;

  @override
  void initState() {
    super.initState();
    _today = DateUtils.dateOnly(widget.now);
    _start = DateUtils.dateOnly(
      widget.initialRange?.start ??
          DateTime(_today.year, _today.month, _today.day - 6),
    );
    _end = DateUtils.dateOnly(widget.initialRange?.end ?? _today);
  }

  bool get _valid => !_end.isBefore(_start);

  Future<void> _pickDate(bool start) async {
    final selected = await showDatePicker(
      context: context,
      initialDate: start ? _start : _end,
      currentDate: _today,
      firstDate: DateTime(1),
      lastDate: DateTime(9999, 12, 31),
      helpText: start ? 'Chọn ngày bắt đầu' : 'Chọn ngày kết thúc',
      fieldLabelText: start ? 'Từ ngày' : 'Đến ngày',
      cancelText: 'Hủy',
      confirmText: 'Chọn',
      errorFormatText: 'Ngày không đúng định dạng.',
      errorInvalidText: 'Ngày không hợp lệ.',
      builder: _calendarTheme,
    );
    if (selected == null || !mounted) return;
    setState(() {
      if (start) {
        _start = DateUtils.dateOnly(selected);
      } else {
        _end = DateUtils.dateOnly(selected);
      }
    });
  }

  Widget _calendarTheme(BuildContext context, Widget? child) {
    final theme = Theme.of(context);
    Color foreground(Set<WidgetState> states) {
      if (states.contains(WidgetState.disabled)) {
        return accountMuted.withValues(alpha: .4);
      }
      return states.contains(WidgetState.selected) ? Colors.white : accountInk;
    }

    Color background(Set<WidgetState> states) =>
        states.contains(WidgetState.selected)
        ? accountPrimary
        : Colors.transparent;

    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: const BorderSide(color: accountDivider),
    );
    return Theme(
      data: theme.copyWith(
        colorScheme: theme.colorScheme.copyWith(
          primary: accountPrimary,
          onPrimary: Colors.white,
          surface: accountSurface,
          onSurface: accountInk,
          onSurfaceVariant: accountMuted,
          error: accountDanger,
        ),
        datePickerTheme: DatePickerThemeData(
          backgroundColor: accountSurface,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(color: accountDivider),
          ),
          headerBackgroundColor: accountPrimarySoft,
          headerForegroundColor: accountInk,
          headerHelpStyle: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
          headerHeadlineStyle: theme.textTheme.headlineSmall?.copyWith(
            fontSize: 24,
            height: 1.25,
            fontWeight: FontWeight.w700,
          ),
          weekdayStyle: theme.textTheme.bodySmall?.copyWith(
            color: accountMuted,
            fontWeight: FontWeight.w600,
          ),
          dayStyle: theme.textTheme.bodyMedium,
          dayForegroundColor: WidgetStateProperty.resolveWith(foreground),
          dayBackgroundColor: WidgetStateProperty.resolveWith(background),
          dayShape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          todayForegroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? Colors.white
                : accountPrimary,
          ),
          todayBackgroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? accountPrimary
                : accountPrimarySoft,
          ),
          todayBorder: const BorderSide(color: accountPrimary),
          yearStyle: theme.textTheme.bodyMedium,
          yearForegroundColor: WidgetStateProperty.resolveWith(foreground),
          yearBackgroundColor: WidgetStateProperty.resolveWith(background),
          yearShape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          subHeaderForegroundColor: accountInk,
          dividerColor: accountDivider,
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: accountBackground,
            labelStyle: const TextStyle(color: accountMuted),
            contentPadding: const EdgeInsets.all(16),
            border: border,
            enabledBorder: border,
            focusedBorder: border.copyWith(
              borderSide: const BorderSide(color: accountPrimary, width: 1.5),
            ),
          ),
          cancelButtonStyle: TextButton.styleFrom(
            foregroundColor: accountPrimary,
            minimumSize: const Size(72, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          confirmButtonStyle: TextButton.styleFrom(
            backgroundColor: accountPrimary,
            foregroundColor: Colors.white,
            minimumSize: const Size(80, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ),
      child: child!,
    );
  }

  Widget _dateField({required bool start}) => Semantics(
    button: true,
    child: InkWell(
      key: ValueKey(start ? 'income-range-start' : 'income-range-end'),
      borderRadius: BorderRadius.circular(14),
      onTap: () => _pickDate(start),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: start ? 'Từ ngày' : 'Đến ngày',
          labelStyle: const TextStyle(color: accountMuted),
          prefixIcon: const Icon(
            Icons.calendar_month_outlined,
            color: accountPrimary,
          ),
          suffixIcon: const Icon(
            Icons.expand_more_rounded,
            color: accountMuted,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: accountDivider),
          ),
          filled: true,
          fillColor: accountBackground,
        ),
        child: Text(
          DateFormat('dd/MM/yyyy').format(start ? _start : _end),
          style: Theme.of(
            context,
          ).textTheme.bodyLarge?.copyWith(color: accountInk),
        ),
      ),
    ),
  );

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Chọn khoảng thời gian',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: accountInk,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Đóng',
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(
                        Icons.close_rounded,
                        color: accountMuted,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Xem thu nhập trong thời gian bạn chọn.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: accountMuted),
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final (label, from, to) in [
                      (
                        '7 ngày qua',
                        DateTime(_today.year, _today.month, _today.day - 6),
                        _today,
                      ),
                      (
                        '30 ngày qua',
                        DateTime(_today.year, _today.month, _today.day - 29),
                        _today,
                      ),
                      (
                        'Tháng trước',
                        DateTime(_today.year, _today.month - 1),
                        DateTime(_today.year, _today.month, 0),
                      ),
                    ])
                      ChoiceChip(
                        label: Text(label),
                        selected:
                            DateUtils.isSameDay(_start, from) &&
                            DateUtils.isSameDay(_end, to),
                        selectedColor: accountPrimarySoft,
                        backgroundColor: accountSurface,
                        checkmarkColor: accountPrimary,
                        side: const BorderSide(color: accountDivider),
                        labelStyle: const TextStyle(color: accountPrimary),
                        onSelected: (_) => setState(() {
                          _start = from;
                          _end = to;
                        }),
                      ),
                  ],
                ),
                const SizedBox(height: 24),
                _dateField(start: true),
                const SizedBox(height: 20),
                _dateField(start: false),
                if (!_valid) ...[
                  const SizedBox(height: 12),
                  const Text(
                    'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
                    style: TextStyle(color: accountDanger),
                  ),
                ],
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final cancel = OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  foregroundColor: accountPrimary,
                ),
                onPressed: () => Navigator.pop(context),
                child: const Text('Hủy'),
              );
              final apply = FilledButton(
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  backgroundColor: accountPrimary,
                  foregroundColor: Colors.white,
                ),
                onPressed: _valid
                    ? () => Navigator.pop(
                        context,
                        DateTimeRange(start: _start, end: _end),
                      )
                    : null,
                child: const Text('Áp dụng'),
              );
              if (constraints.maxWidth < 300 ||
                  MediaQuery.textScalerOf(context).scale(1) > 1.3) {
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [apply, const SizedBox(height: 8), cancel],
                );
              }
              return Row(
                children: [
                  Expanded(child: cancel),
                  const SizedBox(width: 12),
                  Expanded(child: apply),
                ],
              );
            },
          ),
        ),
      ],
    ),
  );
}
