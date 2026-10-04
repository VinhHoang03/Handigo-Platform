import 'package:flutter/material.dart';

enum AppToastType { info, success, error }

class AppToast {
  const AppToast._();

  static void show(
    BuildContext context,
    String message, {
    AppToastType type = AppToastType.info,
    String? title,
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
    Color? backgroundColor,
    IconData? icon,
  }) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    final color = backgroundColor ?? switch (type) {
      AppToastType.info => const Color(0xFF3525CD),
      AppToastType.success => const Color(0xFF18794E),
      AppToastType.error => const Color(0xFFB3261E),
    };
    final toastIcon = icon ?? switch (type) {
      AppToastType.info => Icons.info_outline,
      AppToastType.success => Icons.check_circle_outline,
      AppToastType.error => Icons.error_outline,
    };

    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          duration: duration,
          backgroundColor: color,
          action: action,
          content: Row(
            children: [
              Icon(toastIcon, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(
                child: title == null
                    ? Text(message)
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(message),
                        ],
                      ),
              ),
            ],
          ),
        ),
      );
  }
}

class AppBottomSheet extends StatelessWidget {
  const AppBottomSheet({required this.child, this.padding, super.key});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  static Future<T?> show<T>(
    BuildContext context, {
    required WidgetBuilder builder,
    bool isDismissible = true,
    bool enableDrag = true,
    bool useSafeArea = true,
  }) => showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: isDismissible,
    enableDrag: enableDrag,
    useSafeArea: useSafeArea,
    builder: (context) => AppBottomSheet(child: builder(context)),
  );

  @override
  Widget build(BuildContext context) => Material(
    color: Theme.of(context).colorScheme.surface,
    borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
    child: Padding(
      padding: padding ?? const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: child,
    ),
  );
}

class AppModal extends StatelessWidget {
  const AppModal({required this.child, this.title, this.actions, super.key});

  final String? title;
  final Widget child;
  final List<Widget>? actions;

  static Future<T?> show<T>(
    BuildContext context, {
    String? title,
    required WidgetBuilder builder,
    List<Widget>? actions,
    bool barrierDismissible = true,
  }) => showDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    builder: (context) => AppModal(
      title: title,
      actions: actions,
      child: builder(context),
    ),
  );

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: title == null ? null : Text(title!),
    content: child,
    actions: actions,
  );
}
