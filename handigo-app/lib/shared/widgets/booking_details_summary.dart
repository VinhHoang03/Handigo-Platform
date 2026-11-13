import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class BookingDetailsSummary extends StatelessWidget {
  const BookingDetailsSummary({
    required this.address,
    this.contact,
    this.scheduledAt,
    this.placedAt,
    this.isPreview = false,
    this.compact = false,
    this.showAddress = true,
    this.providerName,
    this.options = const [],
    this.quantity,
    this.serviceName,
    super.key,
  });

  final String address;
  final String? contact, providerName;
  final DateTime? scheduledAt, placedAt;
  final bool isPreview, compact, showAddress;
  final List<({String name, int quantity})> options;
  final int? quantity;
  final String? serviceName;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    String date(DateTime value) =>
        DateFormat('HH:mm · dd/MM/yyyy').format(value.toLocal());
    Widget field(IconData icon, String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isPreview)
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: .08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: theme.colorScheme.primary, size: 20),
            )
          else
            Icon(icon, color: theme.colorScheme.primary, size: 20),
          SizedBox(width: isPreview ? 12 : 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: isPreview ? FontWeight.w600 : null,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    Widget timeField(IconData icon, String label, DateTime value) => compact
        ? Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Icon(icon, color: theme.colorScheme.primary, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '$label: ',
                          style: TextStyle(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        TextSpan(
                          text: date(value),
                          style: const TextStyle(fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                    style: theme.textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
          )
        : field(icon, label, date(value));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (isPreview) ...[
          if (serviceName != null)
            field(Icons.home_repair_service_outlined, 'Dịch vụ', serviceName!),
          if (quantity != null)
            field(Icons.numbers_rounded, 'Số lượng', '$quantity'),
          if (scheduledAt != null)
            timeField(Icons.calendar_month_outlined, 'Thời gian', scheduledAt!),
          if (placedAt != null)
            timeField(
              Icons.access_time_rounded,
              'Thời gian đặt dự kiến',
              placedAt!,
            ),
        ],
        if (!showAddress)
          const SizedBox.shrink()
        else if (compact)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.location_on_outlined,
                  size: 20,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(address, style: theme.textTheme.bodyMedium),
                ),
              ],
            ),
          )
        else
          field(
            Icons.location_on_outlined,
            'Địa chỉ thực hiện',
            [if (contact?.isNotEmpty == true) contact!, address].join('\n'),
          ),
        if (!isPreview && scheduledAt != null)
          timeField(Icons.calendar_month_outlined, 'Lịch hẹn', scheduledAt!),
        if (!isPreview && placedAt != null)
          timeField(
            Icons.access_time_rounded,
            isPreview ? 'Thời gian đặt dự kiến' : 'Thời gian đặt',
            placedAt!,
          ),
        if (isPreview)
          field(
            Icons.person_search_outlined,
            'Điều phối chuyên gia',
            providerName?.isNotEmpty == true
                ? 'Yêu cầu trực tiếp $providerName'
                : 'Hệ thống tự động tìm chuyên gia phù hợp',
          )
        else if (providerName?.isNotEmpty == true)
          field(
            Icons.person_outline_rounded,
            isPreview ? 'Thợ đã chọn' : 'Thợ thực hiện',
            providerName!,
          ),
        if (options.isNotEmpty) ...[
          const Divider(height: 24),
          Text('Tùy chọn đã chọn', style: theme.textTheme.titleMedium),
          for (final option in options)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(option.name)),
                  const SizedBox(width: 12),
                  Text(
                    '× ${option.quantity}',
                    style: theme.textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
        ],
        if (!isPreview && quantity != null)
          field(Icons.numbers_rounded, 'Số lượng', '$quantity'),
      ],
    );
  }
}
