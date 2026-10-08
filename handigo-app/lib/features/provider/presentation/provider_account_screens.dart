import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_states.dart';
import '../../account/domain/account_models.dart';
import 'provider_screens.dart';

final providerProfileProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).profile(),
);
final providerWalletProvider = FutureProvider.autoDispose<WalletInfo>(
  (ref) => ref.watch(providerRepositoryProvider).wallet(),
);
final providerWalletTransactionsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).walletTransactions(),
);
final providerWithdrawalsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).withdrawals(),
);
final providerBanksProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).bankAccounts(),
);
final providerFeedbacksProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(providerRepositoryProvider).feedbacks(),
);

class ProviderProfileScreen extends ConsumerStatefulWidget {
  const ProviderProfileScreen({super.key});
  @override
  ConsumerState<ProviderProfileScreen> createState() =>
      _ProviderProfileScreenState();
}

class _ProviderProfileScreenState extends ConsumerState<ProviderProfileScreen> {
  final name = TextEditingController();
  final bio = TextEditingController();
  final service = TextEditingController();
  bool saving = false;
  @override
  void dispose() {
    name.dispose();
    bio.dispose();
    service.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(providerProfileProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Hồ sơ Đối tác'),
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
      ),
      body: state.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: _message(error),
          onRetry: () => ref.invalidate(providerProfileProvider),
        ),
        data: (data) {
          final provider =
              (data['provider'] as Map?)?.cast<String, dynamic>() ?? {};
          final user = (data['user'] as Map?)?.cast<String, dynamic>() ?? {};
          if (name.text.isEmpty) {
            name.text = '${user['fullName'] ?? ''}';
            bio.text = '${provider['bio'] ?? provider['description'] ?? ''}';
            service.text = '${provider['mainServiceText'] ?? ''}';
          }
          final certificates = (provider['certificates'] as List? ?? [])
              .whereType<Map>()
              .map((item) => item.cast<String, dynamic>())
              .toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
            children: [
              _ProfileHero(
                name: '${user['fullName'] ?? 'Đối tác Handigo'}',
                bio: '${provider['bio'] ?? provider['description'] ?? ''}',
                avatar: user['avatar'] as String?,
              ),
              const SizedBox(height: 16),
              _ProfileSection(
                title: 'Thông tin cá nhân',
                icon: Icons.person_outline_rounded,
                children: [
                  TextFormField(
                    controller: name,
                    decoration: const InputDecoration(
                      labelText: 'Họ và tên',
                      prefixIcon: Icon(Icons.badge_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    initialValue: '${user['email'] ?? ''}',
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: service,
                    decoration: const InputDecoration(
                      labelText: 'Chuyên môn chính',
                      prefixIcon: Icon(Icons.handyman_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: bio,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Giới thiệu',
                      alignLabelWithHint: true,
                      prefixIcon: Icon(Icons.notes_outlined),
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton.icon(
                    onPressed: saving ? null : () => _save(context),
                    icon: const Icon(Icons.save_outlined),
                    label: Text(saving ? 'Đang lưu...' : 'Lưu hồ sơ'),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _ProfileSection(
                title: 'Dịch vụ & khu vực phục vụ',
                icon: Icons.location_on_outlined,
                children: [
                  Text(_serviceNames(provider['services'])),
                  const SizedBox(height: 6),
                  Text(
                    _areas(provider['workingAreas'], provider['serviceArea']),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      'Chứng chỉ',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () => _addCertificate(context),
                    icon: const Icon(Icons.add),
                    label: const Text('Thêm'),
                  ),
                ],
              ),
              ...certificates.map(
                (item) => Card(
                  child: ListTile(
                    title: Text('${item['title'] ?? 'Chứng chỉ'}'),
                    subtitle: Text(
                      {
                            'pending': 'Chờ duyệt',
                            'approved': 'Đã duyệt',
                            'rejected': 'Chưa được duyệt',
                          }[item['status']] ??
                          'Chờ duyệt',
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () async {
                        await ref
                            .read(providerRepositoryProvider)
                            .deleteCertificate('${item['id'] ?? item['_id']}');
                        ref.invalidate(providerProfileProvider);
                      },
                    ),
                  ),
                ),
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
      await ref.read(providerRepositoryProvider).updateProfile({
        'fullName': name.text.trim(),
        'bio': bio.text.trim(),
        'mainServiceText': service.text.trim(),
      });
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

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.name, required this.bio, this.avatar});
  final String name, bio;
  final String? avatar;
  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          ProviderAvatar(url: avatar),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  bio.isEmpty
                      ? 'Hoàn thiện hồ sơ để khách hàng hiểu thêm về bạn.'
                      : bio,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({
    required this.title,
    required this.icon,
    required this.children,
  });
  final String title;
  final IconData icon;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    ),
  );
}

class ProviderWalletScreen extends ConsumerWidget {
  const ProviderWalletScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Ví Handigo')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ref
            .watch(providerWalletProvider)
            .when(
              loading: () => const AppLoading(),
              error: (error, _) => AppMessage(
                message: _message(error),
                onRetry: () => ref.invalidate(providerWalletProvider),
              ),
              data: (wallet) => _WalletBalanceCard(wallet: wallet),
            ),
        const SizedBox(height: 12),
        Text(
          'Lịch sử giao dịch',
          style: Theme.of(context).textTheme.titleMedium,
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
                  ? const AppMessage(message: 'Chưa có giao dịch.')
                  : Column(
                      children: page.items
                          .map(
                            (item) => Card(
                              margin: const EdgeInsets.only(top: 8),
                              child: ListTile(
                                leading: Icon(
                                  item.direction == 'in'
                                      ? Icons.south_west
                                      : Icons.north_east,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                                title: Text(item.description ?? item.type),
                                subtitle: Text(_transactionStatus(item.status)),
                                trailing: Text(
                                  '${item.direction == 'in' ? '+' : '-'}${_money(item.amount)}',
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
            ),
        const SizedBox(height: 20),
        Text(
          'Yêu cầu rút tiền',
          style: Theme.of(context).textTheme.titleMedium,
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
                                leading: Icon(
                                  Icons.payments_outlined,
                                  color: Theme.of(context).colorScheme.primary,
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
    ),
  );
}

class _WalletBalanceCard extends StatelessWidget {
  const _WalletBalanceCard({required this.wallet});
  final WalletInfo wallet;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: LinearGradient(
          colors: [scheme.primary, scheme.primaryContainer],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.account_balance_wallet_outlined,
                color: scheme.onPrimary,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Số dư khả dụng',
                  style: TextStyle(color: scheme.onPrimary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _money(wallet.balance),
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: scheme.onPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Chờ xử lý: ${_money(wallet.pendingBalance)}',
            style: TextStyle(color: scheme.onPrimary),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: scheme.onPrimary,
              side: BorderSide(color: scheme.onPrimary.withValues(alpha: .4)),
            ),
            onPressed: () => context.push('/provider/banks'),
            icon: const Icon(Icons.account_balance_outlined, size: 20),
            label: const Text('Tài khoản ngân hàng'),
          ),
        ],
      ),
    );
  }
}

class ProviderBankAccountsScreen extends ConsumerWidget {
  const ProviderBankAccountsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: const Text('Tài khoản ngân hàng'),
      actions: [
        IconButton(
          onPressed: () => _add(context, ref),
          icon: const Icon(Icons.add),
        ),
      ],
    ),
    body: ref
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

class ProviderFeedbackScreen extends ConsumerWidget {
  const ProviderFeedbackScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Đánh giá khách hàng')),
    body: ref
        .watch(providerFeedbacksProvider)
        .when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: _message(error),
            onRetry: () => ref.invalidate(providerFeedbacksProvider),
          ),
          data: (page) => page.items.isEmpty
              ? const AppMessage(message: 'Chưa có đánh giá nào.')
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: page.items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, index) {
                    final item = page.items[index];
                    return Card(
                      child: ListTile(
                        leading: Icon(Icons.star, color: AppTheme.starGold),
                        title: Text(
                          '${_number(item['rating']).toStringAsFixed(1)} / 5',
                        ),
                        subtitle: Text(
                          '${item['comment'] ?? 'Không có nhận xét'}\n${_date(item['createdAt'])}',
                        ),
                        isThreeLine: true,
                      ),
                    );
                  },
                ),
        ),
  );
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
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Cài đặt')),
    body: ListView(
      children: [
        SwitchListTile(
          title: const Text('Nhận thông báo'),
          value: notifications,
          onChanged: (value) => setState(() => notifications = value),
        ),
        const ListTile(
          title: Text('Phiên bản ứng dụng'),
          subtitle: Text('Handigo mobile 0.1.0'),
        ),
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('Đăng xuất'),
          onTap: () => ref.read(authControllerProvider).logout(),
        ),
      ],
    ),
  );
}

String _serviceNames(dynamic value) => value is List
    ? value.map((item) => item is Map ? '${item['name']}' : '$item').join(', ')
    : 'Chưa cập nhật dịch vụ';
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
String _areas(dynamic areas, dynamic serviceArea) =>
    'Khu vực: ${areas is List
        ? areas.join(', ')
        : serviceArea is Map
        ? '${serviceArea['province'] ?? ''} ${serviceArea['ward'] ?? ''}'
        : 'Chưa cập nhật'}';
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
