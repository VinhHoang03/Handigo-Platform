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
      return AccountDetailScaffold(
        title: _title,
        showBackButton: false,
        actions: [
          IconButton(
            tooltip: 'Tải lại',
            onPressed: () => _refreshFinances(ref),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: SizedBox(
                width: double.infinity,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8EDF3),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: SegmentedButton<int>(
                      style: SegmentedButton.styleFrom(
                        foregroundColor: accountMuted,
                        selectedForegroundColor: Colors.white,
                        selectedBackgroundColor: accountPrimary,
                        side: BorderSide.none,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      segments: const [
                        ButtonSegment(value: 0, label: Text('Thu nhập')),
                        ButtonSegment(value: 1, label: Text('Ví')),
                        ButtonSegment(
                          value: 2,
                          label: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Symbols.military_tech, fill: 1, size: 15),
                              SizedBox(width: 4),
                              Flexible(child: Text('Tiền thưởng')),
                            ],
                          ),
                        ),
                      ],
                      showSelectedIcon: false,
                      selected: {_tab},
                      onSelectionChanged: (value) => _selectTab(value.single),
                    ),
                  ),
                ),
              ),
            ),
            Expanded(child: content),
          ],
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
                AccountDetailSectionTitle(
                  'Thời gian thống kê',
                  subtitle:
                      '${DateFormat('dd/MM/yyyy').format(range.from)} – ${DateFormat('dd/MM/yyyy').format(range.to)}',
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final period in ProviderIncomePeriod.values)
                      ChoiceChip(
                        backgroundColor: accountSurface,
                        selectedColor: accountPrimarySoft,
                        checkmarkColor: accountPrimary,
                        side: const BorderSide(color: accountDivider),
                        labelStyle: TextStyle(
                          color: range.period == period
                              ? accountPrimary
                              : accountMuted,
                        ),
                        label: Text(switch (period) {
                          ProviderIncomePeriod.today => 'Hôm nay',
                          ProviderIncomePeriod.week => 'Tuần này',
                          ProviderIncomePeriod.month => 'Tháng này',
                          ProviderIncomePeriod.year =>
                            range.period == period
                                ? 'Năm ${range.from.year}'
                                : 'Theo năm',
                          ProviderIncomePeriod.customRange =>
                            'Khoảng thời gian',
                        }),
                        selected: range.period == period,
                        onSelected: (_) => onPeriod(period),
                      ),
                  ],
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
                ),
                const SizedBox(height: 20),
                AccountDetailSectionTitle(
                  range.isSingleDay
                      ? 'Thu nhập theo giờ'
                      : range.period == ProviderIncomePeriod.year
                      ? 'Thu nhập theo tháng'
                      : 'Thu nhập theo ngày',
                ),
                const SizedBox(height: 12),
                _IncomeChart(key: ValueKey(range), points: data.chart(range)),
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
                      isThreeLine: true,
                      title: Text(
                        group.primary.orderCode ?? group.primary.typeLabel,
                      ),
                      subtitle: Text(
                        '${_money(group.amount)}\n${_date(group.primary.createdAt)}',
                      ),
                      trailing: const Icon(
                        Icons.chevron_right,
                        color: accountMuted,
                      ),
                      onTap: () => _showIncomeGroup(context, group),
                      leading: Tooltip(
                        message: _money(group.amount),
                        child: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: accountPrimarySoft,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            group.amount >= 0
                                ? Icons.south_west
                                : Icons.north_east,
                            color: group.amount >= 0
                                ? accountPrimary
                                : scheme.error,
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
}

class _IncomeChart extends StatefulWidget {
  const _IncomeChart({required this.points, super.key});
  final List<({String label, double amount})> points;
  @override
  State<_IncomeChart> createState() => _IncomeChartState();
}

class _IncomeChartState extends State<_IncomeChart> {
  int? _selected;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final maxAmount = widget.points.fold<double>(
      1,
      (value, point) => math.max(value, point.amount.abs()),
    );
    return Card(
      margin: EdgeInsets.zero,
      color: accountSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: accountDivider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _selected == null
                  ? 'Chạm vào cột để xem số tiền'
                  : '${widget.points[_selected!].label}: ${_money(widget.points[_selected!].amount)}',
            ),
            const SizedBox(height: 16),
            LayoutBuilder(
              builder: (context, constraints) {
                final width = math.max(
                  48.0,
                  constraints.maxWidth / widget.points.length,
                );
                return SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      for (var index = 0; index < widget.points.length; index++)
                        Semantics(
                          button: true,
                          label:
                              '${widget.points[index].label}, ${_money(widget.points[index].amount)}',
                          child: InkWell(
                            onTap: () => setState(() => _selected = index),
                            child: SizedBox(
                              width: width,
                              child: Column(
                                children: [
                                  SizedBox(
                                    height: 72,
                                    child: Align(
                                      alignment: Alignment.bottomCenter,
                                      child: Container(
                                        width: 22,
                                        height: widget.points[index].amount > 0
                                            ? widget.points[index].amount /
                                                  maxAmount *
                                                  72
                                            : 0,
                                        decoration: BoxDecoration(
                                          color: _selected == index
                                              ? accountInk
                                              : accountPrimary,
                                          borderRadius:
                                              const BorderRadius.vertical(
                                                top: Radius.circular(6),
                                              ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  SizedBox(
                                    width: width,
                                    child: Divider(
                                      height: 1,
                                      color: scheme.outlineVariant,
                                    ),
                                  ),
                                  SizedBox(
                                    height: 30,
                                    child: Align(
                                      alignment: Alignment.topCenter,
                                      child: Container(
                                        width: 22,
                                        height: widget.points[index].amount < 0
                                            ? widget.points[index].amount
                                                      .abs() /
                                                  maxAmount *
                                                  30
                                            : 0,
                                        color: scheme.error,
                                      ),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 6,
                                    ),
                                    child: Text(
                                      widget.points[index].label,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.labelSmall,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
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

class _FinanceWallet extends ConsumerWidget {
  const _FinanceWallet();
  @override
  Widget build(BuildContext context, WidgetRef ref) => RefreshIndicator(
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
                    onBankAccounts: () => _openBanks(context),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Số dư hiện tại của ví, không phụ thuộc bộ lọc thu nhập.',
                  ),
                  const SizedBox(height: 12),
                  _FinanceWalletActions(balance: wallet.balance),
                ],
              ),
            ),
        const SizedBox(height: 24),
        for (final withdrawal in [false, true]) ...[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _section(
                context,
                withdrawal ? 'Yêu cầu rút tiền' : 'Giao dịch gần đây',
              ),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        _FinanceHistoryScreen(withdrawal: withdrawal),
                  ),
                ),
                child: const Text('Xem tất cả'),
              ),
            ],
          ),
          ref
              .watch(providerFinanceHistoryProvider((withdrawal, 1, '')))
              .when(
                loading: () => const AppLoading(),
                error: (error, _) => AppMessage(
                  message: _error(error),
                  onRetry: () => ref.invalidate(
                    providerFinanceHistoryProvider((withdrawal, 1, '')),
                  ),
                ),
                data: (page) => page.items.isEmpty
                    ? AppMessage(
                        message: withdrawal
                            ? 'Chưa có yêu cầu rút tiền.'
                            : 'Chưa có giao dịch ví.',
                      )
                    : Column(
                        children: [
                          for (final entry in page.items.take(5))
                            _FinanceTile(entry: entry),
                        ],
                      ),
              ),
          const SizedBox(height: 16),
        ],
      ],
    ),
  );
}

class _FinanceWalletActions extends ConsumerWidget {
  const _FinanceWalletActions({required this.balance});
  final double balance;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Wrap(
    spacing: 12,
    runSpacing: 8,
    children: [
      FilledButton.icon(
        icon: const Icon(Icons.add),
        label: const Text('Nạp ví'),
        onPressed: () => _openMoneyForm(context, ref, false),
      ),
      OutlinedButton.icon(
        icon: const Icon(Icons.outbound_outlined),
        label: const Text('Yêu cầu rút tiền'),
        onPressed: balance > 0
            ? () => _openMoneyForm(context, ref, true)
            : null,
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
  Widget build(BuildContext context) => Card(
    child: ListTile(
      title: Text(
        entry.description?.isNotEmpty == true
            ? entry.description!
            : entry.typeLabel,
      ),
      subtitle: Text(
        '${_money(entry.amount)} · ${entry.statusLabel}\n${_date(entry.createdAt)}',
      ),
      isThreeLine: true,
      leading: Icon(
        entry.direction == 'out' ? Icons.north_east : Icons.south_west,
      ),
      trailing: const Icon(Icons.chevron_right),
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
                  const Text('Khoản ghi nhận này không làm thay đổi số dư ví.'),
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
