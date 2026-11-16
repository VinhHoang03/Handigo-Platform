import 'package:flutter/material.dart';
import '../../orders/domain/order_summary.dart';
import '../../orders/presentation/order_screens.dart';
import 'provider_assignment_customer_info.dart';

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
                  color: Theme.of(context).brightness == Brightness.light
                      ? Colors.black
                      : scheme.onSurface,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ],
      ),
      onSelected: (_) => onSelected(),
      materialTapTargetSize: MaterialTapTargetSize.padded,
    );
  }
}

class ProviderHistoryOrderCard extends StatefulWidget {
  const ProviderHistoryOrderCard({required this.order, super.key});
  final OrderSummary order;

  @override
  State<ProviderHistoryOrderCard> createState() =>
      _ProviderHistoryOrderCardState();
}

class _ProviderHistoryOrderCardState extends State<ProviderHistoryOrderCard> {
  bool _noticeOpen = false;

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final measures = order.serviceType == 'variable_price';
    final immediateActive =
        order.scheduledAt == null &&
        !const {'completed', 'cancelled'}.contains(order.status);
    final amber = Colors.amber.shade800;
    final infoChildren = <Widget>[
      if (measures) ProviderOrderDistance(order: order),
      if (immediateActive && _noticeOpen)
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: Text(
            'Cần thực hiện ngay: đây là đơn đặt ngay bây giờ.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: amber),
          ),
        ),
    ];
    final leading = <Widget>[
      if (measures) ProviderOrderDistanceSpinner(order: order),
      if (immediateActive)
        IconButton(
          tooltip: 'Cần thực hiện ngay',
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
          onPressed: () => setState(() => _noticeOpen = !_noticeOpen),
          icon: Icon(Icons.warning_amber_rounded, color: amber, size: 22),
        ),
    ];
    return OrderSummaryCard(
      order: order,
      providerView: true,
      statusLeading: leading.isEmpty
          ? null
          : Row(mainAxisSize: MainAxisSize.min, children: leading),
      providerInfo: infoChildren.isEmpty
          ? null
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: infoChildren,
            ),
    );
  }
}
