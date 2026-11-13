import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../utils/media_url.dart';

const accountPrimary = Color(0xFF4F35D5);
const accountPrimarySoft = Color(0xFFEFEBFF);
const accountBackground = Color(0xFFF6F5FA);
const accountSurface = Color(0xFFFFFFFF);
const accountInk = Color(0xFF201B36);
const accountMuted = Color(0xFF777286);
const accountDivider = Color(0xFFEDEAF3);
const accountDanger = Color(0xFFC64050);
const accountIconPath = 'assets/icons/account';

class AccountFinancialStatCard extends StatelessWidget {
  const AccountFinancialStatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.primary = false,
    this.subtitle,
    super.key,
  });

  final String label, value;
  final IconData icon;
  final bool primary;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => Container(
    constraints: const BoxConstraints(minHeight: 104),
    padding: const EdgeInsets.all(13),
    decoration: BoxDecoration(
      color: primary ? accountPrimary : accountSurface,
      borderRadius: BorderRadius.circular(16),
      border: primary ? null : Border.all(color: accountDivider),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              icon,
              size: 19,
              color: primary ? Colors.white : accountPrimary,
            ),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: primary ? Colors.white70 : accountMuted,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: primary ? Colors.white : accountInk,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 8),
          Text(
            subtitle!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: primary ? Colors.white70 : accountMuted,
            ),
          ),
        ],
      ],
    ),
  );
}

class AccountMenuItem {
  const AccountMenuItem({
    required this.label,
    required this.subtitle,
    required this.iconAsset,
    this.onTap,
    this.comingSoon = false,
  });

  final String label;
  final String subtitle;
  final String iconAsset;
  final VoidCallback? onTap;
  final bool comingSoon;
}

class AccountDetailScaffold extends StatelessWidget {
  const AccountDetailScaffold({
    super.key,
    required this.title,
    required this.child,
    this.actions,
    this.bottomNavigationBar,
    this.showBackButton = true,
  });

  final String title;
  final Widget child;
  final List<Widget>? actions;
  final Widget? bottomNavigationBar;
  final bool showBackButton;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: accountBackground,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        centerTitle: true,
        toolbarHeight: 62,
        backgroundColor: accountSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: showBackButton
            ? IconButton(
                tooltip: 'Quay lại',
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded, color: accountInk),
              )
            : null,
        title: Text(
          title,
          style: theme.textTheme.titleLarge?.copyWith(
            color: accountInk,
            fontWeight: FontWeight.w600,
          ),
        ),
        actions: actions,
      ),
      body: SafeArea(
        top: false,
        child: Theme(
          data: theme.copyWith(
            cardTheme: CardThemeData(
              color: accountSurface,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              margin: EdgeInsets.zero,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
            ),
          ),
          child: child,
        ),
      ),
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}

class AccountDetailSectionTitle extends StatelessWidget {
  const AccountDetailSectionTitle(this.title, {super.key, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: accountInk,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 3),
          Text(
            subtitle!,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: accountMuted),
          ),
        ],
      ],
    ),
  );
}

class AccountProfileSummaryCard extends StatelessWidget {
  const AccountProfileSummaryCard({
    super.key,
    required this.name,
    required this.contact,
    required this.avatarUrl,
    required this.onEdit,
  });

  final String name;
  final String contact;
  final String? avatarUrl;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(20);
    return Material(
      color: accountSurface,
      borderRadius: borderRadius,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onEdit,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              _AccountAvatar(name: name, avatarUrl: avatarUrl),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: accountInk,
                        fontSize: 22,
                        height: 1.45,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      contact,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: accountMuted,
                        fontSize: 13,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AccountSection extends StatelessWidget {
  const AccountSection({super.key, required this.title, required this.items});

  final String title;
  final List<AccountMenuItem> items;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: accountMuted,
          fontSize: 16,
          height: 1.45,
          fontWeight: FontWeight.w600,
        ),
      ),
      const SizedBox(height: 10),
      _AccountMenuCard(items: items),
    ],
  );
}

class AccountLogoutButton extends StatelessWidget {
  const AccountLogoutButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => OutlinedButton(
    onPressed: onPressed,
    style: OutlinedButton.styleFrom(
      minimumSize: const Size.fromHeight(48),
      backgroundColor: accountSurface,
      foregroundColor: accountDanger,
      elevation: 0,
      side: const BorderSide(color: accountDivider),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
    ),
    child: const Text('Đăng xuất'),
  );
}

class AccountVersionFooter extends StatelessWidget {
  const AccountVersionFooter({super.key, this.version = '0.1.0'});

  final String version;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 16, bottom: 4),
    child: Column(
      children: [
        Text(
          'Handigo · Phiên bản $version',
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: accountMuted),
        ),
        const SizedBox(height: 4),
        Text(
          'Tận tâm trong từng dịch vụ',
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: accountMuted),
        ),
      ],
    ),
  );
}

Future<bool> showAccountLogoutConfirmation(
  BuildContext context, {
  required String userName,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    useRootNavigator: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (context) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: accountDanger.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.logout_rounded, color: accountDanger),
          ),
          const SizedBox(height: 16),
          Text(
            'Đăng xuất khỏi Handigo?',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            'Bạn sẽ đăng xuất khỏi tài khoản $userName. Dữ liệu công việc và lịch sử của bạn vẫn được giữ an toàn.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 20),
          OutlinedButton(
            onPressed: () => Navigator.pop(context, false),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
            child: const Text('Hủy'),
          ),
          const SizedBox(height: 10),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: accountDanger,
              foregroundColor: Colors.white,
            ),
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    ),
  );
  return result ?? false;
}

class _AccountAvatar extends StatelessWidget {
  const _AccountAvatar({required this.name, required this.avatarUrl});

  final String name;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final imageUrl = usableMediaUrl(avatarUrl);
    return Container(
      width: 64,
      height: 64,
      decoration: const BoxDecoration(
        color: accountPrimarySoft,
        shape: BoxShape.circle,
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: imageUrl != null
          ? Image.network(
              imageUrl,
              width: 64,
              height: 64,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => _initial(context),
            )
          : _initial(context),
    );
  }

  Widget _initial(BuildContext context) => Text(
    _initials(name),
    style: Theme.of(context).textTheme.titleLarge?.copyWith(
      color: accountPrimary,
      fontSize: 22,
      height: 1.45,
      fontWeight: FontWeight.w600,
    ),
  );
}

class _AccountMenuCard extends StatelessWidget {
  const _AccountMenuCard({required this.items});

  final List<AccountMenuItem> items;

  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: accountSurface,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      children: [
        for (var index = 0; index < items.length; index++) ...[
          if (index > 0)
            const Divider(height: 1, thickness: 1, color: accountDivider),
          _AccountMenuTile(item: items[index]),
        ],
      ],
    ),
  );
}

class _AccountMenuTile extends StatelessWidget {
  const _AccountMenuTile({required this.item});

  final AccountMenuItem item;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: item.onTap,
    child: ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 76),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: accountPrimarySoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: SvgPicture.asset(item.iconAsset, width: 22, height: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: accountInk,
                      fontSize: 16,
                      height: 1.45,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.comingSoon ? 'Chưa triển khai' : item.subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: item.comingSoon ? accountPrimary : accountMuted,
                      fontWeight: item.comingSoon ? FontWeight.w600 : null,
                      fontSize: 13,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (item.comingSoon)
              const Icon(
                Icons.hourglass_empty_rounded,
                size: 18,
                color: accountPrimary,
              )
            else
              const Icon(
                Icons.chevron_right_rounded,
                size: 16,
                color: accountMuted,
              ),
          ],
        ),
      ),
    ),
  );
}

String _initials(String value) {
  final parts = value.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return '${parts[parts.length - 2][0]}${parts.last[0]}'.toUpperCase();
}
