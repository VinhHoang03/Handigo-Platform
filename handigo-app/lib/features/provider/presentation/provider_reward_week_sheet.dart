import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../shared/widgets/account_overview_widgets.dart';
import '../domain/provider_rewards.dart';

Future<DateTime?> showProviderRewardWeekSheet(
  BuildContext context, {
  required DateTime today,
  required DateTime selectedWeek,
}) => showModalBottomSheet<DateTime>(
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
  builder: (_) => _RewardWeekSheet(today: today, selectedWeek: selectedWeek),
);

class _RewardWeekSheet extends StatefulWidget {
  const _RewardWeekSheet({required this.today, required this.selectedWeek});

  final DateTime today;
  final DateTime selectedWeek;

  @override
  State<_RewardWeekSheet> createState() => _RewardWeekSheetState();
}

class _RewardWeekSheetState extends State<_RewardWeekSheet> {
  late DateTime _selected = widget.selectedWeek;
  late DateTime _month = DateTime.utc(_selected.year, _selected.month);

  DateTime get _currentWeek => providerRewardWeekStart(widget.today);

  void _changeMonth(int offset) {
    setState(() => _month = DateTime.utc(_month.year, _month.month + offset));
  }

  @override
  Widget build(BuildContext context) {
    final currentMonth = DateTime.utc(widget.today.year, widget.today.month);
    final firstWeek = providerRewardWeekStart(_month);
    final nextMonth = DateTime.utc(_month.year, _month.month + 1);
    final weeks = <DateTime>[
      for (
        var week = firstWeek;
        week.isBefore(nextMonth) && !week.isAfter(_currentWeek);
        week = week.add(const Duration(days: 7))
      )
        week,
    ];
    final format = DateFormat('dd/MM/yyyy');
    final type = Theme.of(context).textTheme;

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
                    'Chọn tuần thưởng',
                    style: type.titleLarge?.copyWith(
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
            Text(
              'Từ thứ Hai đến Chủ nhật, theo giờ Việt Nam.',
              style: type.bodySmall?.copyWith(color: accountMuted),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: accountBackground,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  IconButton(
                    tooltip: 'Tháng trước',
                    onPressed: _month.isAfter(DateTime.utc(2020))
                        ? () => _changeMonth(-1)
                        : null,
                    icon: const Icon(Symbols.chevron_left),
                  ),
                  Expanded(
                    child: Text(
                      'Tháng ${_month.month}/${_month.year}',
                      textAlign: TextAlign.center,
                      style: type.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Tháng sau',
                    onPressed: _month.isBefore(currentMonth)
                        ? () => _changeMonth(1)
                        : null,
                    icon: const Icon(Symbols.chevron_right),
                  ),
                ],
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => setState(() {
                  _selected = _currentWeek;
                  _month = currentMonth;
                }),
                icon: const Icon(Symbols.today, size: 18),
                label: const Text('Về tuần này'),
              ),
            ),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: weeks.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (context, index) {
                  final week = weeks[index];
                  final selected = week == _selected;
                  final end = week.add(const Duration(days: 6));
                  return Material(
                    color: selected ? accountPrimarySoft : accountSurface,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(
                        color: selected ? accountPrimary : accountDivider,
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => setState(() => _selected = week),
                      child: Semantics(
                        selected: selected,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Icon(
                                selected
                                    ? Symbols.radio_button_checked
                                    : Symbols.radio_button_unchecked,
                                color: selected ? accountPrimary : accountMuted,
                                size: 20,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${format.format(week)} – ${format.format(end)}',
                                      style: type.bodyMedium?.copyWith(
                                        color: accountInk,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (week == _currentWeek)
                                      const Text(
                                        'Tuần này',
                                        style: TextStyle(
                                          color: accountPrimary,
                                          fontSize: 12,
                                        ),
                                      ),
                                  ],
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
                    onPressed: () => Navigator.pop(context, _selected),
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
