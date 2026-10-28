import 'package:flutter/material.dart';

class SlideToStartOrder extends StatefulWidget {
  const SlideToStartOrder({
    required this.onConfirmed,
    this.enabled = true,
    this.busy = false,
    super.key,
  });
  final Future<void> Function() onConfirmed;
  final bool enabled, busy;
  @override
  State<SlideToStartOrder> createState() => _SlideToStartOrderState();
}

class _SlideToStartOrderState extends State<SlideToStartOrder> {
  double _progress = 0;
  double _dragStartX = 0;
  bool _submitting = false;
  bool get _enabled => widget.enabled && !widget.busy && !_submitting;

  @override
  void didUpdateWidget(covariant SlideToStartOrder oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_enabled) _progress = 0;
  }

  Future<void> _confirm() async {
    if (!_enabled) return;
    setState(() => _submitting = true);
    try {
      await widget.onConfirmed();
    } finally {
      if (mounted)
        setState(() {
          _submitting = false;
          _progress = 0;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final working = widget.busy || _submitting;
    return LayoutBuilder(
      builder: (context, constraints) {
        final travel = (constraints.maxWidth - 56).clamp(0.0, double.infinity);
        final height =
            56.0 +
            (MediaQuery.textScalerOf(context).scale(14) - 14).clamp(0, 28);
        return Semantics(
          excludeSemantics: true,
          label: 'Trượt từ trái sang phải để bắt đầu xử lý đơn',
          value: '${(_progress * 100).round()}%',
        increasedValue: '${((_progress + .25).clamp(0, 1) * 100).round()}%',
        decreasedValue: '0%',
          enabled: _enabled,
          onIncrease: !_enabled
              ? null
              : () {
                  setState(() => _progress = (_progress + .25).clamp(0, 1));
                  if (_progress == 1) _confirm();
                },
          onDecrease: !_enabled ? null : () => setState(() => _progress = 0),
          child: Container(
            height: height,
            decoration: BoxDecoration(
              color: _enabled || working
                  ? scheme.primary
                  : scheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 58, right: 12),
                    child: Center(
                      child: Text(
                        working ? 'Đang xử lý...' : 'Trượt để bắt đầu xử lý',
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: _enabled || working
                              ? scheme.onPrimary
                              : scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 100),
                  curve: Curves.easeOut,
                  left: 4 + travel * _progress,
                  top: (height - 48) / 2,
                  child: GestureDetector(
                    key: const ValueKey('start-order-slide-handle'),
                    behavior: HitTestBehavior.opaque,
                    onHorizontalDragDown: !_enabled
                        ? null
                        : (details) => _dragStartX = details.globalPosition.dx,
                    onHorizontalDragUpdate: !_enabled || travel == 0
                        ? null
                        : (details) => setState(
                            () => _progress =
                                ((details.globalPosition.dx - _dragStartX) /
                                        travel)
                                    .clamp(0, 1),
                          ),
                    onHorizontalDragEnd: !_enabled
                        ? null
                        : (_) {
                            if (_progress >= .98) {
                              _confirm();
                            } else {
                              setState(() => _progress = 0);
                            }
                          },
                    onHorizontalDragCancel: () => setState(() => _progress = 0),
                    child: Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: scheme.surfaceContainerLowest,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: working
                          ? const Padding(
                              padding: EdgeInsets.all(14),
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Icon(
                              Icons.keyboard_double_arrow_right_rounded,
                              color: _enabled
                                  ? scheme.primary
                                  : scheme.onSurfaceVariant,
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
