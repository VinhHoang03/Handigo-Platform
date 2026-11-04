import 'package:flutter/material.dart';

class CustomerPageHeader extends StatelessWidget
    implements PreferredSizeWidget {
  const CustomerPageHeader({
    required this.title,
    required this.toolbarHeight,
    this.subtitle,
    this.leading,
    this.actions,
    this.backgroundColor,
    this.titleColor,
    this.showBottomBorder = false,
    this.centerTitle = true,
    this.automaticallyImplyLeading = true,
    super.key,
  });

  final String title;
  final String? subtitle;
  final double toolbarHeight;
  final Widget? leading;
  final List<Widget>? actions;
  final Color? backgroundColor;
  final Color? titleColor;
  final bool showBottomBorder;
  final bool centerTitle;
  final bool automaticallyImplyLeading;

  @override
  Size get preferredSize => Size.fromHeight(toolbarHeight);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppBar(
      centerTitle: centerTitle,
      automaticallyImplyLeading: automaticallyImplyLeading,
      toolbarHeight: toolbarHeight,
      titleSpacing: 12,
      leadingWidth: 52,
      backgroundColor: backgroundColor ?? theme.colorScheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      shape: showBottomBorder ? customerHeaderBorder(theme.colorScheme) : null,
      leading: leading,
      title: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: centerTitle
            ? CrossAxisAlignment.center
            : CrossAxisAlignment.start,
        children: [
          Text(
            title,
            maxLines: subtitle == null ? 2 : 1,
            overflow: TextOverflow.ellipsis,
            textAlign: centerTitle ? TextAlign.center : TextAlign.left,
            style: theme.textTheme.titleLarge?.copyWith(
              color: titleColor,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (subtitle?.trim().isNotEmpty == true)
            Text(
              subtitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: centerTitle ? TextAlign.center : TextAlign.left,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
        ],
      ),
      actions: actions,
    );
  }
}

Border customerHeaderBorder(ColorScheme scheme) => Border(
  bottom: BorderSide(color: scheme.outlineVariant.withValues(alpha: .5)),
);

class CustomerHeaderIcon extends StatelessWidget {
  const CustomerHeaderIcon(this.icon, {super.key});

  final IconData icon;

  @override
  Widget build(BuildContext context) =>
      Icon(icon, color: Theme.of(context).colorScheme.primary, size: 24);
}
