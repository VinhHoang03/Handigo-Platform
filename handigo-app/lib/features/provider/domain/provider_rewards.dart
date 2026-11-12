typedef ProviderRewardMilestone = ({int diamonds, int amount});

DateTime providerRewardWeekStart(DateTime date) => DateTime.utc(
  date.year,
  date.month,
  date.day - (date.weekday - DateTime.monday),
);

class ProviderRewardSummary {
  ProviderRewardSummary.fromJson(Map<String, dynamic> json)
    : diamonds = json['diamonds'] as int,
      amount = json['amount'] as int,
      completionRate = json['completionRate'] as num?,
      cancellationRate = json['cancellationRate'] as num?,
      averageRating = json['averageRating'] as num?,
      completionMet = json['completionMet'] as bool,
      cancellationMet = json['cancellationMet'] as bool,
      ratingMet = json['ratingMet'] as bool,
      eligible = json['eligible'] as bool;

  final int diamonds, amount;
  final num? completionRate, cancellationRate, averageRating;
  final bool completionMet, cancellationMet, ratingMet, eligible;
}

class ProviderRewardWeek {
  ProviderRewardWeek.fromJson(Map<String, dynamic> json)
    : weekStart = DateTime.parse('${json['weekStart']}T00:00:00Z'),
      status = json['status'] as String? ?? 'settled',
      programActive = json['programActive'] as bool? ?? true,
      summary = switch (json['summary']) {
        final Map<String, dynamic> value => ProviderRewardSummary.fromJson(
          value,
        ),
        _ => null,
      },
      milestones = [
        for (final item in json['milestones'] as List<dynamic>? ?? const [])
          (diamonds: item['diamonds'] as int, amount: item['amount'] as int),
      ];

  final DateTime weekStart;
  final String status;
  final bool programActive;
  final ProviderRewardSummary? summary;
  final List<ProviderRewardMilestone> milestones;
}

class ProviderRewardHistory {
  ProviderRewardHistory.fromJson(Map<String, dynamic> json)
    : items = [
        for (final item in json['items'] as List<dynamic>)
          ProviderRewardWeek.fromJson(item as Map<String, dynamic>),
      ],
      nextBefore = json['nextBefore'] as String?;

  final List<ProviderRewardWeek> items;
  final String? nextBefore;
}
