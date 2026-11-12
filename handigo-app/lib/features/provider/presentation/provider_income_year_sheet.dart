import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../shared/widgets/account_overview_widgets.dart';

Future<int?> showProviderIncomeYearSheet(
  BuildContext context, {
  required DateTime now,
  int? selectedYear,
}) => showModalBottomSheet<int>(
  context: context,
  useRootNavigator: true,
  isScrollControlled: true,
  useSafeArea: true,
  showDragHandle: true,
  backgroundColor: accountSurface,
  constraints: BoxConstraints(
    maxWidth: 480,
    maxHeight: MediaQuery.sizeOf(context).height * .85,
  ),
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
  ),
  builder: (_) => _IncomeYearSheet(now: now, selectedYear: selectedYear),
);

class _IncomeYearSheet extends StatefulWidget {
  const _IncomeYearSheet({required this.now, this.selectedYear});

  final DateTime now;
  final int? selectedYear;

  @override
  State<_IncomeYearSheet> createState() => _IncomeYearSheetState();
}

class _IncomeYearSheetState extends State<_IncomeYearSheet> {
  late int _year = widget.selectedYear ?? widget.now.year;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Symbols.calendar_month, color: accountPrimary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Chọn năm xem thu nhập',
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: accountInk,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Đóng',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Symbols.close, size: 20),
                ),
              ],
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => setState(() => _year = widget.now.year),
                icon: const Icon(Symbols.today, size: 18),
                label: const Text('Năm nay'),
              ),
            ),
            Flexible(
              child: Container(
                height: 280,
                decoration: BoxDecoration(
                  color: accountBackground,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: accountDivider),
                ),
                child: Theme(
                  data: theme.copyWith(
                    colorScheme: theme.colorScheme.copyWith(
                      primary: accountPrimary,
                      onPrimary: Colors.white,
                      surface: accountSurface,
                      onSurface: accountInk,
                    ),
                    datePickerTheme: theme.datePickerTheme.copyWith(
                      yearShape: WidgetStatePropertyAll(
                        RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      yearStyle: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  child: YearPicker(
                    key: ValueKey(_year),
                    firstDate: DateTime(1),
                    lastDate: DateTime(widget.now.year, 12, 31),
                    currentDate: widget.now,
                    selectedDate: DateTime(_year),
                    onChanged: (value) => setState(() => _year = value.year),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '01/01/$_year – 31/12/$_year',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(color: accountMuted),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Hủy'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context, _year),
                    child: const Text('Áp dụng'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
