import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../../core/network/realtime_connection.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/account_overview_widgets.dart';
import '../../../shared/widgets/customer_page_header.dart';
import '../domain/provider_income.dart';
import 'provider_account_screens.dart';
import 'provider_screens.dart';
import 'provider_order_detail_screen.dart';
import 'provider_income_range_sheet.dart';
import 'provider_income_year_sheet.dart';
import 'provider_rewards_tab.dart';

final providerFinanceNowProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);
final providerIncomeProvider = FutureProvider.autoDispose
    .family<ProviderIncomeSummary, ProviderIncomeRange>(retry: (_, _) => null, (
      ref,
      range,
    ) {
      ref.watch(authControllerProvider.select((auth) => auth.user?.id));
      return ref.watch(providerRepositoryProvider).income(range);
    });
final providerFinanceHistoryProvider = FutureProvider.autoDispose
    .family<PagedResult<ProviderFinanceEntry>, (bool, int, String)>(
      retry: (_, _) => null,
      (ref, query) {
        ref.watch(authControllerProvider.select((auth) => auth.user?.id));
        return ref
            .watch(providerRepositoryProvider)
            .financeHistory(
              withdrawal: query.$1,
              page: query.$2,
              type: query.$3.isEmpty ? null : query.$3,
            );
      },
    );

void _refreshFinances(WidgetRef ref) {
  ref.invalidate(providerIncomeProvider);
  ref.invalidate(providerFinanceHistoryProvider);
  ref.invalidate(providerRewardWeekProvider);
  ref.invalidate(providerRewardHistoryProvider);
  ref.invalidate(providerWalletProvider);
  ref.invalidate(providerWalletSummaryProvider);
  ref.invalidate(providerWalletTransactionsProvider);
  ref.invalidate(providerWithdrawalsProvider);
  ref.invalidate(providerOverviewProvider);
}

class ProviderIncomeScreen extends ConsumerStatefulWidget {
  const ProviderIncomeScreen({this.asTab = false, super.key});
  final bool asTab;
  @override
  ConsumerState<ProviderIncomeScreen> createState() =>
      _ProviderIncomeScreenState();
}

class _ProviderIncomeScreenState extends ConsumerState<ProviderIncomeScreen>
    with WidgetsBindingObserver {
  int _tab = 0;
  bool _walletVisited = false;
  ProviderIncomePeriod _period = ProviderIncomePeriod.today;
  int? _selectedYear;
  DateTimeRange? _selectedRange;
  StreamSubscription<dynamic>? _events;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ref.listenManual(realtimeConnectionProvider, (_, connection) {
      unawaited(_events?.cancel());
      _events = connection?.events.listen((event) {
        if (mounted &&
            [
              'notification:new',
              'order:updated',
              'connect',
            ].contains(event.name)) {
          _refreshFinances(ref);
        }
      });
    }, fireImmediately: true);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      _refreshFinances(ref);
      setState(() {});
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_events?.cancel());
    super.dispose();
  }

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/provider');
    }
  }

  void _selectTab(int value) => setState(() {
    _tab = value;
    if (value == 1) _walletVisited = true;
  });

  String get _title => switch (_tab) {
    1 => 'Ví Handigo',
    _ => 'Thu nhập',
  };

  Future<void> _selectPeriod(ProviderIncomePeriod period) async {
    final now = vietnamDateTime(ref.read(providerFinanceNowProvider)());
    if (period == ProviderIncomePeriod.customRange) {
      final range = await showProviderIncomeRangeSheet(
        context,
        now: now,
        initialRange: _selectedRange,
      );
      if (range == null || !mounted) return;
      setState(() {
        _selectedRange = range;
        _period = period;
      });
    } else if (period == ProviderIncomePeriod.year) {
      final year = await showProviderIncomeYearSheet(
        context,
        now: now,
        selectedYear: _selectedYear,
      );
      if (year == null || !mounted) return;
      setState(() {
        _selectedYear = year;
        _period = period;
      });
    } else {
      setState(() => _period = period);
    }
  }

  @override
  Widget build(BuildContext context) {
    final range = ProviderIncomeRange.forPeriod(
      _period,
      ref.read(providerFinanceNowProvider)(),
      selectedYear: _selectedYear,
      selectedStartDate: _selectedRange?.start,
      selectedEndDate: _selectedRange?.end,
    );
    final content = IndexedStack(
      index: _tab,
      children: [
        _IncomeContent(range: range, onPeriod: _selectPeriod),
        if (_walletVisited)
          widget.asTab
              ? ProviderWalletScreen(
                  embedded: true,
                  actionsBuilder: (wallet) =>
                      _FinanceWalletActions(balance: wallet.balance),
                )
              : const _FinanceWallet()
        else
          const SizedBox.shrink(),
        ProviderRewardsTab(
          now: ref.read(providerFinanceNowProvider),
          active: _tab == 2,
        ),
      ],
    );
    if (widget.asTab) {
      return Scaffold(
        backgroundColor: accountBackground,
        appBar: CustomerPageHeader(
          toolbarHeight: 64 * MediaQuery.textScalerOf(context).scale(1),
          automaticallyImplyLeading: false,
          backgroundColor: accountSurface,
          title: _title,
          titleColor: accountInk,
          actions: [
            IconButton(
              tooltip: 'Tải lại',
              onPressed: () => _refreshFinances(ref),
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: Theme(
            data: Theme.of(context).copyWith(
              cardTheme: CardThemeData(
                color: accountSurface,
                surfaceTintColor: Colors.transparent,
                elevation: 0,
                margin: EdgeInsets.zero,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: SizedBox(
                    width: double.infinity,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8EDF3),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Row(
                          children: [
                            for (final (index, icon, label) in const [
                              (0, Symbols.trending_up, 'Thu nhập'),
                              (1, Symbols.account_balance_wallet, 'Ví'),
                              (2, Symbols.military_tech, 'Tiền thưởng'),
                            ])
                              Expanded(
                                child: _IncomeTabItem(
                                  icon: icon,
                                  label: label,
                                  selected: _tab == index,
                                  onTap: () => _selectTab(index),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(child: content),
              ],
            ),
          ),
        ),
      );
    }
    final screen = Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: _back,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: Text(_title),
        actions: [
          IconButton(
            tooltip: 'Tải lại',
            onPressed: () => _refreshFinances(ref),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: content,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: _selectTab,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            selectedIcon: Icon(Icons.insights_rounded),
            label: 'Thu nhập',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet_rounded),
            label: 'Ví',
          ),
          NavigationDestination(
            icon: Icon(Icons.emoji_events_outlined),
            selectedIcon: Icon(Icons.emoji_events_rounded),
            label: 'Tiền thưởng',
          ),
        ],
      ),
    );
    return PopScope(
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: screen,
    );
  }
}

/// Một ô trong thanh chuyển tab Thu nhập / Ví / Tiền thưởng.
class _IncomeTabItem extends StatelessWidget {
  const _IncomeTabItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? Colors.white : accountMuted;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          height: 42,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? accountPrimary : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: accountPrimary.withValues(alpha: 0.28),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, fill: selected ? 1 : 0, color: color),
              const SizedBox(width: 5),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                    color: color,
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

const incomePositiveColor = Color(0xFF198754);

IconData _periodIcon(ProviderIncomePeriod period) => switch (period) {
  ProviderIncomePeriod.today => Icons.today_outlined,
  ProviderIncomePeriod.week => Icons.date_range_outlined,
  ProviderIncomePeriod.month => Icons.calendar_month_outlined,
  ProviderIncomePeriod.year => Icons.event_note_outlined,
  ProviderIncomePeriod.customRange => Icons.tune_rounded,
};

String _periodName(ProviderIncomePeriod period) => switch (period) {
  ProviderIncomePeriod.today => 'Hôm nay',
  ProviderIncomePeriod.week => 'Tuần này',
  ProviderIncomePeriod.month => 'Tháng này',
  ProviderIncomePeriod.year => 'Theo năm',
  ProviderIncomePeriod.customRange => 'Khoảng thời gian',
};

/// Bộ lọc kỳ thống kê gộp thành một dropdown, hiển thị kỳ đang chọn.
class _IncomePeriodDropdown extends StatelessWidget {
  const _IncomePeriodDropdown({required this.range, required this.onPeriod});
  final ProviderIncomeRange range;
  final ValueChanged<ProviderIncomePeriod> onPeriod;

  @override
  Widget build(BuildContext context) {
    final selectedLabel = range.period == ProviderIncomePeriod.year
        ? 'Năm ${range.from.year}'
        : _periodName(range.period);
    return PopupMenuButton<ProviderIncomePeriod>(
      tooltip: 'Chọn kỳ thống kê',
      initialValue: range.period,
      onSelected: onPeriod,
      position: PopupMenuPosition.under,
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      itemBuilder: (_) => [
        for (final period in ProviderIncomePeriod.values)
          PopupMenuItem<ProviderIncomePeriod>(
            value: period,
            child: Row(
              children: [
                Icon(
                  _periodIcon(period),
                  size: 18,
                  color: period == range.period ? accountPrimary : accountMuted,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _periodName(period),
                    style: TextStyle(
                      color: period == range.period
                          ? accountPrimary
                          : accountInk,
                      fontWeight: period == range.period
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
                ),
                if (period == range.period)
                  const Icon(
                    Icons.check_circle_rounded,
                    size: 20,
                    color: accountPrimary,
                  ),
              ],
            ),
          ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: accountPrimary.withValues(alpha: .25)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(_periodIcon(range.period), size: 18, color: accountPrimary),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                selectedLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: accountPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_drop_down_rounded, color: accountPrimary),
          ],
        ),
      ),
    );
  }
}

/// So sánh thu nhập hiện tại với một kỳ trước, hiển thị % và số tiền chênh lệch.
class _IncomeCompareRow extends ConsumerWidget {
  const _IncomeCompareRow({
    required this.current,
    required this.compareRange,
    required this.label,
  });
  final double current;
  final ProviderIncomeRange compareRange;
  final String label;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final previous = ref
        .watch(providerIncomeProvider(compareRange))
        .asData
        ?.value
        .amount;
    if (previous == null) return const SizedBox.shrink();
    final diff = current - previous;
    final up = diff > 0;
    final down = diff < 0;
    // Nằm trên thẻ nền tím nên dùng chữ trắng; mũi tên thể hiện chiều tăng/giảm.
    const color = Colors.white;
    final icon = up
        ? Icons.arrow_upward_rounded
        : down
        ? Icons.arrow_downward_rounded
        : Icons.remove_rounded;
    final String detail;
    if (diff == 0) {
      detail = 'Không đổi';
    } else if (previous == 0) {
      detail = 'Kỳ trước chưa có thu nhập';
    } else {
      final percent = diff.abs() / previous * 100;
      final sign = up ? '+' : '-';
      detail =
          '$sign${NumberFormat('0.0', 'vi_VN').format(percent)}% '
          '($sign${_money(diff.abs())})';
    }
    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            '$detail $label',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _IncomeContent extends ConsumerWidget {
  const _IncomeContent({required this.range, required this.onPeriod});
  final ProviderIncomeRange range;
  final ValueChanged<ProviderIncomePeriod> onPeriod;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerIncomeProvider(range));
    final scheme = Theme.of(context).colorScheme;
    return RefreshIndicator(
      onRefresh: () async {
        try {
          await ref.refresh(providerIncomeProvider(range).future).then((_) {});
        } catch (_) {
          /* Lỗi được hiển thị trong nội dung. */
        }
      },
      child: ListView(
        key: PageStorageKey(('income', range)),
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: accountSurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: accountDivider),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Builder(
                  builder: (context) {
                    final title = AccountDetailSectionTitle(
                      'Thời gian thống kê',
                      subtitle:
                          '${DateFormat('dd/MM/yyyy').format(range.from)} – ${DateFormat('dd/MM/yyyy').format(range.to)}',
                    );
                    final dropdown = _IncomePeriodDropdown(
                      range: range,
                      onPeriod: onPeriod,
                    );
                    // Chữ phóng lớn: xếp dọc để dropdown không tràn ngang.
                    if (MediaQuery.textScalerOf(context).scale(1) > 1.3) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [title, const SizedBox(height: 8), dropdown],
                      );
                    }
                    return Row(
                      children: [
                        Expanded(child: title),
                        const SizedBox(width: 8),
                        dropdown,
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          state.when(
            loading: () =>
                const Padding(padding: EdgeInsets.all(40), child: AppLoading()),
            error: (error, _) => AppMessage(
              message: _error(error),
              onRetry: () => ref.invalidate(providerIncomeProvider(range)),
            ),
            data: (data) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AccountFinancialStatCard(
                  label: 'Thu nhập ${range.label.toLowerCase()}',
                  value: _money(data.amount),
                  icon: Icons.trending_up_rounded,
                  primary: true,
                  subtitle: 'Thu nhập dịch vụ sau phí',
                  footer: range.period == ProviderIncomePeriod.today
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _IncomeCompareRow(
                              current: data.amount,
                              compareRange: ProviderIncomeRange(
                                range.from.subtract(const Duration(days: 1)),
                                range.from.subtract(const Duration(days: 1)),
                                ProviderIncomePeriod.today,
                              ),
                              label: 'so với hôm qua',
                            ),
                            const SizedBox(height: 6),
                            _IncomeCompareRow(
                              current: data.amount,
                              compareRange: ProviderIncomeRange(
                                range.from.subtract(const Duration(days: 7)),
                                range.from.subtract(const Duration(days: 7)),
                                ProviderIncomePeriod.today,
                              ),
                              label: 'so với cùng ngày tuần trước',
                            ),
                          ],
                        )
                      : null,
                ),
                const SizedBox(height: 20),
                const AccountDetailSectionTitle(
                  'Thu nhập theo đơn',
                  subtitle: 'Chi tiết các khoản thu từ dịch vụ trong kỳ.',
                ),
                const SizedBox(height: 8),
                if (data.groups.isEmpty)
                  const AppMessage(
                    message:
                        'Chưa có thu nhập dịch vụ trong khoảng thời gian này.',
                    icon: Icons.receipt_long_outlined,
                  ),
                for (final group in data.groups)
                  Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    color: accountSurface,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: accountDivider),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.fromLTRB(12, 8, 16, 8),
                      title: Text(
                        group.primary.serviceName ?? group.primary.typeLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        _date(group.primary.createdAt),
                        style: const TextStyle(color: accountMuted),
                      ),
                      trailing: Text(
                        _money(group.amount),
                        style: TextStyle(
                          fontSize: 14,
                          color: group.amount >= 0
                              ? incomePositiveColor
                              : scheme.error,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      onTap: () => _showIncomeGroup(context, group),
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color:
                              (group.amount >= 0
                                      ? incomePositiveColor
                                      : scheme.error)
                                  .withValues(alpha: .12),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          group.amount >= 0
                              ? Icons.arrow_upward_rounded
                              : Icons.arrow_downward_rounded,
                          color: group.amount >= 0
                              ? incomePositiveColor
                              : scheme.error,
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
}

Widget _section(BuildContext context, String title) => Text(
  title,
  style: Theme.of(
    context,
  ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
);
String _money(double amount) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(amount);
String _date(DateTime? date) => date == null
    ? 'Chưa có thời gian'
    : DateFormat('HH:mm · dd/MM/yyyy').format(vietnamDateTime(date));
String _error(Object error) => error is ApiException
    ? error.message
    : 'Không thể tải dữ liệu. Vui lòng thử lại.';

Widget _value(String label, String value) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 8),
  child: Wrap(
    alignment: WrapAlignment.spaceBetween,
    spacing: 16,
    runSpacing: 4,
    children: [
      Text(label),
      Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
    ],
  ),
);

void _showIncomeGroup(BuildContext context, ProviderIncomeGroup group) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheet) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _section(sheet, 'Chi tiết thu nhập'),
            if (group.primary.orderCode != null)
              _value('Đơn dịch vụ', group.primary.orderCode!),
            if (group.hasBreakdown) ...[
              _value('Giá trị dịch vụ', _money(group.primary.grossAmount!)),
              _value('Phí nền tảng', _money(group.primary.platformFee!)),
            ] else ...[
              for (final entry in group.entries)
                _value(entry.typeLabel, _money(entry.incomeAmount)),
            ],
            const Divider(),
            _value('Thu nhập sau phí trong kỳ', _money(group.amount)),
            _value('Thời gian ghi nhận', _date(group.primary.createdAt)),
            if (group.primary.paymentMethod == 'cash')
              const Text(
                'Khách thanh toán tiền mặt trực tiếp. Thu nhập này không đồng nghĩa số dư ví tăng tương ứng.',
              ),
            if (group.primary.orderId != null) ...[
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  Navigator.pop(sheet);
                  Navigator.of(context).push<void>(
                    MaterialPageRoute(
                      builder: (_) => ProviderOrderDetailScreen(
                        orderId: group.primary.orderId!,
                      ),
                    ),
                  );
                },
                child: const Text('Xem đơn dịch vụ'),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

Future<void> _openBanks(BuildContext context) =>
    Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const ProviderBankAccountsScreen()),
    );

class _FinanceWallet extends ConsumerStatefulWidget {
  const _FinanceWallet();
  @override
  ConsumerState<_FinanceWallet> createState() => _FinanceWalletState();
}

class _FinanceWalletState extends ConsumerState<_FinanceWallet> {
  int _part = 0;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: () async => _refreshFinances(ref),
    child: ListView(
      padding: const EdgeInsets.all(16),
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        ref
            .watch(providerWalletProvider)
            .when(
              loading: () => const AppLoading(),
              error: (error, _) => AppMessage(
                message: _error(error),
                onRetry: () => ref.invalidate(providerWalletProvider),
              ),
              data: (wallet) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ProviderWalletBalanceCard(
                    wallet: wallet,
                    summary: ref
                        .watch(providerWalletSummaryProvider)
                        .asData
                        ?.value,
                    summaryLoading: ref
                        .watch(providerWalletSummaryProvider)
                        .isLoading,
                    showBankButton: false,
                  ),
                  const SizedBox(height: 12),
                  _FinanceWalletActions(balance: wallet.balance),
                ],
              ),
            ),
        const SizedBox(height: 20),
        _WalletPartBar(
          selected: _part,
          onChanged: (value) => setState(() => _part = value),
        ),
        const SizedBox(height: 12),
        switch (_part) {
          0 => const _WalletHistoryPanel(),
          1 => const _WalletRequestsPanel(),
          _ => const ProviderBankAccountsPanel(),
        },
        const SizedBox(height: 16),
      ],
    ),
  );
}

/// Thanh chọn mục con của tab Ví.
class _WalletPartBar extends StatelessWidget {
  const _WalletPartBar({required this.selected, required this.onChanged});
  final int selected;
  final ValueChanged<int> onChanged;

  static const _items = [
    (Icons.receipt_long_outlined, 'Lịch sử giao dịch'),
    (Icons.swap_vert_rounded, 'Yêu cầu nạp rút'),
    (Icons.account_balance_outlined, 'Tài khoản ngân hàng'),
  ];

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    child: Row(
      children: [
        for (final (index, (icon, label)) in _items.indexed)
          Padding(
            padding: EdgeInsets.only(right: index == _items.length - 1 ? 0 : 8),
            child: ChoiceChip(
              showCheckmark: false,
              selected: selected == index,
              onSelected: (_) => onChanged(index),
              selectedColor: accountPrimary,
              backgroundColor: const Color(0xFFE8EDF3),
              side: BorderSide.none,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              avatar: Icon(
                icon,
                size: 18,
                color: selected == index ? Colors.white : accountMuted,
              ),
              label: Text(label),
              labelStyle: TextStyle(
                fontWeight: FontWeight.w600,
                color: selected == index ? Colors.white : accountMuted,
              ),
            ),
          ),
      ],
    ),
  );
}

class _WalletHistoryPanel extends ConsumerWidget {
  const _WalletHistoryPanel();
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(providerFinanceHistoryProvider((false, 1, '')))
      .when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: _error(error),
          onRetry: () =>
              ref.invalidate(providerFinanceHistoryProvider((false, 1, ''))),
        ),
        data: (page) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (page.items.isEmpty)
              const AppMessage(message: 'Chưa có giao dịch ví.')
            else ...[
              for (final entry in page.items.take(10))
                _FinanceTile(entry: entry),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        const _FinanceHistoryScreen(withdrawal: false),
                  ),
                ),
                child: const Text('Xem tất cả giao dịch'),
              ),
            ],
          ],
        ),
      );
}

/// Gộp các lần nạp ví và yêu cầu rút tiền, mới nhất trước.
class _WalletRequestsPanel extends ConsumerWidget {
  const _WalletRequestsPanel();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final deposits = ref.watch(
      providerFinanceHistoryProvider((false, 1, 'deposit')),
    );
    final withdrawals = ref.watch(
      providerFinanceHistoryProvider((true, 1, '')),
    );
    if (deposits.hasError || withdrawals.hasError) {
      return AppMessage(
        message: _error((deposits.error ?? withdrawals.error)!),
        onRetry: () {
          ref.invalidate(providerFinanceHistoryProvider((false, 1, 'deposit')));
          ref.invalidate(providerFinanceHistoryProvider((true, 1, '')));
        },
      );
    }
    if (!deposits.hasValue || !withdrawals.hasValue) return const AppLoading();
    final items =
        [...deposits.requireValue.items, ...withdrawals.requireValue.items]
          ..sort(
            (a, b) => (b.createdAt ?? DateTime(0)).compareTo(
              a.createdAt ?? DateTime(0),
            ),
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (items.isEmpty)
          const AppMessage(message: 'Chưa có yêu cầu nạp hoặc rút tiền.')
        else ...[
          for (final entry in items.take(10)) _FinanceTile(entry: entry),
          TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const _FinanceHistoryScreen(withdrawal: true),
              ),
            ),
            child: const Text('Xem tất cả yêu cầu rút tiền'),
          ),
        ],
      ],
    );
  }
}

class _FinanceWalletActions extends ConsumerWidget {
  const _FinanceWalletActions({required this.balance});
  final double balance;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Row(
    children: [
      Expanded(
        child: FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
          icon: const Icon(Icons.add_rounded),
          label: const Text('Nạp ví'),
          onPressed: () => _openMoneyForm(context, ref, false),
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
          ),
          icon: const Icon(Icons.outbound_outlined),
          label: const Text('Rút tiền'),
          onPressed: balance > 0
              ? () => _openMoneyForm(context, ref, true)
              : null,
        ),
      ),
    ],
  );

  Future<void> _openMoneyForm(
    BuildContext context,
    WidgetRef ref,
    bool withdrawal,
  ) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FinanceMoneyForm(withdrawal: withdrawal),
      ),
    );
    if (context.mounted) _refreshFinances(ref);
  }
}

class _FinanceHistoryScreen extends ConsumerStatefulWidget {
  const _FinanceHistoryScreen({required this.withdrawal});
  final bool withdrawal;
  @override
  ConsumerState<_FinanceHistoryScreen> createState() =>
      _FinanceHistoryScreenState();
}

class _FinanceHistoryScreenState extends ConsumerState<_FinanceHistoryScreen> {
  int _page = 1;
  String _type = '';
  @override
  Widget build(BuildContext context) {
    final query = (widget.withdrawal, _page, _type);
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.withdrawal ? 'Lịch sử rút tiền' : 'Lịch sử giao dịch',
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          try {
            await ref
                .refresh(providerFinanceHistoryProvider(query).future)
                .then((_) {});
          } catch (_) {}
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            if (!widget.withdrawal)
              DropdownButtonFormField<String>(
                initialValue: _type,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Loại giao dịch'),
                items:
                    const {
                          '': 'Tất cả',
                          'deposit': 'Nạp ví',
                          'provider_earning': 'Thu nhập dịch vụ',
                          'provider_weekly_reward': 'Tiền thưởng tuần',
                          'platform_fee': 'Phí nền tảng',
                          'withdraw': 'Rút tiền',
                          'refund': 'Hoàn tiền',
                        }.entries
                        .map(
                          (e) => DropdownMenuItem(
                            value: e.key,
                            child: Text(e.value),
                          ),
                        )
                        .toList(),
                onChanged: (value) => setState(() {
                  _type = value ?? '';
                  _page = 1;
                }),
              ),
            const SizedBox(height: 16),
            ref
                .watch(providerFinanceHistoryProvider(query))
                .when(
                  loading: () => const AppLoading(),
                  error: (error, _) => AppMessage(
                    message: _error(error),
                    onRetry: () =>
                        ref.invalidate(providerFinanceHistoryProvider(query)),
                  ),
                  data: (result) => Column(
                    children: [
                      if (result.items.isEmpty)
                        const AppMessage(
                          message: 'Chưa có dữ liệu trong bộ lọc này.',
                        ),
                      for (final entry in result.items)
                        _FinanceTile(entry: entry),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 12,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          OutlinedButton(
                            onPressed: _page > 1
                                ? () => setState(() => _page--)
                                : null,
                            child: const Text('Trang trước'),
                          ),
                          Text('$_page / ${math.max(1, result.totalPages)}'),
                          OutlinedButton(
                            onPressed: _page < result.totalPages
                                ? () => setState(() => _page++)
                                : null,
                            child: const Text('Trang sau'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _FinanceTile extends StatelessWidget {
  const _FinanceTile({required this.entry});
  final ProviderFinanceEntry entry;
  @override
  Widget build(BuildContext context) {
    final isOut = entry.direction == 'out';
    final color = isOut
        ? Theme.of(context).colorScheme.error
        : incomePositiveColor;
    // Tiền vào: ưu tiên tên dịch vụ; còn lại hiện lý do của giao dịch.
    final reason = entry.description?.isNotEmpty == true
        ? entry.description!
        : entry.typeLabel;
    final title = !isOut && entry.serviceName?.isNotEmpty == true
        ? entry.serviceName!
        : reason;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: accountSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: accountDivider),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(12, 8, 16, 8),
        title: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          _date(entry.createdAt),
          style: const TextStyle(color: accountMuted),
        ),
        trailing: Text(
          '${isOut ? '-' : ''}${_money(entry.amount)}',
          style: TextStyle(
            fontSize: 14,
            color: color,
            fontWeight: FontWeight.w600,
          ),
        ),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            isOut ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded,
            color: color,
          ),
        ),
        onTap: () => showModalBottomSheet<void>(
          context: context,
          showDragHandle: true,
          isScrollControlled: true,
          builder: (_) => SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _section(context, entry.typeLabel),
                  _value('Số tiền', _money(entry.amount)),
                  _value('Trạng thái', entry.statusLabel),
                  _value('Thời gian', _date(entry.createdAt)),
                  if (entry.transactionCode != null)
                    _value('Mã giao dịch', entry.transactionCode!),
                  if (entry.bankLabel != null)
                    _value('Ngân hàng nhận', entry.bankLabel!),
                  if (entry.adminNote != null)
                    _value('Ghi chú xét duyệt', entry.adminNote!),
                  if (entry.grossAmount != null)
                    _value('Giá trị dịch vụ', _money(entry.grossAmount!)),
                  if (entry.platformFee != null)
                    _value('Phí nền tảng', _money(entry.platformFee!)),
                  if (entry.netEarning != null)
                    _value('Thu nhập sau phí', _money(entry.netEarning!)),
                  if (entry.balanceAfter != null)
                    _value('Số dư sau giao dịch', _money(entry.balanceAfter!)),
                  if (entry.affectsWalletBalance == false)
                    const Text(
                      'Khoản ghi nhận này không làm thay đổi số dư ví.',
                    ),
                  if (entry.type == 'deposit' &&
                      entry.status == 'pending' &&
                      entry.gatewayOrderCode != null)
                    _PendingDeposit(entry: entry),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

final providerFinanceLaunchUrlProvider = Provider<Future<bool> Function(Uri)>(
  (ref) =>
      (url) => launchUrl(url, mode: LaunchMode.externalApplication),
);

Future<void> _launchPayment(WidgetRef ref, String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null ||
      uri.scheme != 'https' ||
      uri.host.isEmpty ||
      !await ref.read(providerFinanceLaunchUrlProvider)(uri)) {
    throw const FormatException();
  }
}

class _PendingDeposit extends ConsumerStatefulWidget {
  const _PendingDeposit({required this.entry});
  final ProviderFinanceEntry entry;
  @override
  ConsumerState<_PendingDeposit> createState() => _PendingDepositState();
}

class _PendingDepositState extends ConsumerState<_PendingDeposit> {
  bool _busy = false;
  String? _message;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      if (_message != null) Text(_message!),
      if (widget.entry.checkoutUrl != null)
        FilledButton(
          onPressed: _busy
              ? null
              : () async {
                  setState(() => _busy = true);
                  try {
                    await _launchPayment(ref, widget.entry.checkoutUrl!);
                  } catch (_) {
                    if (mounted) {
                      setState(
                        () =>
                            _message = 'Không thể mở PayOS. Vui lòng thử lại.',
                      );
                    }
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
          child: const Text('Mở thanh toán PayOS'),
        ),
      OutlinedButton(
        onPressed: _busy
            ? null
            : () async {
                final owner = ref.read(authControllerProvider).user?.id;
                setState(() => _busy = true);
                try {
                  final entry = await ref
                      .read(providerRepositoryProvider)
                      .syncDeposit(widget.entry.gatewayOrderCode!);
                  if (!mounted ||
                      owner != ref.read(authControllerProvider).user?.id) {
                    return;
                  }
                  _refreshFinances(ref);
                  setState(() => _message = 'Trạng thái: ${entry.statusLabel}');
                } catch (error) {
                  if (mounted) setState(() => _message = _error(error));
                } finally {
                  if (mounted) setState(() => _busy = false);
                }
              },
        child: Text(_busy ? 'Đang kiểm tra…' : 'Kiểm tra thanh toán'),
      ),
    ],
  );
}

class _FinanceMoneyForm extends ConsumerStatefulWidget {
  const _FinanceMoneyForm({required this.withdrawal});
  final bool withdrawal;
  @override
  ConsumerState<_FinanceMoneyForm> createState() => _FinanceMoneyFormState();
}

class _FinanceMoneyFormState extends ConsumerState<_FinanceMoneyForm> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController();
  String? _bankId, _errorMessage, _checkoutUrl, _orderCode, _status;
  bool _busy = false;
  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  String _bankName(Map<String, dynamic> bank) {
    final number = '${bank['accountNumber'] ?? ''}';
    return '${bank['bankName'] ?? ''} · ****${number.length > 4 ? number.substring(number.length - 4) : number}';
  }

  @override
  Widget build(BuildContext context) {
    final banks = widget.withdrawal ? ref.watch(providerBanksProvider) : null;
    final wallet = ref.watch(providerWalletProvider);
    final items = banks?.asData?.value ?? <Map<String, dynamic>>[];
    if (_bankId == null && items.isNotEmpty) {
      final bank = items.firstWhere(
        (item) => item['isDefault'] == true,
        orElse: () => items.first,
      );
      _bankId = '${bank['id'] ?? bank['_id']}';
    }
    final validBank = items.any(
      (bank) => '${bank['id'] ?? bank['_id']}' == _bankId,
    );
    return PopScope(
      canPop: !_busy,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.withdrawal ? 'Yêu cầu rút tiền' : 'Nạp ví'),
          leading: BackButton(
            onPressed: _busy ? null : () => Navigator.pop(context),
          ),
        ),
        body: Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (_checkoutUrl == null) ...[
                if (widget.withdrawal) ...[
                  wallet.when(
                    data: (value) =>
                        Text('Số dư khả dụng: ${_money(value.balance)}'),
                    loading: () => const AppLoading(),
                    error: (error, _) => AppMessage(
                      message: _error(error),
                      onRetry: () => ref.invalidate(providerWalletProvider),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                TextFormField(
                  controller: _amount,
                  enabled: !_busy,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(
                    labelText: 'Số tiền (đ)',
                    hintText: 'Nhập số tiền',
                  ),
                  validator: (text) {
                    final amount = double.tryParse(text ?? '');
                    if (amount == null ||
                        !amount.isFinite ||
                        amount <= 0 ||
                        amount > 9007199254740991) {
                      return 'Vui lòng nhập số tiền hợp lệ lớn hơn 0.';
                    }
                    if (widget.withdrawal &&
                        amount > (wallet.asData?.value.balance ?? 0)) {
                      return 'Số tiền vượt quá số dư khả dụng.';
                    }
                    return null;
                  },
                ),
                if (widget.withdrawal) ...[
                  const SizedBox(height: 16),
                  banks!.when(
                    loading: () => const AppLoading(),
                    error: (error, _) => AppMessage(
                      message: _error(error),
                      onRetry: () => ref.invalidate(providerBanksProvider),
                    ),
                    data: (_) => items.isEmpty
                        ? const Text(
                            'Thêm tài khoản ngân hàng để nhận tiền rút.',
                          )
                        : DropdownButtonFormField<String>(
                            initialValue: validBank ? _bankId : null,
                            isExpanded: true,
                            decoration: const InputDecoration(
                              labelText: 'Ngân hàng nhận tiền',
                            ),
                            items: [
                              for (final bank in items)
                                DropdownMenuItem(
                                  value: '${bank['id'] ?? bank['_id']}',
                                  child: Text(_bankName(bank), maxLines: 2),
                                ),
                            ],
                            onChanged: _busy
                                ? null
                                : (value) => setState(() => _bankId = value),
                            validator: (_) => validBank
                                ? null
                                : 'Vui lòng chọn tài khoản ngân hàng.',
                          ),
                  ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () async {
                            await _openBanks(context);
                            if (mounted) ref.invalidate(providerBanksProvider);
                          },
                    child: const Text('Quản lý tài khoản ngân hàng'),
                  ),
                  const Text(
                    'Yêu cầu rút tiền sẽ được gửi để xét duyệt. Trạng thái được cập nhật trong lịch sử rút tiền.',
                  ),
                ] else ...[
                  const SizedBox(height: 16),
                  const Text(
                    'Tạo yêu cầu và thanh toán qua PayOS. Ví chỉ được cộng tiền khi hệ thống xác nhận thanh toán.',
                  ),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed:
                      _busy ||
                          (widget.withdrawal &&
                              (!validBank || !wallet.hasValue))
                      ? null
                      : () => _submit(items),
                  child: Text(_busy ? 'Đang xử lý…' : 'Tiếp tục'),
                ),
              ] else ...[
                _value('Số tiền nạp', _money(double.parse(_amount.text))),
                Text(
                  _status ??
                      'Yêu cầu đã được tạo. Mở PayOS để thanh toán, sau đó quay lại kiểm tra.',
                ),
                const SizedBox(height: 16),
                if (_status != 'Nạp ví thành công.')
                  FilledButton(
                    onPressed: _busy ? null : _launchCheckout,
                    child: const Text('Mở thanh toán PayOS'),
                  ),
                OutlinedButton(
                  onPressed: _busy || _orderCode == null ? null : _sync,
                  child: Text(_busy ? 'Đang kiểm tra…' : 'Kiểm tra thanh toán'),
                ),
              ],
              if (_errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Text(
                    _errorMessage!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _submit(List<Map<String, dynamic>> banks) async {
    if (_busy || !_form.currentState!.validate()) return;
    final amount = double.parse(_amount.text);
    final owner = ref.read(authControllerProvider).user?.id;
    final bank = widget.withdrawal
        ? banks.firstWhere((item) => '${item['id'] ?? item['_id']}' == _bankId)
        : null;
    setState(() {
      _busy = true;
      _errorMessage = null;
    });
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(
          widget.withdrawal ? 'Xác nhận rút tiền' : 'Xác nhận nạp ví',
        ),
        content: Text(
          '${_money(amount)}${bank == null ? '\nThanh toán qua PayOS' : '\n${_bankName(bank)}\n${bank['accountHolderName'] ?? ''}'}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (confirmed != true) {
      setState(() => _busy = false);
      return;
    }
    try {
      if (owner == null || owner != ref.read(authControllerProvider).user?.id) {
        return;
      }
      final repository = ref.read(providerRepositoryProvider);
      if (widget.withdrawal) {
        await repository.withdraw(amount, _bankId!);
        if (!mounted || owner != ref.read(authControllerProvider).user?.id) {
          return;
        }
        _refreshFinances(ref);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã gửi yêu cầu rút tiền để xét duyệt.'),
          ),
        );
        Navigator.pop(context);
      } else {
        final result = await repository.deposit(amount);
        if (!mounted || owner != ref.read(authControllerProvider).user?.id) {
          return;
        }
        final transaction = result['transaction'] as Map?;
        setState(() {
          _checkoutUrl = result['checkoutUrl'] as String?;
          _orderCode = transaction?['gatewayOrderCode']?.toString();
          if (_checkoutUrl == null) {
            _errorMessage =
                'Chưa nhận được liên kết thanh toán. Kiểm tra lịch sử trước khi tạo yêu cầu mới.';
          }
        });
        _refreshFinances(ref);
      }
    } catch (error) {
      if (mounted) setState(() => _errorMessage = _error(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _launchCheckout() async {
    setState(() {
      _busy = true;
      _errorMessage = null;
    });
    try {
      await _launchPayment(ref, _checkoutUrl!);
    } catch (_) {
      if (mounted) {
        setState(
          () => _errorMessage =
              'Không thể mở PayOS. Vui lòng thử mở lại liên kết thanh toán.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sync() async {
    setState(() {
      _busy = true;
      _errorMessage = null;
    });
    final owner = ref.read(authControllerProvider).user?.id;
    try {
      final result = await ref
          .read(providerRepositoryProvider)
          .syncDeposit(_orderCode!);
      if (!mounted || owner != ref.read(authControllerProvider).user?.id) {
        return;
      }
      _refreshFinances(ref);
      setState(
        () => _status = switch (result.status) {
          'success' => 'Nạp ví thành công.',
          'failed' || 'cancelled' =>
            'Thanh toán không thành công. Kiểm tra lịch sử giao dịch để biết chi tiết.',
          _ =>
            'Hệ thống chưa xác nhận thanh toán. Bạn có thể kiểm tra lại sau.',
        },
      );
    } catch (error) {
      if (mounted) setState(() => _errorMessage = _error(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
