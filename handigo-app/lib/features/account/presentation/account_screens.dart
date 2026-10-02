import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/paged_result.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/app_states.dart';
import '../data/account_repository.dart';
import '../domain/account_models.dart';

final accountRepositoryProvider = Provider<AccountRepository>(
  (ref) => AccountRepository(ref.watch(apiClientProvider)),
);
final accountProfileProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).profile(),
);
final accountAddressesProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).addresses(),
);
final accountWalletProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).wallet(),
);
final accountTransactionsProvider =
    FutureProvider.autoDispose<PagedResult<WalletTransactionItem>>(
      (ref) => ref.watch(accountRepositoryProvider).walletTransactions(),
    );
final accountVouchersProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).vouchers(),
);
final accountFeedbackProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).feedbacks(),
);
final accountTicketsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).tickets(),
);
final accountComplaintsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).complaints(),
);

class AccountOverviewScreen extends ConsumerWidget {
  const AccountOverviewScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final scheme = Theme.of(context).colorScheme;
    final user = auth.user;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => context.canPop() ? context.pop() : null,
          icon: const Icon(Icons.arrow_back),
        ),
        title: const Text('Tài khoản & Cài đặt'),
        actions: [
          IconButton(
            tooltip: 'Trợ giúp',
            onPressed: () => context.push('/customer/support'),
            icon: const Icon(Icons.help_outline),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          _ProfileSummaryCard(
            name: user?.fullName ?? 'Khách hàng',
            email: user?.email ?? 'Chưa cập nhật email',
            role: user?.role.label ?? 'Khách hàng',
            avatarUrl: user?.avatar,
            isGoogleAccount: user?.isGoogleAccount ?? false,
            onEdit: () => context.push('/customer/profile'),
          ),
          const SizedBox(height: 16),
          _AccountSection(
            title: 'Quản lý cá nhân',
            items: [
              _MenuItem(
                'Đăng ký trở thành Provider',
                Icons.handyman_outlined,
                () => context.push('/customer/provider-onboarding'),
              ),
              _MenuItem(
                'Địa chỉ của tôi',
                Icons.location_on_outlined,
                () => context.push('/customer/addresses'),
              ),
              _MenuItem(
                'Ví Handigo',
                Icons.account_balance_wallet_outlined,
                () => context.push('/customer/wallet'),
              ),
              _MenuItem(
                'Kho voucher',
                Icons.confirmation_num_outlined,
                () => context.push('/customer/vouchers'),
              ),
              _MenuItem(
                'Đánh giá của tôi',
                Icons.star_border,
                () => context.push('/customer/feedback'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _AccountSection(
            title: 'Hỗ trợ & cài đặt',
            items: [
              _MenuItem(
                'Trung tâm hỗ trợ',
                Icons.help_outline,
                () => context.push('/customer/support'),
              ),
              _MenuItem(
                'Khiếu nại / báo cáo sự cố',
                Icons.report_problem_outlined,
                () => context.push('/customer/complaints'),
              ),
              _MenuItem(
                'Cài đặt bảo mật và thông báo',
                Icons.settings_outlined,
                () => context.push('/customer/settings'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => ref.read(authControllerProvider).logout(),
            icon: const Icon(Icons.logout),
            label: const Text('Đăng xuất'),
            style: OutlinedButton.styleFrom(
              foregroundColor: scheme.error,
              side: BorderSide(color: scheme.error.withValues(alpha: .35)),
            ),
          ),
        ],
      ),
    );
  }
}

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _name = TextEditingController(), _phone = TextEditingController();
  bool _saving = false;
  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: IconButton(
        tooltip: 'Quay lại',
        onPressed: () => context.canPop() ? context.pop() : null,
        icon: const Icon(Icons.arrow_back),
      ),
      title: const Text('Thông tin cá nhân'),
    ),
    body: ref
        .watch(accountProfileProvider)
        .when(
          loading: () => const AppLoading(),
          error: (_, __) => AppMessage(
            message: 'Không thể tải hồ sơ.',
            onRetry: () => ref.invalidate(accountProfileProvider),
          ),
          data: (profile) {
            if (_name.text.isEmpty) {
              _name.text = '${profile['fullName'] ?? ''}';
              _phone.text = '${profile['phone'] ?? ''}';
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                _ProfileHero(
                  name: _name.text.isEmpty ? 'Khách hàng' : _name.text,
                  email: '${profile['email'] ?? ''}',
                ),
                const SizedBox(height: 24),
                const _SectionLabel('Thông tin tài khoản'),
                const SizedBox(height: 8),
                _ProfileField(
                  icon: Icons.person_outline,
                  child: TextFormField(
                    controller: _name,
                    decoration: const InputDecoration(labelText: 'Họ và tên'),
                  ),
                ),
                const SizedBox(height: 12),
                _ProfileField(
                  icon: Icons.email_outlined,
                  child: TextFormField(
                    initialValue: '${profile['email'] ?? ''}',
                    readOnly: true,
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                ),
                const SizedBox(height: 12),
                _ProfileField(
                  icon: Icons.phone_outlined,
                  child: TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Số điện thoại',
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const _SectionLabel('Vai trò & tư cách thành viên'),
                const SizedBox(height: 8),
                _InfoCard(
                  icon: Icons.verified_user_outlined,
                  title: 'Tài khoản khách hàng',
                  subtitle: 'Thông tin được bảo vệ bởi Handigo',
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _saving
                      ? null
                      : () async {
                          setState(() => _saving = true);
                          try {
                            await ref
                                .read(accountRepositoryProvider)
                                .updateProfile({
                                  'fullName': _name.text.trim(),
                                  'phone': _phone.text.trim(),
                                });
                            if (mounted)
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Đã cập nhật hồ sơ.'),
                                ),
                              );
                          } catch (_) {
                            if (mounted)
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Không thể cập nhật hồ sơ.'),
                                ),
                              );
                          } finally {
                            if (mounted) setState(() => _saving = false);
                          }
                        },
                  child: Text(_saving ? 'Đang lưu...' : 'Cập nhật hồ sơ'),
                ),
              ],
            );
          },
        ),
  );
}

class AddressScreen extends ConsumerWidget {
  const AddressScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => context.canPop() ? context.pop() : null,
          icon: const Icon(Icons.arrow_back),
        ),
        title: const Text('Sổ địa chỉ của tôi'),
        actions: [
          IconButton(
            onPressed: () => _addressForm(context, ref),
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: ref
          .watch(accountAddressesProvider)
          .when(
            loading: () => const AppLoading(),
            error: (_, __) => AppMessage(
              message: 'Không thể tải địa chỉ.',
              onRetry: () => ref.invalidate(accountAddressesProvider),
            ),
            data: (items) {
              if (items.isEmpty)
                return _EmptyAddress(onAdd: () => _addressForm(context, ref));
              return RefreshIndicator(
                onRefresh: () => ref.refresh(accountAddressesProvider.future),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                  itemCount: items.length + 1,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, index) {
                    if (index == 0) {
                      return _AddAddressCard(
                        onTap: () => _addressForm(context, ref),
                      );
                    }
                    final item = items[index - 1];
                    return _AddressCard(
                      item: item,
                      onSelected: (value) async {
                        if (value == 'default')
                          await ref
                              .read(accountRepositoryProvider)
                              .updateAddress(item.id, {'isDefault': true});
                        if (value == 'delete')
                          await ref
                              .read(accountRepositoryProvider)
                              .deleteAddress(item.id);
                        ref.invalidate(accountAddressesProvider);
                      },
                    );
                  },
                ),
              );
            },
          ),
    );
  }
}

Future<void> _addressForm(BuildContext context, WidgetRef ref) async {
  final name = TextEditingController(),
      phone = TextEditingController(),
      address = TextEditingController(),
      province = TextEditingController(),
      ward = TextEditingController();
  final form = await showDialog<Map<String, String>>(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('Thêm địa chỉ'),
      content: SingleChildScrollView(
        child: Column(
          children: [
            _field(name, 'Người nhận'),
            _field(phone, 'Số điện thoại'),
            _field(address, 'Địa chỉ đầy đủ'),
            _field(province, 'Tỉnh/thành phố'),
            _field(ward, 'Phường/xã'),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, {
            'recipientName': name.text,
            'recipientPhone': phone.text,
            'fullAddress': address.text,
            'province': province.text,
            'ward': ward.text,
          }),
          child: const Text('Lưu'),
        ),
      ],
    ),
  );
  if (form != null && form.values.every((v) => v.trim().isNotEmpty)) {
    await ref.read(accountRepositoryProvider).createAddress(form);
    ref.invalidate(accountAddressesProvider);
  }
}

Widget _field(TextEditingController c, String label) => Padding(
  padding: const EdgeInsets.only(bottom: 8),
  child: TextField(
    controller: c,
    decoration: InputDecoration(labelText: label),
  ),
);

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ví Handigo'),
        actions: [
          IconButton(
            onPressed: () => _deposit(context, ref),
            icon: const Icon(Icons.add_card),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ref
              .watch(accountWalletProvider)
              .when(
                loading: () => const AppLoading(),
                error: (_, __) => AppMessage(
                  message: 'Không thể tải ví.',
                  onRetry: () => ref.invalidate(accountWalletProvider),
                ),
                data: (wallet) => Card(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.account_balance_wallet_outlined,
                              color: Theme.of(
                                context,
                              ).colorScheme.onPrimaryContainer,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Ví Handigo',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const Spacer(),
                            Text(
                              wallet.currency,
                              style: Theme.of(context).textTheme.labelMedium,
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Số dư khả dụng',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _money(wallet.balance),
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        if (wallet.pendingBalance > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              'Đang chờ xử lý: ${_money(wallet.pendingBalance)}',
                            ),
                          ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton.icon(
                                onPressed: () => _deposit(context, ref),
                                icon: const Icon(Icons.add, size: 18),
                                label: const Text('Nạp tiền'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: null,
                                icon: const Icon(Icons.history, size: 18),
                                label: const Text('Lịch sử'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          const SizedBox(height: 16),
          Text(
            'Lịch sử giao dịch',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          ref
              .watch(accountTransactionsProvider)
              .when(
                loading: () => const AppLoading(),
                error: (_, __) =>
                    const AppMessage(message: 'Không thể tải giao dịch.'),
                data: (page) => page.items.isEmpty
                    ? const AppMessage(message: 'Chưa có giao dịch.')
                    : Column(
                        children: page.items.map((item) {
                          final incoming = item.direction == 'in';
                          final tone = incoming ? scheme.secondary : scheme.error;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 3,
                              ),
                              leading: CircleAvatar(
                                backgroundColor: tone.withValues(alpha: .12),
                                foregroundColor: tone,
                                child: Icon(
                                  incoming
                                      ? Icons.arrow_downward
                                      : Icons.arrow_upward,
                                  size: 18,
                                ),
                              ),
                              title: Text(
                                item.description ??
                                    _transactionLabel(item.type),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(item.status ?? ''),
                              trailing: Text(
                                '${incoming ? '+' : '-'}${_money(item.amount)}',
                                style: Theme.of(context).textTheme.labelLarge
                                    ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: tone,
                                    ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
              ),
        ],
      ),
    );
  }
}

Future<void> _deposit(BuildContext context, WidgetRef ref) async {
  final c = TextEditingController();
  final amount = await showDialog<double>(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('Nạp tiền vào ví'),
      content: TextField(
        controller: c,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Số tiền (VND)'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, double.tryParse(c.text)),
          child: const Text('Tiếp tục'),
        ),
      ],
    ),
  );
  if (amount == null || amount <= 0 || !context.mounted) return;
  try {
    final data = await ref.read(accountRepositoryProvider).deposit(amount);
    final url = data['checkoutUrl'];
    if (url is String && url.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Đã tạo liên kết thanh toán. Hãy mở trên trình duyệt để hoàn tất.',
          ),
        ),
      );
    }
    ref.invalidate(accountWalletProvider);
  } catch (_) {
    if (context.mounted)
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không thể tạo giao dịch nạp ví.')),
      );
  }
}

class VoucherScreen extends ConsumerWidget {
  const VoucherScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kho Voucher & Ưu đãi'),
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      body: ref
          .watch(accountVouchersProvider)
          .when(
            loading: () => const AppLoading(),
            error: (_, __) => AppMessage(
              message: 'Không thể tải voucher.',
              onRetry: () => ref.invalidate(accountVouchersProvider),
            ),
            data: (items) {
              if (items.isEmpty)
                return const AppMessage(
                  message: 'Hiện chưa có voucher khả dụng.',
                );
              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          decoration: const InputDecoration(
                            hintText: 'Nhập mã khuyến mãi/voucher',
                            prefixIcon: Icon(Icons.local_offer_outlined),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Mã voucher được áp dụng trong bước đặt dịch vụ.',
                            ),
                          ),
                        ),
                        child: const Text('Áp dụng'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Theme.of(context).colorScheme.primary,
                          Theme.of(context).colorScheme.secondary,
                        ],
                      ),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.auto_awesome, color: Colors.white),
                        SizedBox(height: 10),
                        Text(
                          'Ưu đãi dành riêng cho bạn',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Chọn voucher phù hợp để tiết kiệm hơn cho dịch vụ tại nhà.',
                          style: TextStyle(color: Colors.white70),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Voucher khả dụng',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ...items.map((item) => _VoucherCard(item: item)),
                ],
              );
            },
          ),
    );
  }
}

class _VoucherCard extends StatelessWidget {
  const _VoucherCard({required this.item});
  final VoucherItem item;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final discount = item.discountType == 'PERCENT'
        ? '${item.discountValue.toStringAsFixed(0)}%'
        : _money(item.discountValue);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                color: theme.colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                Icons.confirmation_num_outlined,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    discount,
                    style: theme.textTheme.titleLarge?.copyWith(
                      color: theme.colorScheme.primary,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  if (item.description?.isNotEmpty == true)
                    Text(
                      item.description!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall,
                    ),
                  const SizedBox(height: 4),
                  Text(
                    'Mã: ${item.code}',
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  if (item.minOrderAmount > 0)
                    Text(
                      'Đơn tối thiểu ${_money(item.minOrderAmount)}',
                      style: theme.textTheme.labelSmall,
                    ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Đã chọn voucher ${item.code}.')),
              ),
              child: const Text('Dùng ngay'),
            ),
          ],
        ),
      ),
    );
  }
}

class FeedbackScreen extends ConsumerWidget {
  const FeedbackScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Đánh giá của tôi')),
      body: ref
          .watch(accountFeedbackProvider)
          .when(
            loading: () => const AppLoading(),
            error: (_, __) => AppMessage(
              message: 'Không thể tải đánh giá.',
              onRetry: () => ref.invalidate(accountFeedbackProvider),
            ),
            data: (items) {
              if (items.isEmpty)
                return const AppMessage(message: 'Bạn chưa có đánh giá nào.');
              return ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, index) {
                  final item = items[index];
                  return Card(
                    child: ListTile(
                      title: Text(
                        '★' * item.rating,
                        style: TextStyle(color: AppTheme.starGold),
                      ),
                      subtitle: Text(item.comment ?? 'Không có nhận xét'),
                      trailing: Text(item.providerName ?? 'Provider'),
                    ),
                  );
                },
              );
            },
          ),
    );
  }
}

class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => _CaseList(
    title: 'Trung tâm hỗ trợ',
    provider: accountTicketsProvider,
    onCreate: () => _createCase(context, ref, complaint: false),
    empty: 'Bạn chưa có yêu cầu hỗ trợ nào.',
  );
}

class ComplaintScreen extends ConsumerWidget {
  const ComplaintScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => _CaseList(
    title: 'Khiếu nại / sự cố',
    provider: accountComplaintsProvider,
    onCreate: () => _createCase(context, ref, complaint: true),
    empty: 'Bạn chưa có khiếu nại nào.',
  );
}

class _CaseList extends ConsumerWidget {
  const _CaseList({
    required this.title,
    required this.provider,
    required this.onCreate,
    required this.empty,
  });
  final String title, empty;
  final FutureProvider<dynamic> provider;
  final VoidCallback onCreate;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: Text(title),
      actions: [IconButton(onPressed: onCreate, icon: const Icon(Icons.add))],
    ),
    body: ref
        .watch(provider)
        .when(
          loading: () => const AppLoading(),
          error: (_, __) => AppMessage(
            message: 'Không thể tải dữ liệu.',
            onRetry: () => ref.invalidate(provider),
          ),
          data: (page) => page.items.isEmpty
              ? AppMessage(message: empty)
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: page.items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) => Card(
                    child: ListTile(
                      title: Text(page.items[i].title),
                      subtitle: Text(page.items[i].description),
                      trailing: Text(page.items[i].status),
                    ),
                  ),
                ),
        ),
  );
}

Future<void> _createCase(
  BuildContext context,
  WidgetRef ref, {
  required bool complaint,
}) async {
  final title = TextEditingController(),
      description = TextEditingController(),
      orderId = TextEditingController();
  final result = await showDialog<List<String>>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(complaint ? 'Tạo khiếu nại' : 'Tạo yêu cầu hỗ trợ'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (complaint) _field(orderId, 'Mã đơn hàng'),
          _field(title, 'Tiêu đề'),
          _field(description, 'Mô tả'),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, [
            orderId.text,
            title.text,
            description.text,
          ]),
          child: const Text('Gửi'),
        ),
      ],
    ),
  );
  if (result == null ||
      result[1].trim().length < 5 ||
      result[2].trim().length < 10)
    return;
  try {
    if (complaint) {
      if (result[0].trim().isEmpty) return;
      await ref.read(accountRepositoryProvider).createComplaint({
        'orderId': result[0].trim(),
        'title': result[1],
        'description': result[2],
      });
      ref.invalidate(accountComplaintsProvider);
    } else {
      await ref.read(accountRepositoryProvider).createTicket({
        'category': 'OTHER',
        'subject': result[1],
        'description': result[2],
      });
      ref.invalidate(accountTicketsProvider);
    }
  } catch (_) {
    if (context.mounted)
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Không thể gửi yêu cầu.')));
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool notifications = true, biometric = false;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      leading: IconButton(
        tooltip: 'Quay lại',
        onPressed: () => context.canPop() ? context.pop() : null,
        icon: const Icon(Icons.arrow_back),
      ),
      title: const Text('Cài đặt & Bảo mật'),
      actions: [
        IconButton(
          tooltip: 'Trợ giúp',
          onPressed: () => context.push('/customer/support'),
          icon: const Icon(Icons.help_outline),
        ),
      ],
    ),
    body: ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        _SecurityStatusCard(),
        const SizedBox(height: 24),
        const _SectionLabel('Thông báo đẩy & tin nhắn'),
        const SizedBox(height: 8),
        _SettingsGroup(
          children: [
            _SettingsToggle(
              icon: Icons.notifications_active_outlined,
              title: 'Nhận thông báo',
              subtitle: 'Cập nhật đơn hàng và lịch hẹn',
              value: notifications,
              onChanged: (v) => setState(() => notifications = v),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const _SectionLabel('Bảo mật & quyền riêng tư'),
        const SizedBox(height: 8),
        _SettingsGroup(
          children: [
            _SettingsToggle(
              icon: Icons.fingerprint,
              title: 'Khóa ứng dụng bằng sinh trắc học',
              subtitle: 'Bảo vệ tài khoản trên thiết bị này',
              value: biometric,
              onChanged: (v) => setState(() => biometric = v),
            ),
            const _SettingsTile(
              icon: Icons.lock_outline,
              title: 'Đổi mật khẩu đăng nhập',
              subtitle: 'Cập nhật định kỳ để tăng an toàn',
            ),
            const _SettingsTile(
              icon: Icons.devices_outlined,
              title: 'Thiết bị đăng nhập',
              subtitle: 'Quản lý các phiên đang hoạt động',
            ),
          ],
        ),
        const SizedBox(height: 24),
        const _SectionLabel('Thông tin ứng dụng'),
        const SizedBox(height: 8),
        const _SettingsGroup(
          children: [
            _SettingsTile(
              icon: Icons.privacy_tip_outlined,
              title: 'Chính sách bảo mật',
              subtitle: 'Cách Handigo bảo vệ dữ liệu của bạn',
            ),
            _SettingsTile(
              icon: Icons.info_outline,
              title: 'Phiên bản ứng dụng',
              subtitle: 'Handigo mobile 0.1.0',
            ),
          ],
        ),
      ],
    ),
  );
}

class _MenuItem {
  const _MenuItem(this.label, this.icon, this.onTap);
  final String label;
  final IconData icon;
  final VoidCallback onTap;
}

class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({
    required this.name,
    required this.email,
    required this.role,
    required this.avatarUrl,
    required this.isGoogleAccount,
    required this.onEdit,
  });
  final String name, email, role;
  final String? avatarUrl;
  final bool isGoogleAccount;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: scheme.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: scheme.onSurface.withValues(alpha: .08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            _AccountAvatar(
              name: name,
              email: email,
              avatarUrl: avatarUrl,
              isGoogleAccount: isGoogleAccount,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(Icons.verified, size: 17, color: scheme.secondary),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(email, maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 6),
                  _StatusBadge(label: role),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Chỉnh sửa hồ sơ',
              onPressed: onEdit,
              icon: const Icon(Icons.edit_outlined),
            ),
          ],
        ),
      ),
    );
  }
}

class _AccountAvatar extends StatelessWidget {
  const _AccountAvatar({
    required this.name,
    required this.email,
    required this.avatarUrl,
    required this.isGoogleAccount,
  });
  final String name, email;
  final String? avatarUrl;
  final bool isGoogleAccount;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fallbackColor = _avatarColor(scheme, email, isGoogleAccount);
    return Container(
      width: 60,
      height: 60,
      decoration: BoxDecoration(
        color: fallbackColor,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: .16),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: usableMediaUrl(avatarUrl) != null
          ? Image.network(
              usableMediaUrl(avatarUrl)!,
              width: 60,
              height: 60,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _initial(context),
            )
          : _initial(context),
    );
  }

  Widget _initial(BuildContext context) => Text(
    name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
      color: Colors.white,
      fontWeight: FontWeight.w800,
    ),
  );
}

Color _avatarColor(ColorScheme scheme, String email, bool isGoogleAccount) {
  final isGmail = email.toLowerCase().endsWith('@gmail.com');
  if (!isGmail && !isGoogleAccount) return scheme.primaryContainer;
  const colors = [
    AppTheme.primary,
    AppTheme.secondary,
    Color(0xFF7D3000),
    Color(0xFF006A7C),
  ];
  final hash = email.codeUnits.fold<int>(0, (sum, value) => sum + value);
  return colors[hash % colors.length];
}

class _AccountSection extends StatelessWidget {
  const _AccountSection({required this.title, required this.items});
  final String title;
  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _SectionLabel(title),
      const SizedBox(height: 8),
      _MenuCard(items: items),
    ],
  );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: Theme.of(
      context,
    ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
  );
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.secondaryContainer,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Text(label, style: Theme.of(context).textTheme.labelSmall),
  );
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.name, required this.email});
  final String name, email;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Stack(
          alignment: Alignment.bottomRight,
          children: [
            CircleAvatar(
              radius: 48,
              backgroundColor: scheme.primaryContainer,
              foregroundColor: scheme.onPrimaryContainer,
              child: Text(
                name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
                style: Theme.of(context).textTheme.headlineLarge,
              ),
            ),
            CircleAvatar(
              radius: 16,
              backgroundColor: scheme.secondary,
              foregroundColor: scheme.onSecondary,
              child: const Icon(Icons.camera_alt_outlined, size: 17),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(name, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(email, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _ProfileField extends StatelessWidget {
  const _ProfileField({required this.icon, required this.child});
  final IconData icon;
  final Widget child;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.only(top: 16, right: 10),
        child: Icon(icon),
      ),
      Expanded(child: child),
    ],
  );
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title, subtitle;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: Icon(icon, color: Theme.of(context).colorScheme.secondary),
      title: Text(title),
      subtitle: Text(subtitle),
    ),
  );
}

class _AddAddressCard extends StatelessWidget {
  const _AddAddressCard({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      onTap: onTap,
      leading: const Icon(Icons.add_location_alt_outlined),
      title: const Text('Thêm địa chỉ mới'),
      subtitle: const Text('Thêm nhà riêng, văn phòng hoặc địa chỉ khác'),
      trailing: const Icon(Icons.chevron_right),
    ),
  );
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({required this.item, required this.onSelected});
  final AddressItem item;
  final ValueChanged<String> onSelected;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(item.isDefault ? Icons.home : Icons.location_on_outlined),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item.isDefault ? 'Nhà riêng' : 'Địa chỉ đã lưu',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (item.isDefault) const _StatusBadge(label: 'Mặc định'),
              PopupMenuButton<String>(
                onSelected: onSelected,
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'default', child: Text('Đặt mặc định')),
                  PopupMenuItem(value: 'delete', child: Text('Xóa')),
                ],
              ),
            ],
          ),
          const Divider(height: 18),
          Text(
            item.recipientName,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 4),
          Text(item.recipientPhone),
          const SizedBox(height: 8),
          Text(item.fullAddress),
          const SizedBox(height: 4),
          Text(
            '${item.ward}, ${item.province}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    ),
  );
}

class _EmptyAddress extends StatelessWidget {
  const _EmptyAddress({required this.onAdd});
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.location_off_outlined,
            size: 56,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 16),
          Text(
            'Bạn chưa có địa chỉ',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          const Text(
            'Thêm địa chỉ để đặt dịch vụ nhanh hơn.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add),
            label: const Text('Thêm địa chỉ'),
          ),
        ],
      ),
    ),
  );
}

class _SecurityStatusCard extends StatelessWidget {
  const _SecurityStatusCard();
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.secondaryContainer,
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: Icon(
          Icons.shield_outlined,
          size: 34,
          color: scheme.onSecondaryContainer,
        ),
        title: const Text('Tài khoản được bảo vệ'),
        subtitle: const Padding(
          padding: EdgeInsets.only(top: 4),
          child: Text('Thiết lập bảo mật giúp dữ liệu của bạn an toàn hơn.'),
        ),
      ),
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: Column(
      children: [
        for (var i = 0; i < children.length; i++) ...[
          if (i > 0) const Divider(height: 1),
          children[i],
        ],
      ],
    ),
  );
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title, subtitle;
  @override
  Widget build(BuildContext context) => ListTile(
    minVerticalPadding: 12,
    leading: Icon(icon),
    title: Text(title),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right),
  );
}

class _SettingsToggle extends StatelessWidget {
  const _SettingsToggle({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });
  final IconData icon;
  final String title, subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => SwitchListTile(
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
    secondary: Icon(icon),
    title: Text(title),
    subtitle: Text(subtitle),
    value: value,
    onChanged: onChanged,
  );
}

class _MenuCard extends StatelessWidget {
  const _MenuCard({required this.items});
  final List<_MenuItem> items;
  @override
  Widget build(BuildContext context) => Card(
    child: Column(
      children: items
          .map(
            (item) => ListTile(
              leading: Icon(item.icon),
              title: Text(item.label),
              trailing: const Icon(Icons.chevron_right),
              onTap: item.onTap,
            ),
          )
          .toList(),
    ),
  );
}

String _money(num value) => '${NumberFormat('#,##0', 'vi_VN').format(value)}đ';
String _transactionLabel(String type) => switch (type) {
  'deposit' => 'Nạp tiền',
  'payment' => 'Thanh toán đơn hàng',
  'refund' => 'Hoàn tiền',
  _ => 'Giao dịch ví',
};
