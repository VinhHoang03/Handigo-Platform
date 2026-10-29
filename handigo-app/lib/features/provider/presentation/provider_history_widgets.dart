import 'package:flutter/material.dart';
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

class ProviderHistoryOrderCard extends StatelessWidget {
  const ProviderHistoryOrderCard({required this.order, super.key});
  final OrderSummary order;

  @override
  Widget build(BuildContext context) =>
      OrderSummaryCard(order: order, providerView: true);
}
