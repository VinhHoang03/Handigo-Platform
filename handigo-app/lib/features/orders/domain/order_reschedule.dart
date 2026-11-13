class OrderReschedulePreview {
  const OrderReschedulePreview({
    required this.approvalRequired,
    required this.warningRequired,
    required this.providerMonthlyAppliedCount,
  });

  factory OrderReschedulePreview.fromJson(Map<String, dynamic> json) =>
      OrderReschedulePreview(
        approvalRequired: json['approvalRequired'] == true,
        warningRequired: json['warningRequired'] == true,
        providerMonthlyAppliedCount:
            (json['providerMonthlyAppliedCount'] as num?)?.toInt() ?? 0,
      );

  final bool approvalRequired, warningRequired;
  final int providerMonthlyAppliedCount;
}

class OrderRescheduleEligibility {
  const OrderRescheduleEligibility({
    required this.canRequest,
    required this.remainingCount,
    required this.minAdvanceMinutes,
  });

  factory OrderRescheduleEligibility.fromJson(Map<String, dynamic> json) =>
      OrderRescheduleEligibility(
        canRequest: json['canRequest'] == true,
        remainingCount: (json['remainingCount'] as num?)?.toInt() ?? 0,
        minAdvanceMinutes: (json['minAdvanceMinutes'] as num?)?.toInt() ?? 0,
      );

  final bool canRequest;
  final int remainingCount, minAdvanceMinutes;
}

class OrderRescheduleRequest {
  const OrderRescheduleRequest({
    required this.id,
    required this.status,
    required this.initiatorRole,
    this.approvalRole,
    this.oldScheduledAt,
    this.proposedScheduledAt,
    this.expiresAt,
    this.reason,
  });

  factory OrderRescheduleRequest.fromJson(Map<String, dynamic> json) =>
      OrderRescheduleRequest(
        id: (json['_id'] ?? json['id']) as String,
        status: json['status'] as String,
        initiatorRole: json['initiatorRole'] as String,
        approvalRole: json['approvalRole'] as String?,
        oldScheduledAt: _parseDate(json['oldScheduledAt']),
        proposedScheduledAt: _parseDate(json['proposedScheduledAt']),
        expiresAt: _parseDate(json['expiresAt']),
        reason: json['reason'] as String?,
      );

  final String id, status, initiatorRole;
  final String? approvalRole, reason;
  final DateTime? oldScheduledAt, proposedScheduledAt, expiresAt;
}

DateTime? _parseDate(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;
