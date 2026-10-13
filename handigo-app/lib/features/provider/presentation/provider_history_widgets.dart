import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/service_images.dart';
import '../../orders/domain/order_summary.dart';
import '../../orders/presentation/order_screens.dart';

class ProviderHistoryFilter extends StatelessWidget {
  const ProviderHistoryFilter({
    required this.label,
    required this.count,
    required this.selected,
    required this.onSelected,
    super.key,
  });
  final String label;
  final int? count;
  final bool selected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ChoiceChip(
      selected: selected,
      showCheckmark: false,
      backgroundColor: scheme.surfaceContainer,
      selectedColor: scheme.primaryContainer,
      side: BorderSide.none,
      shape: const StadiumBorder(),
      labelPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label),
          if (count != null) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: selected
                    ? scheme.onPrimary
                    : scheme.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  color: selected ? scheme.primary : scheme.onSurfaceVariant,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
      labelStyle: TextStyle(
        color: selected ? scheme.onPrimary : scheme.onSurfaceVariant,
        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
      ),
      onSelected: (_) => onSelected(),
      materialTapTargetSize: MaterialTapTargetSize.padded,
    );
  }
}

class ProviderHistoryOrderCard extends StatelessWidget {
  const ProviderHistoryOrderCard({required this.order, super.key});
  final OrderSummary order;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final (background, foreground, statusIcon) = switch (order.status) {
      'completed' => (
        scheme.secondaryContainer,
        scheme.onSecondaryContainer,
        Icons.check_circle_outline,
      ),
      'cancelled' => (
        scheme.errorContainer,
        scheme.onErrorContainer,
        Icons.cancel_outlined,
      ),
      'in_progress' => (
        scheme.tertiaryFixed,
        scheme.onTertiaryFixedVariant,
        Icons.handyman_outlined,
      ),
      _ => (
        scheme.primaryFixed,
        scheme.onPrimaryFixedVariant,
        Icons.schedule_outlined,
      ),
    };
    final (action, actionIcon) = switch (order.status) {
      'accepted' => ('Xem lịch hẹn', Icons.event_note_outlined),
      'in_progress' => ('Xem tiến trình', Icons.visibility_outlined),
      'completed' => ('Xem kết quả', Icons.task_alt),
      'cancelled' => ('Xem chi tiết hủy', Icons.info_outline),
      _ => ('Xem chi tiết', Icons.receipt_long_outlined),
    };
    void openDetail() => context.push('/provider/orders/${order.id}');
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: openDetail,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    order.code,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: scheme.onSurfaceVariant,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: background,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(statusIcon, size: 14, color: foreground),
                        const SizedBox(width: 5),
                        Text(
                          orderStatusLabel(order.status),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: foreground,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Divider(
                  height: 1,
                  color: scheme.outlineVariant.withValues(alpha: .4),
                ),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 72,
                    height: 72,
                    child: ServiceCoverImage(
                      url: order.serviceImage,
                      name: order.serviceName,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          order.serviceName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          order.scheduledAt == null
                              ? 'Chưa có lịch hẹn'
                              : DateFormat(
                                  'HH:mm · dd/MM/yyyy',
                                ).format(order.scheduledAt!.toLocal()),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                        if (order.totalAmount != null) ...[
                          const SizedBox(height: 6),
                          Text(
                            '${NumberFormat.decimalPattern('vi_VN').format(order.totalAmount)}đ',
                            style: theme.textTheme.titleMedium?.copyWith(
                              color: scheme.primary,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              if (order.customerName?.isNotEmpty == true ||
                  order.addressLabel?.isNotEmpty == true) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: scheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (order.customerName?.isNotEmpty == true)
                        Row(
                          children: [
                            ClipOval(
                              child: SizedBox(
                                width: 32,
                                height: 32,
                                child:
                                    usableMediaUrl(order.customerAvatar) == null
                                    ? Icon(
                                        Icons.person_outline,
                                        color: scheme.secondary,
                                      )
                                    : Image.network(
                                        usableMediaUrl(order.customerAvatar)!,
                                        fit: BoxFit.cover,
                                        semanticLabel: 'Ảnh khách hàng',
                                        errorBuilder: (_, error, stack) => Icon(
                                          Icons.person_outline,
                                          color: scheme.secondary,
                                        ),
                                      ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                order.customerName!,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      if (order.addressLabel?.isNotEmpty == true) ...[
                        if (order.customerName?.isNotEmpty == true)
                          const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.location_on_outlined,
                              size: 16,
                              color: scheme.secondary,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                order.addressLabel!,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: scheme.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor:
                        order.status == 'accepted' ||
                            order.status == 'in_progress'
                        ? scheme.primaryContainer
                        : scheme.surfaceContainerHigh,
                    foregroundColor:
                        order.status == 'accepted' ||
                            order.status == 'in_progress'
                        ? scheme.onPrimary
                        : scheme.primary,
                    minimumSize: const Size(0, 48),
                  ),
                  onPressed: openDetail,
                  icon: Icon(actionIcon, size: 18),
                  label: Text(action),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
