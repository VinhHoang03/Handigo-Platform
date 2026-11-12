import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../shared/widgets/account_overview_widgets.dart';
import '../../../shared/widgets/app_states.dart';
import '../domain/provider_income.dart';
import '../domain/provider_rewards.dart';
import 'provider_screens.dart';
import 'provider_reward_week_sheet.dart';

final providerRewardWeekProvider = FutureProvider.autoDispose
    .family<ProviderRewardWeek, String>(retry: (_, _) => null, (ref, week) {
      ref.watch(authControllerProvider.select((auth) => auth.user?.id));
      return ref.watch(providerRepositoryProvider).rewardWeek(week);
    });
final providerRewardHistoryProvider = FutureProvider.autoDispose
    .family<ProviderRewardHistory, String?>(retry: (_, _) => null, (
      ref,
      before,
    ) {
      ref.watch(authControllerProvider.select((auth) => auth.user?.id));
      return ref.watch(providerRepositoryProvider).rewardHistory(before);
    });

final _amountFormat = NumberFormat.decimalPattern('vi_VN');
final _rateFormat = NumberFormat('0.##', 'vi_VN');
const _rewardSuccess = Color(0xFF087E65);
const _rewardAmber = Color(0xFF9B4808);

class ProviderRewardsTab extends ConsumerStatefulWidget {
  const ProviderRewardsTab({
    required this.now,
    required this.active,
    super.key,
  });

  final DateTime Function() now;
  final bool active;

  @override
  ConsumerState<ProviderRewardsTab> createState() => _ProviderRewardsTabState();
}

class _ProviderRewardsTabState extends ConsumerState<ProviderRewardsTab> {
  DateTime? _selectedWeek;

  Future<void> _chooseWeek(DateTime today, DateTime monday) async {
    final chosen = await showProviderRewardWeekSheet(
      context,
      today: today,
      selectedWeek: monday,
    );
    if (chosen == null || !mounted) return;
    setState(() {
      _selectedWeek = chosen == providerRewardWeekStart(today) ? null : chosen;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) return const SizedBox.shrink();
    final today = vietnamDateTime(widget.now());
    final currentWeek = providerRewardWeekStart(today);
    final selectedWeek = _selectedWeek;
    final monday = selectedWeek != null && selectedWeek.isBefore(currentWeek)
        ? selectedWeek
        : currentWeek;
    final sunday = monday.add(const Duration(days: 6));
    final nextMonday = monday.add(const Duration(days: 7));
    final date = DateFormat('dd/MM');
    final weekKey = DateFormat('yyyy-MM-dd').format(monday);
    final state = ref.watch(providerRewardWeekProvider(weekKey));
    final week = state.asData?.value;

    return ListView(
      key: const PageStorageKey('provider-rewards'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 8, 4),
            child: Row(
              children: [
                const Icon(
                  Symbols.calendar_month,
                  color: accountPrimary,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${monday == currentWeek ? 'Tuần này' : 'Tuần đã chọn'} · '
                    '${date.format(monday)} – ${date.format(sunday)}',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                TextButton.icon(
                  style: TextButton.styleFrom(
                    backgroundColor: accountPrimarySoft,
                    foregroundColor: AppTheme.primary,
                  ),
                  onPressed: () => _chooseWeek(today, monday),
                  label: const Text('Đổi tuần'),
                  icon: const Icon(Symbols.expand_more, size: 18),
                  iconAlignment: IconAlignment.end,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (state.hasError)
          AppMessage(
            message: 'Không tải được dữ liệu thưởng tuần.',
            onRetry: () => ref.invalidate(providerRewardWeekProvider(weekKey)),
          )
        else if (week == null)
          const Padding(padding: EdgeInsets.all(24), child: AppLoading())
        else ...[
          _RewardWeekCard(settlementDate: date.format(nextMonday), week: week),
          const SizedBox(height: 16),
          _RewardMilestones(
            milestones: week.milestones,
            summary: week.summary,
            showNext: week.status == 'open',
          ),
          const SizedBox(height: 16),
          _RewardConditions(summary: week.summary),
        ],
        const SizedBox(height: 16),
        Card(
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
          child: ListTile(
            leading: const _RewardIcon(Symbols.policy),
            title: const Text(
              'Xem chính sách thưởng',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
            ),
            trailing: const Icon(Symbols.chevron_right, size: 20),
            onTap: () => _open(
              context,
              _RewardPolicyScreen(milestones: week?.milestones ?? const []),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Card(
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
          child: ListTile(
            leading: const _RewardIcon(Symbols.history),
            title: const Text(
              'Lịch sử thưởng theo tuần',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
            ),
            trailing: const Icon(Symbols.chevron_right, size: 20),
            onTap: () => _open(context, const _RewardHistoryScreen()),
          ),
        ),
      ],
    );
  }

  void _open(BuildContext context, Widget page) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
  }
}

class _RewardWeekCard extends StatelessWidget {
  const _RewardWeekCard({required this.settlementDate, required this.week});

  final String settlementDate;
  final ProviderRewardWeek week;

  @override
  Widget build(BuildContext context) {
    final typography = Theme.of(context).textTheme;
    final summary = week.summary;
    final diamonds = summary?.diamonds;
    final amount = summary?.amount;
    final milestones = week.milestones;
    final reached = diamonds == null
        ? 0
        : milestones
              .where((milestone) => diamonds >= milestone.diamonds)
              .length;
    final next = reached < milestones.length ? milestones[reached] : null;
    final target = next ?? (milestones.isEmpty ? null : milestones.last);
    final progress = diamonds == null || target == null
        ? null
        : (diamonds / target.diamonds).clamp(0.0, 1.0);
    final status = switch (week.status) {
      'settled' when amount != null && amount > 0 =>
        'Đã cộng tiền thưởng vào Ví Handigo.',
      'settled' when summary?.eligible == false =>
        'Tuần này chưa đủ điều kiện nhận thưởng.',
      'settled' => 'Tuần này chưa đạt mốc thưởng.',
      'pending' => 'Đang chờ chốt thưởng.',
      'inactive' => 'Tuần này chưa áp dụng chương trình thưởng.',
      _ when summary?.eligible == true => 'Đang đạt các điều kiện nhận thưởng.',
      _ => 'Chưa đạt đủ điều kiện nhận thưởng.',
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppTheme.surfaceContainerLow,
            Colors.white,
            accountPrimarySoft,
          ],
        ),
        border: Border.all(color: AppTheme.primaryFixed),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _RewardMetric(
                      label: 'Kim cương',
                      value: diamonds == null
                          ? '—'
                          : _amountFormat.format(diamonds),
                      caption: diamonds == null ? null : 'Đã tích lũy tuần',
                      icon: Symbols.diamond,
                      color: Color(0xFF0284C7),
                      background: Color(0xFFF1F8FB),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _RewardMetric(
                      label: week.status == 'settled'
                          ? 'Thưởng đã chốt'
                          : 'Thưởng tạm tính',
                      value: amount == null
                          ? '—'
                          : '${_amountFormat.format(amount)} ₫',
                      caption: diamonds == null || milestones.isEmpty
                          ? null
                          : 'Đạt $reached/${milestones.length} mốc thưởng',
                      emphasizeCaption: true,
                      icon: Symbols.payments,
                      color: AppTheme.primary,
                      background: AppTheme.surfaceContainerLow,
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 24, color: accountDivider),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Symbols.flag,
                        color: AppTheme.primary,
                        size: 18,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          target == null
                              ? 'Tiến độ'
                              : 'Tiến trình đạt mốc ${next == null ? milestones.length : reached + 1}',
                          style: typography.titleSmall?.copyWith(
                            color: accountInk.withValues(alpha: .8),
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Align(
                    alignment: Alignment.topRight,
                    child: Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 5,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          '${diamonds ?? '—'} / ${target?.diamonds ?? '—'}',
                          style: typography.titleSmall?.copyWith(
                            color: accountInk,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Text('💎', style: TextStyle(fontSize: 13)),
                        if (progress != null)
                          Text(
                            '(${(progress * 100).floor()}%)',
                            style: typography.labelLarge?.copyWith(
                              color: AppTheme.primary,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: ColoredBox(
                color: const Color(0xFFE8EDF3),
                child: SizedBox(
                  height: 8,
                  width: double.infinity,
                  child: FractionallySizedBox(
                    alignment: Alignment.centerLeft,
                    widthFactor: progress ?? 0,
                    child: const DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.all(Radius.circular(8)),
                        gradient: LinearGradient(
                          colors: [AppTheme.primaryDark, Color(0xFF7C3AED)],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Symbols.schedule,
                        color: accountMuted.withValues(alpha: .65),
                        size: 14,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Chốt: 00:00 Thứ Hai, $settlementDate',
                          style: typography.bodySmall?.copyWith(
                            color: accountMuted.withValues(alpha: .65),
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (diamonds != null &&
                    next != null &&
                    week.status == 'open') ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Symbols.bolt,
                          fill: 1,
                          size: 16,
                          color: _rewardAmber,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            'Còn ${next.diamonds - diamonds} 💎 để nhận thêm '
                            '+${_amountFormat.format(next.amount)} ₫',
                            style: typography.bodySmall?.copyWith(
                              color: _rewardAmber,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
            if (week.status != 'open') ...[
              const SizedBox(height: 10),
              Text(
                status,
                style: typography.bodySmall?.copyWith(color: accountMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RewardMetric extends StatelessWidget {
  const _RewardMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.background,
    this.caption,
    this.emphasizeCaption = false,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color background;
  final String? caption;
  final bool emphasizeCaption;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: background,
      border: Border.all(color: color.withValues(alpha: .12)),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, fill: 1, size: 17, color: color),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontSize: 10.5,
                    color: color,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Flexible(
                child: Text(
                  value,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontSize: 28,
                    color: emphasizeCaption ? color : accountInk,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (!emphasizeCaption) ...[
                const SizedBox(width: 4),
                const Text('💎', style: TextStyle(fontSize: 16)),
              ],
            ],
          ),
          if (caption case final caption?) ...[
            const SizedBox(height: 6),
            if (emphasizeCaption)
              _RewardBadge(caption, color: AppTheme.primary)
            else
              Text(
                caption,
                style: Theme.of(
                  context,
                ).textTheme.labelSmall?.copyWith(color: accountMuted),
              ),
          ],
        ],
      ),
    ),
  );
}

class _RewardPolicyScreen extends StatelessWidget {
  const _RewardPolicyScreen({required this.milestones});

  final List<ProviderRewardMilestone> milestones;

  @override
  Widget build(BuildContext context) => AccountDetailScaffold(
    title: 'Chính sách thưởng',
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
      children: [
        const _RewardCard(
          title: 'Cách nhận kim cương',
          icon: Symbols.diamond,
          children: [
            Text('Đơn giá cố định'),
            _RewardRow('Dưới 150.000 ₫', '10 kim cương'),
            _RewardRow('Từ 150.000 ₫ đến dưới 250.000 ₫', '15 kim cương'),
            _RewardRow('Từ 250.000 ₫ trở lên', '20 kim cương'),
            _RewardRow('Đơn cần báo giá', '10 kim cương'),
            SizedBox(height: 8),
            Text(
              'Mỗi đơn được tính một lần sau khi hoàn thành và xác nhận '
              'thanh toán. Đơn giá cố định tính theo giá dịch vụ đã chốt '
              'trước khi trừ voucher.',
            ),
          ],
        ),
        const SizedBox(height: 12),
        const _RewardCard(
          title: 'Điều kiện nhận tiền',
          icon: Symbols.fact_check,
          children: [
            Text(
              'Trong tuần, thợ cần đạt cả ba điều kiện: hoàn thành ít nhất '
              '90% số đơn, hủy tối đa 10% số đơn và có điểm đánh giá '
              'trung bình từ 4,8 sao.',
            ),
            SizedBox(height: 8),
            Text(
              'Tỷ lệ tính trên các đơn hoàn thành và đơn do thợ hủy trong tuần. '
              'Điểm sao tính theo đánh giá khách gửi trong tuần. '
              'Tuần chưa có đánh giá chưa đủ điều kiện.',
            ),
          ],
        ),
        if (milestones.isNotEmpty) ...[
          const SizedBox(height: 12),
          _RewardMilestones(milestones: milestones),
        ],
        const SizedBox(height: 12),
        const _RewardCard(
          title: 'Chốt thưởng theo tuần',
          icon: Symbols.calendar_month,
          children: [
            Text(
              'Tuần tính từ 00:00 thứ Hai đến trước 00:00 thứ Hai kế tiếp '
              'theo giờ Việt Nam. Khi chốt tuần, tiền từ các mốc đã đạt '
              'được cộng dồn và chuyển vào Ví Handigo nếu đủ điều kiện. '
              'Tuần mới bắt đầu với 0 kim cương.',
            ),
          ],
        ),
      ],
    ),
  );
}

class _RewardMilestones extends StatelessWidget {
  const _RewardMilestones({
    required this.milestones,
    this.summary,
    this.showNext = false,
  });

  final List<ProviderRewardMilestone> milestones;
  final ProviderRewardSummary? summary;
  final bool showNext;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const _RewardSectionHeading(
        'Mốc thưởng',
        trailing: Text(
          'Thưởng cộng dồn theo tuần',
          style: TextStyle(color: accountMuted),
        ),
      ),
      ...milestones.indexed.map((entry) {
        final (index, milestone) = entry;
        final diamonds = summary?.diamonds;
        final reached = diamonds != null && diamonds >= milestone.diamonds;
        final isNext =
            showNext &&
            diamonds != null &&
            !reached &&
            (index == 0 || diamonds >= milestones[index - 1].diamonds);
        final tile = ListTile(
          leading: _RewardIcon(
            reached
                ? Symbols.check_circle
                : isNext
                ? Symbols.radio_button_unchecked
                : Symbols.military_tech,
            fill: reached ? 1 : 0,
            color: reached ? _rewardSuccess : AppTheme.primary,
            background: reached ? const Color(0xFFE6F8F0) : accountPrimarySoft,
          ),
          title: Wrap(
            spacing: 5,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                'Mốc ${index + 1}: ${milestone.diamonds}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
                semanticsLabel:
                    'Mốc ${index + 1} · ${milestone.diamonds} kim cương',
              ),
              const Text('💎', style: TextStyle(fontSize: 13)),
            ],
          ),
          subtitle: Text(
            '+${_amountFormat.format(milestone.amount)} ₫',
            style: TextStyle(
              fontSize: 12.5,
              color: reached ? _rewardSuccess : AppTheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          trailing: reached
              ? const _RewardBadge(
                  'ĐÃ ĐẠT',
                  color: _rewardSuccess,
                  icon: Symbols.done,
                )
              : isNext
              ? _RewardBadge(
                  'CÒN ${milestone.diamonds - diamonds} 💎',
                  color: _rewardAmber,
                  icon: Symbols.trending_up,
                )
              : null,
        );
        return Card(
          clipBehavior: Clip.antiAlias,
          shape: isNext
              ? RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                  side: BorderSide(
                    color: AppTheme.primary.withValues(alpha: .38),
                    width: 2,
                  ),
                )
              : null,
          margin: EdgeInsets.only(
            bottom: index == milestones.length - 1 ? 0 : 8,
          ),
          child: isNext
              ? Stack(
                  children: [
                    tile,
                    const Positioned.fill(
                      right: null,
                      child: SizedBox(
                        width: 5,
                        child: ColoredBox(color: AppTheme.primary),
                      ),
                    ),
                  ],
                )
              : tile,
        );
      }),
    ],
  );
}

class _RewardConditions extends StatelessWidget {
  const _RewardConditions({required this.summary});

  final ProviderRewardSummary? summary;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _RewardSectionHeading(
        'Điều kiện nhận thưởng',
        trailing: switch (summary) {
          final summary? => _RewardBadge(
            summary.eligible ? 'Đủ điều kiện' : 'Chưa đủ điều kiện',
            color: summary.eligible ? AppTheme.primary : accountMuted,
            filled: summary.eligible,
            icon: summary.eligible ? Symbols.verified : Symbols.info,
          ),
          _ => null,
        },
      ),
      Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            children: [
              _ConditionTile(
                Symbols.task_alt,
                'Tỷ lệ hoàn thành đơn',
                '≥ 90%',
                value: summary?.completionRate,
                met: summary?.completionMet,
                unit: '%',
              ),
              _ConditionTile(
                Symbols.cancel_presentation,
                'Tỷ lệ hủy đơn',
                '≤ 10%',
                value: summary?.cancellationRate,
                met: summary?.cancellationMet,
                unit: '%',
              ),
              _ConditionTile(
                Symbols.star,
                'Đánh giá sao trung bình',
                '≥ 4,8 sao',
                value: summary?.averageRating,
                met: summary?.ratingMet,
                unit: ' sao',
                iconColor: Color(0xFF986000),
                iconBackground: Color(0xFFFFF4D4),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}

class _RewardSectionHeading extends StatelessWidget {
  const _RewardSectionHeading(this.title, {this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 8,
        runSpacing: 5,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.circle, size: 8, color: AppTheme.primary),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: accountInk,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          ?trailing,
        ],
      ),
    ),
  );
}

class _RewardBadge extends StatelessWidget {
  const _RewardBadge(
    this.label, {
    required this.color,
    this.icon,
    this.filled = false,
  });

  final String label;
  final Color color;
  final IconData? icon;
  final bool filled;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: filled ? color : color.withValues(alpha: .09),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Wrap(
        spacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          if (icon case final icon?)
            Icon(
              icon,
              fill: filled ? 1 : 0,
              size: 14,
              color: filled ? Colors.white : color,
            ),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: filled ? Colors.white : color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    ),
  );
}

class _ConditionTile extends StatelessWidget {
  const _ConditionTile(
    this.icon,
    this.label,
    this.threshold, {
    required this.value,
    required this.met,
    required this.unit,
    this.iconColor = AppTheme.primary,
    this.iconBackground = accountPrimarySoft,
  });

  final IconData icon;
  final String label;
  final String threshold;
  final num? value;
  final bool? met;
  final String unit;
  final Color iconColor;
  final Color iconBackground;

  @override
  Widget build(BuildContext context) {
    final type = Theme.of(context).textTheme;
    final stateColor = met == true ? _rewardSuccess : accountDanger;
    final details = Row(
      children: [
        _RewardIcon(
          icon,
          color: iconColor,
          background: iconBackground,
          fill: icon == Symbols.star ? 1 : 0,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: type.bodySmall?.copyWith(
                  fontSize: 13,
                  color: accountInk,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Tiêu chuẩn: $threshold',
                style: type.bodySmall?.copyWith(
                  fontSize: 11,
                  color: accountMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
    final result = value == null
        ? const Text('—', semanticsLabel: 'Chưa có dữ liệu')
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${_rateFormat.format(value!)}${icon == Symbols.star ? '' : unit}',
                        style: type.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: icon == Symbols.star
                              ? _rewardAmber
                              : stateColor,
                        ),
                      ),
                      if (icon == Symbols.star)
                        const Icon(
                          Symbols.star,
                          fill: 1,
                          size: 14,
                          color: _rewardAmber,
                        ),
                    ],
                  ),
                  Text(
                    met == true ? 'Đạt chuẩn' : 'Chưa đạt',
                    style: type.labelSmall?.copyWith(
                      fontSize: 10,
                      color: stateColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              Icon(
                met == true ? Symbols.check_circle : Symbols.info,
                fill: met == true ? 1 : 0,
                size: 18,
                color: stateColor,
              ),
            ],
          );
    return Container(
      margin: const EdgeInsets.all(3),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 290 ||
              MediaQuery.textScalerOf(context).scale(13) > 18) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                details,
                const SizedBox(height: 6),
                Align(alignment: Alignment.centerRight, child: result),
              ],
            );
          }
          return Row(
            children: [
              Expanded(child: details),
              const SizedBox(width: 8),
              result,
            ],
          );
        },
      ),
    );
  }
}

class _RewardHistoryScreen extends ConsumerStatefulWidget {
  const _RewardHistoryScreen();

  @override
  ConsumerState<_RewardHistoryScreen> createState() =>
      _RewardHistoryScreenState();
}

class _RewardHistoryScreenState extends ConsumerState<_RewardHistoryScreen> {
  final _pages = <String?>[null];

  @override
  Widget build(BuildContext context) {
    final provider = providerRewardHistoryProvider(_pages.last);
    final date = DateFormat('dd/MM/yyyy');
    return AccountDetailScaffold(
      title: 'Lịch sử thưởng',
      child: ref
          .watch(provider)
          .when(
            loading: () => const AppLoading(),
            error: (_, _) => AppMessage(
              message: 'Không tải được lịch sử thưởng.',
              onRetry: () => ref.invalidate(provider),
            ),
            data: (history) => history.items.isEmpty
                ? const AppMessage(
                    message: 'Chưa có tuần thưởng nào được chốt.',
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    children: [
                      for (final week in history.items)
                        Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: const _RewardIcon(Symbols.calendar_month),
                            title: Text(
                              '${date.format(week.weekStart)} – ${date.format(week.weekStart.add(const Duration(days: 6)))}',
                            ),
                            subtitle: Text(switch (week.summary) {
                              final summary? when summary.amount > 0 =>
                                '${summary.diamonds} kim cương · Đã cộng ${_amountFormat.format(summary.amount)} ₫ vào ví',
                              final summary? when summary.eligible =>
                                '${summary.diamonds} kim cương · Chưa đạt mốc',
                              final summary? =>
                                '${summary.diamonds} kim cương · Chưa đủ điều kiện',
                              _ => 'Chưa có dữ liệu',
                            }),
                          ),
                        ),
                      Wrap(
                        alignment: WrapAlignment.end,
                        children: [
                          if (_pages.length > 1)
                            TextButton(
                              onPressed: () => setState(_pages.removeLast),
                              child: const Text('Trang trước'),
                            ),
                          if (history.nextBefore case final next?)
                            TextButton(
                              onPressed: () => setState(() => _pages.add(next)),
                              child: const Text('Trang sau'),
                            ),
                        ],
                      ),
                    ],
                  ),
          ),
    );
  }
}

class _RewardCard extends StatelessWidget {
  const _RewardCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final List<Widget> children;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Card(
    color: accountSurface,
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _RewardIcon(icon),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: accountInk,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    ),
  );
}

class _RewardRow extends StatelessWidget {
  const _RewardRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      children: [
        Expanded(flex: 3, child: Text(label)),
        const SizedBox(width: 12),
        Flexible(
          flex: 2,
          child: Align(
            alignment: Alignment.centerRight,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: accountPrimarySoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                child: Text(
                  value,
                  textAlign: TextAlign.end,
                  style: const TextStyle(
                    color: accountPrimary,
                    fontWeight: FontWeight.w700,
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

class _RewardIcon extends StatelessWidget {
  const _RewardIcon(
    this.icon, {
    this.color = AppTheme.primary,
    this.background = accountPrimarySoft,
    this.fill = 0,
  });

  final IconData icon;
  final Color color;
  final Color background;
  final double fill;

  @override
  Widget build(BuildContext context) => Container(
    width: 36,
    height: 36,
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(11),
      border: Border.all(color: color.withValues(alpha: .12)),
    ),
    child: Icon(icon, fill: fill, color: color, size: 20, opticalSize: 24),
  );
}
