import 'dart:async';
import 'package:flutter/material.dart';
import '../../app/theme/app_theme.dart';

enum AppToastType { info, success, warning, error }

class AppToast {
  const AppToast._();
  static final _entries = Expando<OverlayEntry>();
  static final _dismissers = Expando<VoidCallback>();

  static void dismiss(BuildContext context) {
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay != null) _dismissers[overlay]?.call();
  }

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
    if (!context.mounted) return;
    final overlay = Overlay.maybeOf(context, rootOverlay: true);
    if (overlay == null) return;
    _dismissers[overlay]?.call();
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final color =
        backgroundColor ??
        switch (type) {
          AppToastType.info => scheme.primary,
          AppToastType.success => AppTheme.successGreen,
          AppToastType.warning || AppToastType.error => scheme.error,
        };
    final foreground =
        ThemeData.estimateBrightnessForColor(color) == Brightness.dark
        ? Colors.white
        : AppTheme.onSurface;
    final toastIcon =
        icon ??
        switch (type) {
          AppToastType.info => Icons.info_outline,
          AppToastType.success => Icons.check_circle_outline,
          AppToastType.warning => Icons.warning_amber_rounded,
          AppToastType.error => Icons.error_outline,
        };
    var removed = false;
    late final OverlayEntry entry;
    void close() {
      if (removed) return;
      removed = true;
      if (_entries[overlay] == entry) {
        _entries[overlay] = null;
        _dismissers[overlay] = null;
      }
      entry.remove();
      entry.dispose();
    }

    entry = OverlayEntry(
      builder: (context) => Positioned(
        top: MediaQuery.paddingOf(context).top + 12,
        left: 12,
        right: 12,
        child: Align(
          alignment: Alignment.topRight,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Theme(
              data: theme,
              child: _TopToast(
                message: message,
                title: title,
                color: color,
                foreground: foreground,
                icon: toastIcon,
                action: action,
                duration: duration,
                onClose: close,
              ),
            ),
          ),
        ),
      ),
    );
    _entries[overlay] = entry;
    _dismissers[overlay] = close;
    overlay.insert(entry);
  }
}

class _TopToast extends StatefulWidget {
  const _TopToast({
    required this.message,
    required this.title,
    required this.color,
    required this.foreground,
    required this.icon,
    required this.action,
    required this.duration,
    required this.onClose,
  });
  final String message;
  final String? title;
  final Color color, foreground;
  final IconData icon;
  final SnackBarAction? action;
  final Duration duration;
  final VoidCallback onClose;
  @override
  State<_TopToast> createState() => _TopToastState();
}

class _TopToastState extends State<_TopToast> {
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.duration, widget.onClose);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Material(
      color: widget.color,
      elevation: 8,
      shadowColor: Colors.black26,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 4, 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Icon(widget.icon, color: widget.foreground, size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: DefaultTextStyle(
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium!.copyWith(color: widget.foreground),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (widget.title != null) ...[
                      Text(
                        widget.title!,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                    ],
                    Text(widget.message),
                    if (widget.action != null)
                      TextButton(
                        style: TextButton.styleFrom(
                          foregroundColor: widget.foreground,
                        ),
                        onPressed: () {
                          widget.onClose();
                          widget.action!.onPressed();
                        },
                        child: Text(widget.action!.label),
                      ),
                  ],
                ),
              ),
            ),
            IconButton(
              tooltip: 'Đóng thông báo',
              onPressed: widget.onClose,
              icon: Icon(Icons.close, color: widget.foreground, size: 20),
            ),
          ],
        ),
      ),
    ),
  );
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
    builder: (context) =>
        AppModal(title: title, actions: actions, child: builder(context)),
  );

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: title == null ? null : Text(title!),
    content: child,
    actions: actions,
  );
}
