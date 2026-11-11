import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/account_overview_widgets.dart';
import '../../account/domain/account_models.dart';
import 'provider_screens.dart';

final providerProfileProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).profile(),
);
final providerWalletProvider = FutureProvider.autoDispose<WalletInfo>((ref) {
  ref.watch(authControllerProvider.select((auth) => auth.user?.id));
  return ref.watch(providerRepositoryProvider).wallet();
});
final providerWalletTransactionsProvider = FutureProvider.autoDispose((ref) {
  ref.watch(authControllerProvider.select((auth) => auth.user?.id));
  return ref.watch(providerRepositoryProvider).walletTransactions();
});
final providerWithdrawalsProvider = FutureProvider.autoDispose((ref) {
  ref.watch(authControllerProvider.select((auth) => auth.user?.id));
  return ref.watch(providerRepositoryProvider).withdrawals();
});
final providerBanksProvider = FutureProvider.autoDispose((ref) {
  ref.watch(authControllerProvider.select((auth) => auth.user?.id));
  return ref.watch(providerRepositoryProvider).bankAccounts();
});
final providerWalletSummaryProvider = FutureProvider.autoDispose<WalletSummary>(
  (ref) {
    ref.watch(authControllerProvider.select((auth) => auth.user?.id));
    return ref.watch(providerRepositoryProvider).walletSummary();
  },
);
final providerFeedbacksProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).feedbacks(),
);
final providerSuggestionCategoriesProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).suggestionCategories(),
);

class ProviderProfileScreen extends ConsumerStatefulWidget {
  const ProviderProfileScreen({super.key});
  @override
  ConsumerState<ProviderProfileScreen> createState() =>
      _ProviderProfileScreenState();
}

class _ProviderProfileScreenState extends ConsumerState<ProviderProfileScreen> {
  final bio = TextEditingController();
  final service = TextEditingController();
  bool saving = false;
  @override
  void dispose() {
    bio.dispose();
    service.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(providerProfileProvider);
    return AccountDetailScaffold(
      title: 'Thông tin nghề nghiệp',
      actions: [
        IconButton(
          tooltip: 'Trợ giúp',
          onPressed: () => showAboutDialog(
            context: context,
            applicationName: 'Handigo Đối tác',
          ),
          icon: const Icon(Icons.help_outline_rounded),
        ),
      ],
      child: state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: _message(error),
          onRetry: () => ref.invalidate(providerProfileProvider),
        ),
        data: (data) {
          final provider =
              (data['provider'] as Map?)?.cast<String, dynamic>() ?? {};
          if (bio.text.isEmpty && service.text.isEmpty) {
            bio.text = '${provider['bio'] ?? provider['description'] ?? ''}';
            service.text = '${provider['mainServiceText'] ?? ''}';
          }
          final certificates = (provider['certificates'] as List? ?? [])
              .whereType<Map>()
              .map((item) => item.cast<String, dynamic>())
              .toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              const AccountDetailSectionTitle(
                'Hồ sơ nghề nghiệp',
                subtitle:
                    'Hoàn thiện thông tin để khách hàng hiểu rõ năng lực của bạn.',
              ),
              const SizedBox(height: 16),
              _ProfessionalCard(
                title: 'Chuyên môn & giới thiệu',
                icon: Icons.handyman_outlined,
                children: [
                  const _ProfessionalFieldLabel(
                    label: 'Chuyên môn chính',
                    hint: 'Nội dung hiển thị nổi bật trên hồ sơ của bạn',
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: service,
                    decoration: const InputDecoration(
                      hintText: 'Ví dụ: Điện lạnh dân dụng',
                      prefixIcon: Icon(Icons.home_repair_service_outlined),
                      filled: true,
                      fillColor: accountBackground,
                    ),
                  ),
                  const SizedBox(height: 18),
                  const _ProfessionalFieldLabel(
                    label: 'Giới thiệu nghề nghiệp',
                    hint: 'Mô tả ngắn kinh nghiệm và thế mạnh của bạn',
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: bio,
                    minLines: 3,
                    maxLines: 5,
                    textAlignVertical: TextAlignVertical.top,
                    decoration: const InputDecoration(
                      hintText:
                          'Ví dụ: 5 năm kinh nghiệm sửa chữa và bảo dưỡng điều hòa...',
                      filled: true,
                      fillColor: accountBackground,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: saving ? null : () => _save(context),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(50),
                  backgroundColor: accountPrimary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                icon: saving
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check_rounded),
                label: Text(saving ? 'Đang lưu...' : 'Lưu thay đổi'),
              ),
              const SizedBox(height: 26),
              const _ProfessionalSectionHeader(
                title: 'Dịch vụ đang cung cấp',
                subtitle: 'Các dịch vụ đã được Handigo phê duyệt',
              ),
              const SizedBox(height: 10),
              _ProfessionalCard(
                icon: Icons.home_repair_service_outlined,
                padding: EdgeInsets.zero,
                children: [
                  _ServiceChips(services: _serviceLabels(provider['services'])),
                ],
              ),
              const SizedBox(height: 26),
              _ProfessionalSectionHeader(
                title: 'Chứng chỉ chuyên môn',
                subtitle: 'Tăng độ tin cậy cho hồ sơ nghề nghiệp',
                action: TextButton.icon(
                  onPressed: () => _addCertificate(context),
                  icon: const Icon(Icons.add_rounded, size: 20),
                  label: const Text('Thêm'),
                ),
              ),
              const SizedBox(height: 10),
              _ProfessionalCard(
                icon: Icons.workspace_premium_outlined,
                padding: EdgeInsets.zero,
                children: [
                  if (certificates.isEmpty)
                    const _EmptyCertificates()
                  else
                    ...certificates.asMap().entries.expand(
                      (entry) => [
                        if (entry.key > 0) const Divider(height: 1, indent: 68),
                        _CertificateRow(
                          certificate: entry.value,
                          onDelete: () async {
                            final item = entry.value;
                            await ref
                                .read(providerRepositoryProvider)
                                .deleteCertificate(
                                  '${item['id'] ?? item['_id']}',
                                );
                            ref.invalidate(providerProfileProvider);
                          },
                        ),
                      ],
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _save(BuildContext context) async {
    setState(() => saving = true);
    try {
      final payload = {
        'bio': bio.text.trim(),
        'mainServiceText': service.text.trim(),
      };
      await ref.read(providerRepositoryProvider).updateProfile(payload);
      ref.invalidate(providerProfileProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Đã cập nhật hồ sơ.')));
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(error))));
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _addCertificate(BuildContext context) async {
    final title = TextEditingController();
    final issuer = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Thêm chứng chỉ'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: title,
              decoration: const InputDecoration(labelText: 'Tên chứng chỉ'),
            ),
            TextField(
              controller: issuer,
              decoration: const InputDecoration(labelText: 'Đơn vị cấp'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(context, title.text.trim().isNotEmpty),
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    if (ok == true) {
      try {
        await ref.read(providerRepositoryProvider).createCertificate({
          'title': title.text.trim(),
          'issuer': issuer.text.trim(),
          'imageUrls': const [],
        });
        ref.invalidate(providerProfileProvider);
      } catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(_message(error))));
        }
      }
    }
    title.dispose();
    issuer.dispose();
  }
}

class _ProfessionalCard extends StatelessWidget {
  const _ProfessionalCard({
    required this.icon,
    required this.children,
    this.title,
    this.padding = const EdgeInsets.all(16),
  });
  final String? title;
  final IconData icon;
  final List<Widget> children;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    elevation: 0,
    color: accountSurface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: const BorderSide(color: accountDivider),
    ),
    child: Padding(
      padding: padding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title != null) ...[
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: accountPrimarySoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: accountPrimary, size: 21),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    title!,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: accountInk,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
          ],
          ...children,
        ],
      ),
    ),
  );
}

class _ProfessionalFieldLabel extends StatelessWidget {
  const _ProfessionalFieldLabel({required this.label, required this.hint});
  final String label;
  final String hint;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: accountInk,
          fontWeight: FontWeight.w700,
        ),
      ),
      const SizedBox(height: 3),
      Text(
        hint,
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: accountMuted),
      ),
    ],
  );
}

class _ProfessionalSectionHeader extends StatelessWidget {
  const _ProfessionalSectionHeader({
    required this.title,
    required this.subtitle,
    this.action,
  });
  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.end,
    children: [
      Expanded(
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
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: accountMuted),
            ),
          ],
        ),
      ),
      ?action,
    ],
  );
}

class _ServiceChips extends StatelessWidget {
  const _ServiceChips({required this.services});
  final List<String> services;

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('Chưa có dịch vụ nào được phê duyệt.'),
      );
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: services
            .map(
              (name) => Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  color: accountPrimarySoft,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  name,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: accountPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _CertificateRow extends StatelessWidget {
  const _CertificateRow({required this.certificate, required this.onDelete});
  final Map<String, dynamic> certificate;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final issuer = '${certificate['issuer'] ?? ''}'.trim();
    final status = '${certificate['status'] ?? 'pending'}';
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: accountPrimarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.workspace_premium_outlined,
              color: accountPrimary,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${certificate['title'] ?? 'Chứng chỉ chuyên môn'}',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: accountInk,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (issuer.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    issuer,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: accountMuted),
                  ),
                ],
                const SizedBox(height: 7),
                _CertificateStatusBadge(status: status),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Xóa chứng chỉ',
            onPressed: onDelete,
            icon: const Icon(Icons.delete_outline_rounded),
            color: accountDanger,
          ),
        ],
      ),
    );
  }
}

class _CertificateStatusBadge extends StatelessWidget {
  const _CertificateStatusBadge({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, foreground, background) = switch (status) {
      'approved' => (
        'Đã duyệt',
        const Color(0xFF16805B),
        const Color(0xFFE8F7F0),
      ),
      'rejected' => ('Chưa được duyệt', accountDanger, const Color(0xFFFFEEF0)),
      _ => ('Chờ duyệt', const Color(0xFF9A6510), const Color(0xFFFFF4D9)),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: foreground,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _EmptyCertificates extends StatelessWidget {
  const _EmptyCertificates();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(20),
    child: Row(
      children: [
        const Icon(Icons.workspace_premium_outlined, color: accountMuted),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            'Bạn chưa cập nhật chứng chỉ chuyên môn.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: accountMuted),
          ),
        ),
      ],
    ),
  );
}

class ProviderVerificationScreen extends ConsumerWidget {
  const ProviderVerificationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => AccountDetailScaffold(
    title: 'Xác thực tài khoản',
    child: ref
        .watch(providerProfileProvider)
        .when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: _message(error),
            onRetry: () => ref.invalidate(providerProfileProvider),
          ),
          data: (data) {
            final user = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};
            final provider =
                (data['provider'] as Map?)?.cast<String, dynamic>() ?? {};
            final identity =
                (provider['identityDocument'] as Map?)
                    ?.cast<String, dynamic>() ??
                {};
            final identityStatus =
                '${identity['verificationStatus'] ?? 'unsubmitted'}';
            final emailReady = user['email'] != null;
            final phoneReady = user['phone'] != null;
            final identityReady = identityStatus == 'approved';
            final profileReady = provider['verified'] == true;
            final completed = [
              emailReady,
              phoneReady,
              identityReady,
              profileReady,
            ].where((value) => value).length;
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: accountPrimarySoft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: const BoxDecoration(
                          color: accountSurface,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.verified_user_outlined,
                          color: accountPrimary,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$completed/4 thông tin đã hoàn tất',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Hoàn thiện xác thực để nhận việc an toàn và tăng độ tin cậy.',
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const AccountDetailSectionTitle(
                  'Chi tiết xác thực',
                  subtitle:
                      'Kiểm tra và cập nhật các thông tin còn thiếu trong tài khoản.',
                ),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      children: [
                        _VerificationTile(
                          icon: Icons.email_outlined,
                          title: 'Địa chỉ email',
                          status: user['email'] == null
                              ? 'Chưa cập nhật'
                              : 'Đã cập nhật',
                          tone: user['email'] == null
                              ? _VerificationTone.pending
                              : _VerificationTone.approved,
                        ),
                        _VerificationTile(
                          icon: Icons.phone_outlined,
                          title: 'Số điện thoại',
                          status: user['phone'] == null
                              ? 'Cần bổ sung'
                              : 'Đã cập nhật',
                          tone: user['phone'] == null
                              ? _VerificationTone.pending
                              : _VerificationTone.approved,
                          onTap: () => context.push('/provider/personal-info'),
                        ),
                        _VerificationTile(
                          icon: Icons.badge_outlined,
                          title: 'CCCD / Hộ chiếu',
                          status: _identityStatus(identityStatus),
                          tone: _identityTone(identityStatus),
                        ),
                        _VerificationTile(
                          icon: Icons.verified_user_outlined,
                          title: 'Hồ sơ đối tác',
                          status: provider['verified'] == true
                              ? 'Đã xác thực'
                              : 'Đang hoàn thiện',
                          tone: provider['verified'] == true
                              ? _VerificationTone.approved
                              : _VerificationTone.pending,
                          showDivider: false,
                          onTap: () =>
                              context.push('/provider/professional-info'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            );
          },
        ),
  );
}

enum _VerificationTone { approved, pending, rejected }

class _VerificationTile extends StatelessWidget {
  const _VerificationTile({
    required this.icon,
    required this.title,
    required this.status,
    required this.tone,
    this.onTap,
    this.showDivider = true,
  });

  final IconData icon;
  final String title;
  final String status;
  final _VerificationTone tone;
  final VoidCallback? onTap;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = switch (tone) {
      _VerificationTone.approved => AppTheme.successGreen,
      _VerificationTone.pending => scheme.primary,
      _VerificationTone.rejected => scheme.error,
    };
    final statusIcon = switch (tone) {
      _VerificationTone.approved => Icons.check_circle_rounded,
      _VerificationTone.pending => Icons.schedule_rounded,
      _VerificationTone.rejected => Icons.cancel_rounded,
    };
    return Column(
      children: [
        ListTile(
          minTileHeight: 64,
          contentPadding: EdgeInsets.zero,
          leading: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color),
          ),
          title: Text(title),
          subtitle: Row(
            children: [
              Icon(statusIcon, size: 15, color: color),
              const SizedBox(width: 5),
              Expanded(
                child: Text(status, style: TextStyle(color: color)),
              ),
            ],
          ),
          trailing: onTap == null
              ? null
              : const Icon(Icons.chevron_right_rounded),
          onTap: onTap,
        ),
        if (showDivider) const Divider(height: 1),
      ],
    );
  }
}

class ProviderServiceSuggestionScreen extends ConsumerStatefulWidget {
  const ProviderServiceSuggestionScreen({super.key});

  @override
  ConsumerState<ProviderServiceSuggestionScreen> createState() =>
      _ProviderServiceSuggestionScreenState();
}

class _ProviderServiceSuggestionScreenState
    extends ConsumerState<ProviderServiceSuggestionScreen> {
  static const _newCategory = 'new-category';
  final _formKey = GlobalKey<FormState>();
  final _serviceName = TextEditingController();
  final _categoryName = TextEditingController();
  final _description = TextEditingController();
  String? _categoryId;
  bool _submitting = false;

  @override
  void dispose() {
    _serviceName.dispose();
    _categoryName.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(providerRepositoryProvider)
          .createServiceSuggestion(
            serviceName: _serviceName.text,
            categoryId: _categoryId == _newCategory ? null : _categoryId,
            categoryName: _categoryId == _newCategory
                ? _categoryName.text
                : null,
            description: _description.text,
          );
      _serviceName.clear();
      _categoryName.clear();
      _description.clear();
      setState(() => _categoryId = null);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Đã gửi đề xuất. Handigo sẽ xem xét và phản hồi trong hệ thống.',
            ),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_message(error))));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => AccountDetailScaffold(
    title: 'Đề xuất dịch vụ',
    child: ref
        .watch(providerSuggestionCategoriesProvider)
        .when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: _message(error),
            onRetry: () => ref.invalidate(providerSuggestionCategoriesProvider),
          ),
          data: (categories) => SafeArea(
            top: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Form(
                  key: _formKey,
                  child: ListView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
                    children: [
                      Card(
                        margin: EdgeInsets.zero,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Gửi ý tưởng dịch vụ mới',
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Mô tả nhu cầu thực tế và giá trị dịch vụ có thể mang lại cho khách hàng.',
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.onSurfaceVariant,
                                    ),
                              ),
                              const SizedBox(height: 18),
                              TextFormField(
                                controller: _serviceName,
                                enabled: !_submitting,
                                maxLength: 120,
                                textInputAction: TextInputAction.next,
                                decoration: const InputDecoration(
                                  labelText: 'Tên dịch vụ đề xuất',
                                  hintText:
                                      'Ví dụ: Vệ sinh máy lạnh treo tường',
                                  prefixIcon: Icon(Icons.lightbulb_outline),
                                ),
                                validator: (value) =>
                                    value == null || value.trim().isEmpty
                                    ? 'Vui lòng nhập tên dịch vụ.'
                                    : null,
                              ),
                              const SizedBox(height: 12),
                              DropdownButtonFormField<String>(
                                key: ValueKey(_categoryId),
                                initialValue: _categoryId,
                                isExpanded: true,
                                decoration: const InputDecoration(
                                  labelText: 'Danh mục liên quan',
                                  prefixIcon: Icon(Icons.category_outlined),
                                ),
                                items: [
                                  const DropdownMenuItem(
                                    value: null,
                                    child: Text('Chưa xác định'),
                                  ),
                                  ...categories.map(
                                    (category) => DropdownMenuItem(
                                      value: category.id,
                                      child: Text(category.name),
                                    ),
                                  ),
                                  const DropdownMenuItem(
                                    value: _newCategory,
                                    child: Text('Gợi ý danh mục mới'),
                                  ),
                                ],
                                onChanged: _submitting
                                    ? null
                                    : (value) =>
                                          setState(() => _categoryId = value),
                              ),
                              if (_categoryId == _newCategory) ...[
                                const SizedBox(height: 12),
                                TextFormField(
                                  controller: _categoryName,
                                  enabled: !_submitting,
                                  maxLength: 120,
                                  decoration: const InputDecoration(
                                    labelText: 'Tên danh mục mới',
                                    hintText:
                                        'Ví dụ: Chăm sóc thú cưng tại nhà',
                                    prefixIcon: Icon(
                                      Icons.create_new_folder_outlined,
                                    ),
                                  ),
                                  validator: (value) =>
                                      _categoryId == _newCategory &&
                                          (value == null ||
                                              value.trim().isEmpty)
                                      ? 'Vui lòng nhập tên danh mục.'
                                      : null,
                                ),
                              ],
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: _description,
                                enabled: !_submitting,
                                minLines: 4,
                                maxLines: 7,
                                maxLength: 5000,
                                decoration: const InputDecoration(
                                  labelText: 'Mô tả đề xuất',
                                  hintText:
                                      'Nhu cầu khách hàng, phạm vi công việc hoặc cách triển khai...',
                                  alignLabelWithHint: true,
                                ),
                              ),
                              const SizedBox(height: 16),
                              FilledButton.icon(
                                onPressed: _submitting ? null : _submit,
                                style: FilledButton.styleFrom(
                                  minimumSize: const Size.fromHeight(48),
                                  backgroundColor: accountPrimary,
                                  foregroundColor: Colors.white,
                                ),
                                icon: _submitting
                                    ? const SizedBox.square(
                                        dimension: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Icon(Icons.send_outlined),
                                label: Text(
                                  _submitting ? 'Đang gửi...' : 'Gửi đề xuất',
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
  );
}

String _identityStatus(String value) => switch (value) {
  'approved' => 'Đã xác thực',
  'pending' || 'pending_review' => 'Đang chờ duyệt',
  'rejected' => 'Cần cập nhật lại',
  _ => 'Chưa gửi giấy tờ',
};

_VerificationTone _identityTone(String value) => switch (value) {
  'approved' => _VerificationTone.approved,
  'rejected' => _VerificationTone.rejected,
  _ => _VerificationTone.pending,
};

class ProviderWalletScreen extends ConsumerWidget {
  const ProviderWalletScreen({
    this.asTab = false,
    this.embedded = false,
    this.actionsBuilder,
    super.key,
  });
  final bool asTab;
  final bool embedded;
  final Widget Function(WalletInfo wallet)? actionsBuilder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(providerWalletProvider);
    final summary = ref.watch(providerWalletSummaryProvider);
    void refresh() {
      ref.invalidate(providerWalletProvider);
      ref.invalidate(providerWalletSummaryProvider);
      ref.invalidate(providerWalletTransactionsProvider);
      ref.invalidate(providerWithdrawalsProvider);
    }

    final content = ListView(
      key: const PageStorageKey('provider-wallet'),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        wallet.when(
          loading: () => const AppLoading(),
          error: (error, _) =>
              AppMessage(message: _message(error), onRetry: refresh),
          data: (value) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ProviderWalletBalanceCard(
                wallet: value,
                summary: summary.asData?.value,
                summaryLoading: summary.isLoading,
              ),
              if (actionsBuilder != null) ...[
                const SizedBox(height: 12),
                actionsBuilder!(value),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),
        const AccountDetailSectionTitle(
          'Lịch sử giao dịch',
          subtitle: 'Các biến động số dư ví theo thời gian gần nhất.',
        ),
        ref
            .watch(providerWalletTransactionsProvider)
            .when(
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => AppMessage(
                message: _message(error),
                onRetry: () =>
                    ref.invalidate(providerWalletTransactionsProvider),
              ),
              data: (page) => page.items.isEmpty
                  ? const AppMessage(message: 'Chưa có giao dịch ví.')
                  : Column(
                      children: page.items
                          .map(
                            (item) => Card(
                              margin: const EdgeInsets.only(top: 8),
                              child: ListTile(
                                leading: Container(
                                  width: 42,
                                  height: 42,
                                  decoration: BoxDecoration(
                                    color: accountPrimarySoft,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    item.direction == 'in'
                                        ? Icons.south_west_rounded
                                        : Icons.north_east_rounded,
                                    color: accountPrimary,
                                  ),
                                ),
                                title: Text(
                                  item.description ??
                                      _transactionType(item.type),
                                ),
                                subtitle: Text(
                                  '${_transactionStatus(item.status)}${item.createdAt == null ? '' : ' • ${_date(item.createdAt)}'}',
                                ),
                                trailing: Text(
                                  '${item.direction == 'in' ? '+' : '-'}${_money(item.amount)}',
                                  style: TextStyle(
                                    color: item.direction == 'in'
                                        ? const Color(0xFF16805B)
                                        : accountInk,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
            ),
        const SizedBox(height: 24),
        const AccountDetailSectionTitle(
          'Yêu cầu rút tiền',
          subtitle: 'Theo dõi trạng thái duyệt và tài khoản nhận tiền.',
        ),
        ref
            .watch(providerWithdrawalsProvider)
            .when(
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => AppMessage(
                message: _message(error),
                onRetry: () => ref.invalidate(providerWithdrawalsProvider),
              ),
              data: (page) => page.items.isEmpty
                  ? const AppMessage(message: 'Chưa có yêu cầu rút tiền.')
                  : Column(
                      children: page.items
                          .map(
                            (item) => Card(
                              margin: const EdgeInsets.only(top: 8),
                              child: ListTile(
                                leading: const Icon(
                                  Icons.payments_outlined,
                                  color: accountPrimary,
                                ),
                                title: Text(_money(_number(item['amount']))),
                                subtitle: Text(
                                  '${_transactionStatus(item['status'] as String?)} • ${_date(item['createdAt'])}',
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
            ),
      ],
    );
    if (embedded) return content;
    return AccountDetailScaffold(
      title: 'Ví Handigo',
      showBackButton: !asTab,
      actions: [
        IconButton(
          tooltip: 'Làm mới ví',
          onPressed: refresh,
          icon: const Icon(Icons.refresh_rounded),
        ),
      ],
      child: content,
    );
  }
}

class ProviderWalletBalanceCard extends StatelessWidget {
  const ProviderWalletBalanceCard({
    required this.wallet,
    this.summary,
    this.summaryLoading = false,
    this.onBankAccounts,
    super.key,
  });
  final WalletInfo wallet;
  final WalletSummary? summary;
  final bool summaryLoading;
  final VoidCallback? onBankAccounts;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final currentBalance = wallet.balance;
    final totalEarnings = wallet.totalEarnings ?? summary?.totalEarnings ?? 0;
    final totalWithdrawn =
        wallet.totalWithdrawn ?? summary?.totalWithdrawals ?? 0;
    final stats = [
      ('Số dư khả dụng', currentBalance, Icons.account_balance_wallet_outlined),
      ('Đang chờ xử lý', wallet.pendingBalance, Icons.hourglass_top_rounded),
      ('Tổng thu nhập', totalEarnings, Icons.trending_up_rounded),
      ('Đã rút', totalWithdrawn, Icons.payments_outlined),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (summaryLoading) const LinearProgressIndicator(minHeight: 2),
        LayoutBuilder(
          builder: (context, constraints) {
            final stacked =
                constraints.maxWidth < 300 ||
                MediaQuery.textScalerOf(context).scale(1) > 1.3;
            final width = stacked
                ? constraints.maxWidth
                : (constraints.maxWidth - 10) / 2;
            return Wrap(
              spacing: 10,
              runSpacing: 10,
              children: stats.asMap().entries.map((entry) {
                final (label, amount, icon) = entry.value;
                final primary = entry.key == 0;
                return SizedBox(
                  width: width,
                  child: AccountFinancialStatCard(
                    label: label,
                    value: _money(amount),
                    icon: icon,
                    primary: primary,
                  ),
                );
              }).toList(),
            );
          },
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            foregroundColor: scheme.primary,
          ),
          onPressed: onBankAccounts ?? () => context.push('/provider/banks'),
          icon: const Icon(Icons.account_balance_outlined, size: 20),
          label: const Text('Tài khoản ngân hàng'),
        ),
      ],
    );
  }
}

class ProviderBankAccountsScreen extends ConsumerWidget {
  const ProviderBankAccountsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => AccountDetailScaffold(
    title: 'Tài khoản ngân hàng',
    actions: [
      IconButton(
        tooltip: 'Thêm tài khoản',
        onPressed: () => _add(context, ref),
        icon: const Icon(Icons.add),
      ),
    ],
    child: ref
        .watch(providerBanksProvider)
        .when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: _message(error),
            onRetry: () => ref.invalidate(providerBanksProvider),
          ),
          data: (items) => items.isEmpty
              ? const AppMessage(message: 'Chưa có tài khoản ngân hàng.')
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, index) {
                    final item = items[index];
                    final id = '${item['id'] ?? item['_id']}';
                    return Card(
                      child: ListTile(
                        title: Text(
                          '${item['bankName'] ?? ''} • ${item['bankCode'] ?? ''}',
                        ),
                        subtitle: Text(
                          '${item['accountHolderName'] ?? ''}\n${item['accountNumber'] ?? ''}',
                        ),
                        isThreeLine: true,
                        leading: Icon(
                          item['isDefault'] == true
                              ? Icons.radio_button_checked
                              : Icons.radio_button_unchecked,
                        ),
                        onTap: () async {
                          await ref
                              .read(providerRepositoryProvider)
                              .setDefaultBankAccount(id);
                          ref.invalidate(providerBanksProvider);
                        },
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () async {
                            await ref
                                .read(providerRepositoryProvider)
                                .deleteBankAccount(id);
                            ref.invalidate(providerBanksProvider);
                          },
                        ),
                      ),
                    );
                  },
                ),
        ),
  );

  Future<void> _add(BuildContext context, WidgetRef ref) async {
    final bank = TextEditingController();
    final code = TextEditingController();
    final number = TextEditingController();
    final holder = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Thêm tài khoản'),
        content: SingleChildScrollView(
          child: Column(
            children: [
              TextField(
                controller: bank,
                decoration: const InputDecoration(labelText: 'Tên ngân hàng'),
              ),
              TextField(
                controller: code,
                decoration: const InputDecoration(labelText: 'Mã ngân hàng'),
              ),
              TextField(
                controller: number,
                decoration: const InputDecoration(labelText: 'Số tài khoản'),
              ),
              TextField(
                controller: holder,
                decoration: const InputDecoration(
                  labelText: 'Tên chủ tài khoản',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    if (ok == true) {
      try {
        await ref.read(providerRepositoryProvider).createBankAccount({
          'bankName': bank.text.trim(),
          'bankCode': code.text.trim(),
          'accountNumber': number.text.trim(),
          'accountHolderName': holder.text.trim(),
        });
        ref.invalidate(providerBanksProvider);
      } catch (error) {
        if (context.mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(_message(error))));
        }
      }
    }
    bank.dispose();
    code.dispose();
    number.dispose();
    holder.dispose();
  }
}

enum _FeedbackQuickFilter { all, pending, replied, images, five, four, low }

class ProviderFeedbackScreen extends ConsumerStatefulWidget {
  const ProviderFeedbackScreen({super.key});

  @override
  ConsumerState<ProviderFeedbackScreen> createState() =>
      _ProviderFeedbackScreenState();
}

class _ProviderFeedbackScreenState
    extends ConsumerState<ProviderFeedbackScreen> {
  final search = TextEditingController();
  _FeedbackQuickFilter filter = _FeedbackQuickFilter.all;

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AccountDetailScaffold(
    title: 'Đánh giá khách hàng',
    child: ref
        .watch(providerFeedbacksProvider)
        .when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: _message(error),
            onRetry: () => ref.invalidate(providerFeedbacksProvider),
          ),
          data: (page) {
            if (page.items.isEmpty) {
              return const AppMessage(message: 'Chưa có đánh giá nào.');
            }
            final items = page.items.where(_matchesFilter).toList();
            final average =
                page.items
                    .map((item) => _number(item['rating']))
                    .fold<double>(0, (sum, rating) => sum + rating) /
                page.items.length;
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: accountPrimarySoft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: [
                      Text(
                        average.toStringAsFixed(1),
                        style: Theme.of(context).textTheme.displaySmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: List.generate(
                                5,
                                (index) => Icon(
                                  index < average.round()
                                      ? Icons.star_rounded
                                      : Icons.star_border_rounded,
                                  color: AppTheme.starGold,
                                  size: 22,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text('${page.items.length} đánh giá gần nhất'),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const AccountDetailSectionTitle(
                  'Nhận xét từ khách hàng',
                  subtitle: 'Xem hình ảnh và phản hồi khách hàng sau dịch vụ.',
                ),
                const SizedBox(height: 14),
                _FeedbackQuickToolbar(
                  resultCount: items.length,
                  controller: search,
                  selected: filter,
                  onSearch: (_) => setState(() {}),
                  onFilter: (value) => setState(() => filter = value),
                ),
                const SizedBox(height: 14),
                if (items.isEmpty)
                  const _FilteredFeedbackEmpty()
                else
                  ...items.asMap().entries.expand(
                    (entry) => [
                      if (entry.key > 0) const SizedBox(height: 12),
                      _ProviderFeedbackCard(
                        feedback: entry.value,
                        onPreviewImage: _previewImage,
                        onReply: () => _openReply(entry.value),
                        onEditReply: () => _openReply(
                          entry.value,
                          existingReply: Map<String, dynamic>.from(
                            entry.value['providerReply'] as Map,
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            );
          },
        ),
  );

  bool _matchesFilter(Map<String, dynamic> item) {
    final keyword = search.text.trim().toLowerCase();
    if (keyword.isNotEmpty && !_feedbackSearchText(item).contains(keyword)) {
      return false;
    }
    final hasReply = item['providerReply'] is Map;
    final rating = _number(item['rating']);
    return switch (filter) {
      _FeedbackQuickFilter.all => true,
      _FeedbackQuickFilter.pending => !hasReply,
      _FeedbackQuickFilter.replied => hasReply,
      _FeedbackQuickFilter.images =>
        item['images'] is List && (item['images'] as List).isNotEmpty,
      _FeedbackQuickFilter.five => rating >= 4.5,
      _FeedbackQuickFilter.four => rating >= 3.5 && rating < 4.5,
      _FeedbackQuickFilter.low => rating < 3.5,
    };
  }

  Future<void> _openReply(
    Map<String, dynamic> feedback, {
    Map<String, dynamic>? existingReply,
  }) async {
    final content = TextEditingController(
      text: '${existingReply?['content'] ?? ''}',
    );
    final existingImages = (existingReply?['images'] as List? ?? [])
        .whereType<String>()
        .toList();
    final files = <XFile>[];
    var submitting = false;
    String? error;
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, updateSheet) {
          Future<void> pickImages() async {
            final selected = await ImagePicker().pickMultiImage(
              imageQuality: 80,
            );
            if (selected.isEmpty) return;
            final valid = <XFile>[];
            final available = 5 - existingImages.length - files.length;
            for (final file in selected.take(available)) {
              if (await file.length() <= 5 * 1024 * 1024) valid.add(file);
            }
            updateSheet(() {
              files.addAll(valid);
              error = valid.length == selected.length
                  ? null
                  : 'Tối đa 5 ảnh, mỗi ảnh không quá 5 MB.';
            });
          }

          Future<void> submit() async {
            if (content.text.trim().isEmpty) {
              updateSheet(() => error = 'Vui lòng nhập nội dung phản hồi.');
              return;
            }
            updateSheet(() {
              submitting = true;
              error = null;
            });
            try {
              final repository = ref.read(providerRepositoryProvider);
              final uploadedImages = files.isEmpty
                  ? const <String>[]
                  : await repository.uploadFeedbackReplyImages(files);
              await repository.replyToFeedback(
                feedbackId: '${feedback['_id'] ?? feedback['id']}',
                content: content.text,
                images: [...existingImages, ...uploadedImages],
              );
              if (sheetContext.mounted) Navigator.pop(sheetContext, true);
            } catch (failure) {
              if (sheetContext.mounted) {
                updateSheet(() {
                  submitting = false;
                  error = _message(failure);
                });
              }
            }
          }

          return Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              4,
              20,
              MediaQuery.viewInsetsOf(context).bottom + 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    existingReply == null
                        ? 'Phản hồi khách hàng'
                        : 'Sửa phản hồi',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Phản hồi sẽ hiển thị công khai cùng đánh giá này.',
                    style: TextStyle(color: accountMuted),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: content,
                    minLines: 4,
                    maxLines: 7,
                    maxLength: 1000,
                    decoration: const InputDecoration(
                      hintText:
                          'Cảm ơn khách hàng và phản hồi một cách chuyên nghiệp...',
                      filled: true,
                      fillColor: accountBackground,
                    ),
                  ),
                  if (existingImages.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      'Ảnh đã gửi',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: existingImages.asMap().entries.map((entry) {
                        return InputChip(
                          avatar: const Icon(Icons.image_outlined, size: 18),
                          label: Text('Ảnh ${entry.key + 1}'),
                          onPressed: () => _previewImage(entry.value),
                          onDeleted: submitting
                              ? null
                              : () => updateSheet(
                                  () => existingImages.removeAt(entry.key),
                                ),
                        );
                      }).toList(),
                    ),
                  ],
                  if (files.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: files.asMap().entries.map((entry) {
                        return InputChip(
                          avatar: const Icon(Icons.image_outlined, size: 18),
                          label: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 150),
                            child: Text(
                              entry.value.name,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          onDeleted: submitting
                              ? null
                              : () => updateSheet(
                                  () => files.removeAt(entry.key),
                                ),
                        );
                      }).toList(),
                    ),
                  ],
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed:
                        submitting || existingImages.length + files.length >= 5
                        ? null
                        : pickImages,
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: Text(
                      'Thêm ảnh (${existingImages.length + files.length}/5)',
                    ),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 10),
                    Text(error!, style: const TextStyle(color: accountDanger)),
                  ],
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: submitting ? null : submit,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(50),
                    ),
                    icon: submitting
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send_outlined),
                    label: Text(
                      submitting
                          ? 'Đang lưu...'
                          : existingReply == null
                          ? 'Gửi phản hồi'
                          : 'Lưu chỉnh sửa',
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    content.dispose();
    if (sent == true && mounted) {
      ref.invalidate(providerFeedbacksProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            existingReply == null
                ? 'Đã gửi phản hồi đánh giá.'
                : 'Đã cập nhật phản hồi.',
          ),
        ),
      );
    }
  }

  void _previewImage(String url) => showDialog<void>(
    context: context,
    barrierColor: Colors.black87,
    builder: (dialogContext) => Dialog.fullscreen(
      backgroundColor: Colors.black,
      child: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: InteractiveViewer(
                minScale: 0.8,
                maxScale: 4,
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  errorBuilder: (_, error, stack) => const Center(
                    child: Text(
                      'Không thể tải hình ảnh.',
                      style: TextStyle(color: Colors.white),
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 8,
              right: 8,
              child: IconButton.filled(
                tooltip: 'Đóng ảnh',
                onPressed: () => Navigator.pop(dialogContext),
                icon: const Icon(Icons.close_rounded),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _FeedbackQuickToolbar extends StatelessWidget {
  const _FeedbackQuickToolbar({
    required this.resultCount,
    required this.controller,
    required this.selected,
    required this.onSearch,
    required this.onFilter,
  });
  final int resultCount;
  final TextEditingController controller;
  final _FeedbackQuickFilter selected;
  final ValueChanged<String> onSearch;
  final ValueChanged<_FeedbackQuickFilter> onFilter;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      TextField(
        controller: controller,
        onChanged: onSearch,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Tìm khách hàng, dịch vụ, nội dung...',
          hintStyle: TextStyle(
            color: Theme.of(context).brightness == Brightness.light
                ? Colors.black
                : Theme.of(context).colorScheme.onSurface,
          ),
          prefixIcon: const Icon(Icons.search_rounded),
          suffixIcon: controller.text.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Xóa tìm kiếm',
                  onPressed: () {
                    controller.clear();
                    onSearch('');
                  },
                  icon: const Icon(Icons.close_rounded),
                ),
          filled: true,
          fillColor: accountSurface,
        ),
      ),
      const SizedBox(height: 10),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _FeedbackQuickFilter.values.map((value) {
            final (label, icon) = switch (value) {
              _FeedbackQuickFilter.all => ('Tất cả', null),
              _FeedbackQuickFilter.pending => (
                'Chưa phản hồi',
                Icons.reply_outlined,
              ),
              _FeedbackQuickFilter.replied => (
                'Đã phản hồi',
                Icons.check_rounded,
              ),
              _FeedbackQuickFilter.images => ('Có ảnh', Icons.photo_outlined),
              _FeedbackQuickFilter.five => ('5 sao', Icons.star_rounded),
              _FeedbackQuickFilter.four => ('4 sao', Icons.star_rounded),
              _FeedbackQuickFilter.low => ('1–3 sao', Icons.star_half_rounded),
            };
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                avatar: icon == null ? null : Icon(icon, size: 18),
                label: Text(label),
                selected: selected == value,
                onSelected: (_) => onFilter(value),
              ),
            );
          }).toList(),
        ),
      ),
      const SizedBox(height: 8),
      Text(
        '$resultCount kết quả',
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: accountMuted,
          fontWeight: FontWeight.w600,
        ),
      ),
    ],
  );
}

class _FilteredFeedbackEmpty extends StatelessWidget {
  const _FilteredFeedbackEmpty();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 34),
    decoration: BoxDecoration(
      color: accountSurface,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: accountDivider),
    ),
    child: const Column(
      children: [
        Icon(Icons.manage_search_rounded, size: 36, color: accountMuted),
        SizedBox(height: 10),
        Text(
          'Không có đánh giá phù hợp với bộ lọc.',
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );
}

class _ProviderFeedbackCard extends StatelessWidget {
  const _ProviderFeedbackCard({
    required this.feedback,
    required this.onPreviewImage,
    required this.onReply,
    required this.onEditReply,
  });
  final Map<String, dynamic> feedback;
  final ValueChanged<String> onPreviewImage;
  final VoidCallback onReply;
  final VoidCallback onEditReply;

  @override
  Widget build(BuildContext context) {
    final customer = feedback['customerId'] is Map
        ? Map<String, dynamic>.from(feedback['customerId'] as Map)
        : const <String, dynamic>{};
    final service = feedback['serviceId'] is Map
        ? Map<String, dynamic>.from(feedback['serviceId'] as Map)
        : const <String, dynamic>{};
    final reply = feedback['providerReply'] is Map
        ? Map<String, dynamic>.from(feedback['providerReply'] as Map)
        : null;
    final images = (feedback['images'] as List? ?? [])
        .whereType<String>()
        .where((url) => url.trim().isNotEmpty)
        .toList();
    final replyImages = (reply?['images'] as List? ?? [])
        .whereType<String>()
        .where((url) => url.trim().isNotEmpty)
        .toList();
    final customerName = '${customer['fullName'] ?? 'Khách hàng'}';
    final avatar = '${customer['avatar'] ?? ''}'.trim();
    final serviceName = '${service['name'] ?? 'Dịch vụ tại nhà'}';
    final rating = _number(feedback['rating']).round();
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: accountDivider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 22,
                  backgroundColor: accountPrimarySoft,
                  backgroundImage: avatar.isEmpty ? null : NetworkImage(avatar),
                  child: avatar.isEmpty
                      ? Text(
                          _initials(customerName),
                          style: const TextStyle(
                            color: accountPrimary,
                            fontWeight: FontWeight.w700,
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        customerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '$serviceName • ${_date(feedback['createdAt'])}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: accountMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: List.generate(
                5,
                (index) => Icon(
                  index < rating
                      ? Icons.star_rounded
                      : Icons.star_border_rounded,
                  color: AppTheme.starGold,
                  size: 21,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '${feedback['comment'] ?? 'Khách hàng đã đánh giá dịch vụ nhưng không để lại nhận xét.'}',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(height: 1.45, color: accountInk),
            ),
            if (images.isNotEmpty) ...[
              const SizedBox(height: 12),
              _FeedbackImageStrip(images: images, onPreview: onPreviewImage),
            ],
            const SizedBox(height: 14),
            const Divider(height: 1),
            const SizedBox(height: 12),
            if (reply != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: accountPrimarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.reply_rounded,
                          color: accountPrimary,
                          size: 20,
                        ),
                        const SizedBox(width: 7),
                        const Expanded(
                          child: Text(
                            'Phản hồi của bạn',
                            style: TextStyle(
                              color: accountPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Sửa phản hồi',
                          onPressed: onEditReply,
                          visualDensity: VisualDensity.compact,
                          icon: const Icon(Icons.edit_outlined, size: 20),
                          color: accountPrimary,
                        ),
                      ],
                    ),
                    Text(
                      'Đã gửi ${_date(reply['repliedAt'])}',
                      style: Theme.of(
                        context,
                      ).textTheme.labelSmall?.copyWith(color: accountMuted),
                    ),
                    const SizedBox(height: 8),
                    Text('${reply['content'] ?? ''}'),
                    if (replyImages.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      _FeedbackImageStrip(
                        images: replyImages,
                        onPreview: onPreviewImage,
                      ),
                    ],
                  ],
                ),
              )
            else
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.tonalIcon(
                  onPressed: onReply,
                  icon: const Icon(Icons.reply_rounded),
                  label: const Text('Phản hồi'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _FeedbackImageStrip extends StatelessWidget {
  const _FeedbackImageStrip({required this.images, required this.onPreview});
  final List<String> images;
  final ValueChanged<String> onPreview;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 84,
    child: ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: images.length,
      separatorBuilder: (_, index) => const SizedBox(width: 8),
      itemBuilder: (context, index) => Semantics(
        button: true,
        label: 'Xem ảnh đánh giá ${index + 1}',
        child: InkWell(
          onTap: () => onPreview(images[index]),
          borderRadius: BorderRadius.circular(12),
          child: Ink(
            width: 84,
            decoration: BoxDecoration(
              color: accountBackground,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: accountDivider),
              image: DecorationImage(
                image: NetworkImage(images[index]),
                fit: BoxFit.cover,
                onError: (_, stack) {},
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

String _feedbackSearchText(Map<String, dynamic> feedback) {
  final customer = feedback['customerId'] is Map
      ? feedback['customerId'] as Map
      : const {};
  final service = feedback['serviceId'] is Map
      ? feedback['serviceId'] as Map
      : const {};
  final reply = feedback['providerReply'] is Map
      ? feedback['providerReply'] as Map
      : const {};
  return [
    customer['fullName'],
    service['name'],
    feedback['comment'],
    reply['content'],
  ].whereType<Object>().join(' ').toLowerCase();
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) return 'KH';
  return parts.length == 1
      ? parts.first.substring(0, 1).toUpperCase()
      : '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}

class ProviderSettingsScreen extends ConsumerStatefulWidget {
  const ProviderSettingsScreen({super.key});
  @override
  ConsumerState<ProviderSettingsScreen> createState() =>
      _ProviderSettingsScreenState();
}

class _ProviderSettingsScreenState
    extends ConsumerState<ProviderSettingsScreen> {
  bool notifications = true;
  bool biometric = false;

  @override
  Widget build(BuildContext context) => AccountDetailScaffold(
    title: 'Cài đặt & Bảo mật',
    child: ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        Card(
          margin: EdgeInsets.zero,
          child: Column(
            children: [
              SwitchListTile(
                secondary: const Icon(Icons.notifications_active_outlined),
                title: const Text('Thông báo & nhắc lịch'),
                subtitle: const Text('Đơn mới, lịch hẹn và tin nhắn'),
                value: notifications,
                onChanged: (value) => setState(() => notifications = value),
              ),
              const Divider(height: 1),
              SwitchListTile(
                secondary: const Icon(Icons.fingerprint_rounded),
                title: const Text('Bảo mật sinh trắc học'),
                subtitle: const Text('Face ID hoặc vân tay trên thiết bị này'),
                value: biometric,
                onChanged: (value) => setState(() => biometric = value),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Card(
          margin: EdgeInsets.zero,
          child: const Column(
            children: [
              ListTile(
                leading: Icon(Icons.lock_outline_rounded),
                title: Text('Đổi mật khẩu đăng nhập'),
                subtitle: Text('Cập nhật định kỳ để tăng an toàn'),
              ),
              Divider(height: 1),
              ListTile(
                leading: Icon(Icons.devices_outlined),
                title: Text('Thiết bị đăng nhập'),
                subtitle: Text('Quản lý các phiên đang hoạt động'),
              ),
              Divider(height: 1),
              ListTile(
                leading: Icon(Icons.privacy_tip_outlined),
                title: Text('Điều khoản & quyền riêng tư'),
                subtitle: Text('Cách Handigo bảo vệ dữ liệu của bạn'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        AccountLogoutButton(
          onPressed: () async {
            final user = ref.read(authControllerProvider).user;
            final confirmed = await showAccountLogoutConfirmation(
              context,
              userName: user?.fullName ?? 'Đối tác Handigo',
            );
            if (confirmed) {
              await ref.read(authControllerProvider).logout();
            }
          },
        ),
        const AccountVersionFooter(),
      ],
    ),
  );
}

List<String> _serviceLabels(dynamic value) => value is List
    ? value
          .map((item) => item is Map ? '${item['name'] ?? ''}' : '$item')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList()
    : const [];
String _transactionStatus(String? value) =>
    {
      'pending': 'Đang xử lý',
      'completed': 'Hoàn tất',
      'success': 'Thành công',
      'approved': 'Đã duyệt',
      'rejected': 'Đã từ chối',
      'failed': 'Thất bại',
      'cancelled': 'Đã hủy',
    }[value] ??
    value ??
    '';
String _transactionType(String value) =>
    {
      'deposit': 'Nạp tiền vào ví',
      'payment': 'Thanh toán đơn hàng',
      'refund': 'Hoàn tiền',
      'provider_earning': 'Thu nhập dịch vụ sau phí',
      'platform_fee': 'Phí nền tảng',
      'withdraw': 'Rút tiền',
      'withdraw_rejected': 'Hoàn tiền rút bị từ chối',
      'adjustment': 'Điều chỉnh số dư',
    }[value] ??
    value;
double _number(dynamic value) =>
    value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
String _money(double value) => NumberFormat.currency(
  locale: 'vi_VN',
  symbol: 'đ',
  decimalDigits: 0,
).format(value);
String _date(dynamic value) => value == null
    ? 'Chưa có thời gian'
    : DateFormat(
        'dd/MM/yyyy HH:mm',
      ).format(DateTime.tryParse('$value')?.toLocal() ?? DateTime.now());
String _message(Object error) => error is ApiException
    ? error.message
    : 'Không thể tải dữ liệu. Vui lòng thử lại.';
