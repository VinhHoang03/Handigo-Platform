import 'package:flutter/material.dart';

String formatRating(num value) =>
    (value % 1 == 0 ? value.toInt().toString() : value.toString()).replaceAll(
      '.',
      ',',
    );

class RatingStars extends StatelessWidget {
  const RatingStars({required this.value, this.onChanged, super.key});
  final double value;
  final ValueChanged<double>? onChanged;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 1; i <= 5; i++)
          Semantics(
            button: true,
            enabled: onChanged != null,
            selected: value == i,
            label: '$i sao',
            onTap: onChanged == null ? null : () => onChanged!(i.toDouble()),
            onIncrease: onChanged == null || value >= 5
                ? null
                : () => onChanged!((value + .5).clamp(1, 5).toDouble()),
            onDecrease: onChanged == null || value <= 1
                ? null
                : () => onChanged!((value - .5).clamp(1, 5).toDouble()),
            child: Tooltip(
              message: '$i sao',
              child: InkWell(
                excludeFromSemantics: true,
                borderRadius: BorderRadius.circular(22),
                onTap: onChanged == null ? null : () {},
                onTapUp: onChanged == null
                    ? null
                    : (details) {
                        final rating =
                            i - (details.localPosition.dx < 22 ? .5 : 0);
                        onChanged!(rating.clamp(1, 5).toDouble());
                      },
                child: SizedBox(
                  width: 44,
                  height: 48,
                  child: Center(
                    child: Icon(
                      value >= i
                          ? Icons.star_rounded
                          : value >= i - .5
                          ? Icons.star_half_rounded
                          : Icons.star_outline_rounded,
                      size: 32,
                      color: value >= i - .5
                          ? Colors.amber
                          : Theme.of(context).colorScheme.outline,
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
