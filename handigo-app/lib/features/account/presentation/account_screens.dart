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

class AccountOverviewScreen extends ConsumerStatefulWidget {
  const AccountOverviewScreen({super.key});

  @override
  ConsumerState<AccountOverviewScreen> createState() =>
      _AccountOverviewScreenState();
}

class _AccountOverviewScreenState extends ConsumerState<AccountOverviewScreen> {
  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final scheme = Theme.of(context).colorScheme;
    final user = auth.user;
    final profile = ref.watch(accountProfileProvider).asData?.value;
    final addresses = ref.watch(accountAddressesProvider).asData?.value;
    final wallet = ref.watch(accountWalletProvider).asData?.value;
    final vouchers = ref.watch(accountVouchersProvider).asData?.value;
    final isApprovedProvider =
        user?.role.name == 'provider' ||
        user?.providerOnboardingStatus == 'APPROVED';

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        centerTitle: true,
        toolbarHeight: 56,
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => context.canPop() ? context.pop() : null,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: Text(
          'Tài khoản & Cài đặt',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: scheme.onSurface,
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Trợ giúp',
            onPressed: () => context.push('/customer/support'),
            icon: const Icon(Icons.support_agent_rounded, size: 21),
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: [
              _ProfileSummaryCard(
                name: user?.fullName ?? 'Khách hàng',
                contact: _maskedPhone('${profile?['phone'] ?? ''}'),
                badge: 'Thành viên Gold',
                avatarUrl: user?.avatar,
                isGoogleAccount: user?.isGoogleAccount ?? false,
                onEdit: () => context.push('/customer/profile'),
              ),
              const SizedBox(height: 12),
              _ProviderModeCard(
                isApproved: isApprovedProvider,
                onPressed: () => isApprovedProvider
                    ? context.go('/provider')
                    : context.push('/customer/provider-onboarding'),
              ),
              const SizedBox(height: 12),
              _WalletOverviewCard(
                balance: wallet?.balance,
                onDeposit: () => context.push('/customer/wallet'),
                onHistory: () => context.push('/customer/wallet'),
              ),
              const SizedBox(height: 16),
              _AccountSection(
                title: 'Quản lý cá nhân',
                items: [
                  _MenuItem(
                    label: 'Thông tin cá nhân',
                    subtitle: 'Hồ sơ, xác minh & thông tin liên hệ',
                    icon: Icons.badge_outlined,
                    onTap: () => context.push('/customer/profile'),
                  ),
                  _MenuItem(
                    label: 'Sổ địa chỉ',
                    subtitle: addresses == null
                        ? 'Quản lý các địa chỉ đã lưu'
                        : '${addresses.length} địa chỉ đã lưu',
                    icon: Icons.location_on_outlined,
                    onTap: () => context.push('/customer/addresses'),
                  ),
                  _MenuItem(
                    label: 'Phương thức thanh toán',
                    subtitle: 'Quản lý thẻ & tài khoản liên kết',
                    icon: Icons.credit_card_outlined,
                    onTap: () => context.push('/customer/wallet'),
                  ),
                  _MenuItem(
                    label: 'Kho Voucher & Ưu đãi của tôi',
                    subtitle: vouchers == null
                        ? 'Xem các ưu đãi đang có'
                        : '${vouchers.length} mã giảm giá sẵn sàng áp dụng',
                    icon: Icons.confirmation_num_outlined,
                    badge: vouchers == null ? null : '${vouchers.length} mã',
                    onTap: () => context.push('/customer/vouchers'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _AccountSection(
                title: 'Cài đặt ứng dụng',
                items: [
                  _MenuItem(
                    label: 'Thông báo & nhắc lịch',
                    subtitle: 'Lịch hẹn, tin nhắn & cập nhật dịch vụ',
                    icon: Icons.notifications_none_rounded,
                    onTap: () => context.push('/customer/notifications'),
                  ),
                  const _MenuItem(
                    label: 'Ngôn ngữ',
                    subtitle: 'Tiếng Việt',
                    icon: Icons.translate_rounded,
                  ),
                  _MenuItem(
                    label: 'Bảo mật & đăng nhập',
                    subtitle: 'Mật khẩu, Face ID & vân tay',
                    icon: Icons.verified_user_outlined,
                    onTap: () => context.push('/customer/settings'),
                  ),
                  _MenuItem(
                    label: 'Giao diện',
                    subtitle: 'Sáng - Theo cài đặt thiết bị',
                    icon: Icons.dark_mode_outlined,
                    onTap: () => context.push('/customer/settings'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _AccountSection(
                title: 'Hỗ trợ & thông tin',
                items: [
                  _MenuItem(
                    label: 'Trung tâm trợ giúp',
                    subtitle: 'Chat với Handigo - Hỗ trợ 24/7',
                    icon: Icons.support_agent_rounded,
                    onTap: () => context.push('/customer/support'),
                  ),
                  _MenuItem(
                    label: 'Góp ý & báo cáo sự cố',
                    subtitle: 'Chúng tôi luôn lắng nghe bạn',
                    icon: Icons.rate_review_outlined,
                    onTap: () => context.push('/customer/complaints'),
                  ),
                  _MenuItem(
                    label: 'Điều khoản & quyền riêng tư',
                    subtitle: 'Cách Handigo bảo vệ dữ liệu của bạn',
                    icon: Icons.policy_outlined,
                    onTap: () => context.push('/customer/settings'),
                  ),
                  _MenuItem(
                    label: 'Đánh giá Handigo',
                    subtitle: 'Chia sẻ trải nghiệm của bạn',
                    icon: Icons.star_rounded,
                    iconColor: AppTheme.starGold,
                    onTap: () => context.push('/customer/feedback'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => ref.read(authControllerProvider).logout(),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
                  foregroundColor: scheme.error,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  textStyle: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                child: const Text('Đăng xuất'),
              ),
              const SizedBox(height: 14),
              Text(
                'Handigo - Phiên bản 2.4.0',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                'Tận tâm trong từng tay',
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.labelSmall?.copyWith(color: scheme.outline),
              ),
            ],
          ),
        ),
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
  DateTime? _birthday;
  String? _gender;
  bool _initialized = false;
  bool _saving = false;
  bool _isEditingPhone = false;
  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _saveProfile(Map<String, dynamic> profile) async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Vui lòng nhập họ và tên.')));
      return;
    }

    setState(() => _saving = true);
    try {
      await ref.read(accountRepositoryProvider).updateProfile({
        'fullName': name,
        'phone': _phone.text.trim(),
        'birthday': _birthday?.toIso8601String(),
        'gender': _gender,
      });
      ref.invalidate(accountProfileProvider);
      if (mounted) {
        setState(() => _isEditingPhone = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Đã cập nhật hồ sơ.')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể cập nhật hồ sơ.')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickBirthday() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: _birthday ?? DateTime(now.year - 18, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'Chọn ngày sinh',
      cancelText: 'Hủy',
      confirmText: 'Chọn',
    );
    if (selected != null && mounted) setState(() => _birthday = selected);
  }

  Future<void> _pickGender() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text(
                'Chọn giới tính',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
            for (final option in const [
              ('male', 'Nam'),
              ('female', 'Nữ'),
              ('other', 'Khác'),
            ])
              ListTile(
                title: Text(option.$2),
                trailing: _gender == option.$1
                    ? Icon(
                        Icons.check_circle,
                        color: Theme.of(context).colorScheme.primary,
                      )
                    : null,
                onTap: () => Navigator.of(context).pop(option.$1),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (selected != null && mounted) setState(() => _gender = selected);
  }

  @override
  Widget build(BuildContext context) {
    final profileState = ref.watch(accountProfileProvider);
    final profile = profileState.asData?.value;
    final addresses = ref.watch(accountAddressesProvider).asData?.value;
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        centerTitle: true,
        toolbarHeight: 56,
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => context.canPop() ? context.pop() : null,
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: Text(
          'Thông tin cá nhân',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: scheme.onSurface,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: profileState.when(
        loading: () => const AppLoading(),
        error: (error, stackTrace) => AppMessage(
          message: 'Không thể tải hồ sơ.',
          onRetry: () => ref.invalidate(accountProfileProvider),
        ),
        data: (profile) {
          if (!_initialized) {
            _initialized = true;
            _name.text = '${profile['fullName'] ?? ''}';
            _phone.text = '${profile['phone'] ?? ''}';
            _birthday = DateTime.tryParse('${profile['birthday'] ?? ''}');
            _gender = profile['gender'] as String?;
          }
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 112),
                children: [
                  _ProfileHero(
                    name: _name.text.isEmpty ? 'Khách hàng' : _name.text,
                    memberId: _memberId(
                      '${profile['id'] ?? profile['_id'] ?? ''}',
                    ),
                    avatarUrl: profile['avatar'] as String?,
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Thông tin cơ bản',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Quản lý và xác minh thông tin liên hệ của bạn.',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _ProfileFormGroup(
                    children: [
                      _ProfileField(
                        label: 'Họ và tên',
                        icon: Icons.person_outline,
                        controller: _name,
                        textInputAction: TextInputAction.next,
                      ),
                      _ProfileField(
                        label: 'Số điện thoại',
                        icon: Icons.phone_outlined,
                        controller: _phone,
                        keyboardType: TextInputType.phone,
                        readOnly: !_isEditingPhone,
                        actionLabel: _isEditingPhone ? 'Đang sửa' : 'Đổi số',
                        onAction: () => setState(() => _isEditingPhone = true),
                        badge: profile['isPhoneVerified'] == true
                            ? 'Đã xác thực SMS'
                            : null,
                      ),
                      _ProfileReadOnlyField(
                        label: 'Địa chỉ email',
                        icon: Icons.email_outlined,
                        value: '${profile['email'] ?? 'Chưa cập nhật'}',
                        badge: profile['isEmailVerified'] == true
                            ? 'Đã xác minh'
                            : null,
                      ),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: _ProfileReadOnlyField(
                              label: 'Ngày sinh',
                              icon: Icons.calendar_today_outlined,
                              value: _formatBirthday(_birthday),
                              onTap: _pickBirthday,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _ProfileReadOnlyField(
                              label: 'Giới tính',
                              icon: Icons.wc_rounded,
                              value: _genderLabel(_gender),
                              trailing: Icons.keyboard_arrow_down_rounded,
                              onTap: _pickGender,
                            ),
                          ),
                        ],
                      ),
                      _ProfileReadOnlyField(
                        label: 'Khu vực thường trú',
                        icon: Icons.location_on_outlined,
                        value: _residenceLabel(addresses),
                        onTap: () => context.push('/customer/addresses'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _MembershipHeader(count: _membershipCount(profile)),
                  const SizedBox(height: 10),
                  const _MembershipCard(
                    icon: Icons.person_outline_rounded,
                    title: 'Khách hàng',
                    subtitle: 'Đặt thợ sửa chữa, tiện ích tại nhà',
                    status: 'Đang dùng',
                  ),
                  if (_hasProviderMembership(profile)) ...[
                    const SizedBox(height: 10),
                    _MembershipCard(
                      icon: Icons.handyman_outlined,
                      title: 'Đối tác Handigo',
                      subtitle: 'Cung cấp dịch vụ chuyên nghiệp',
                      status: _providerStatusLabel(
                        '${profile['providerOnboardingStatus'] ?? ''}',
                      ),
                      highlighted:
                          profile['providerOnboardingStatus'] == 'APPROVED',
                    ),
                    const SizedBox(height: 10),
                    _ProviderDocumentsCard(
                      onTap: () => context.push('/provider/profile'),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.verified_user_outlined,
                          size: 17,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Thông tin đã xác minh giúp bạn bảo vệ tài khoản và sử dụng dịch vụ hiệu quả hơn.',
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(color: scheme.onSurfaceVariant),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
      bottomNavigationBar: profile == null
          ? null
          : SafeArea(
              minimum: const EdgeInsets.fromLTRB(16, 8, 16, 10),
              child: Center(
                heightFactor: 1,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 388),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      FilledButton(
                        onPressed: _saving ? null : () => _saveProfile(profile),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          backgroundColor: Theme.of(context).colorScheme.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          textStyle: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        child: Text(_saving ? 'Đang lưu...' : 'Lưu thay đổi'),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        'Cập nhật hồ sơ để Handigo phục vụ bạn tốt hơn.',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
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
                  color: Theme.of(context).colorScheme.surfaceContainerLow,
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
                              ).colorScheme.primary,
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
                          final tone = incoming
                              ? scheme.secondary
                              : scheme.error;
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
                          AppTheme.primaryDark,
                          AppTheme.secondary,
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
                color: theme.colorScheme.surfaceContainerLow,
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
  const _MenuItem({
    required this.label,
    required this.subtitle,
    required this.icon,
    this.onTap,
    this.badge,
    this.iconColor,
  });

  final String label, subtitle;
  final IconData icon;
  final VoidCallback? onTap;
  final String? badge;
  final Color? iconColor;
}

class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({
    required this.name,
    required this.contact,
    required this.badge,
    required this.avatarUrl,
    required this.isGoogleAccount,
    required this.onEdit,
  });
  final String name, contact, badge;
  final String? avatarUrl;
  final bool isGoogleAccount;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .3)),
        boxShadow: [
          BoxShadow(
            color: scheme.onSurface.withValues(alpha: .08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            _AccountAvatar(
              name: name,
              email: contact,
              avatarUrl: avatarUrl,
              isGoogleAccount: isGoogleAccount,
            ),
            const SizedBox(width: 12),
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
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    contact,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '✦ $badge',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppTheme.tertiaryContainer,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Chỉnh sửa hồ sơ',
              onPressed: onEdit,
              icon: const Icon(Icons.edit_outlined, size: 19),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProviderModeCard extends StatelessWidget {
  const _ProviderModeCard({required this.isApproved, required this.onPressed});

  final bool isApproved;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppTheme.primary, AppTheme.primaryDark],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(12),
      boxShadow: const [
        BoxShadow(
          color: Color(0x303525CD),
          blurRadius: 20,
          offset: Offset(0, 8),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          isApproved ? 'ĐỐI TÁC ĐÃ XÁC MINH' : 'MỞ RỘNG CƠ HỘI',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Colors.white.withValues(alpha: .9),
            fontWeight: FontWeight.w700,
            letterSpacing: .45,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          isApproved ? 'Sẵn sàng nhận việc mới?' : 'Trở thành Đối tác',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          isApproved
              ? 'Chuyển sang chế độ Thợ để quản lý lịch làm việc chuyên nghiệp.'
              : 'Đăng ký cung cấp dịch vụ trên Handigo.',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Colors.white.withValues(alpha: .86),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(42),
            backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
            foregroundColor: Theme.of(context).colorScheme.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          child: Text(
            isApproved ? 'Chuyển sang chế độ Thợ →' : 'Đăng ký ngay →',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    ),
  );
}

class _WalletOverviewCard extends StatelessWidget {
  const _WalletOverviewCard({
    required this.balance,
    required this.onDeposit,
    required this.onHistory,
  });

  final double? balance;
  final VoidCallback onDeposit, onHistory;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: scheme.outlineVariant.withValues(alpha: .45)),
        boxShadow: [
          BoxShadow(
            color: scheme.onSurface.withValues(alpha: .05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Icon(
                Icons.account_balance_wallet_outlined,
                color: Theme.of(context).colorScheme.primary,
                size: 19,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Ví Handigo',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                'Được bảo vệ',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Số dư khả dụng',
              style: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
            ),
          ),
          const SizedBox(height: 3),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              balance == null ? 'Đang tải...' : _money(balance!),
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onDeposit,
                  icon: const Icon(Icons.add, size: 17),
                  label: const Text('Nạp tiền'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(42),
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: onHistory,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(42),
                    backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
                    foregroundColor: Theme.of(context).colorScheme.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text('Lịch sử giao dịch'),
                ),
              ),
            ],
          ),
        ],
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
      width: 52,
      height: 52,
      decoration: BoxDecoration(color: fallbackColor, shape: BoxShape.circle),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: usableMediaUrl(avatarUrl) != null
          ? Image.network(
              usableMediaUrl(avatarUrl)!,
              width: 52,
              height: 52,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => _initial(context),
            )
          : _initial(context),
    );
  }

  Widget _initial(BuildContext context) => Text(
    name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
    style: Theme.of(context).textTheme.titleMedium?.copyWith(
      color: Colors.white,
      fontWeight: FontWeight.w800,
    ),
  );
}

Color _avatarColor(ColorScheme scheme, String email, bool isGoogleAccount) {
  final isGmail = email.toLowerCase().endsWith('@gmail.com');
  if (!isGmail && !isGoogleAccount) return AppTheme.primary;
  const colors = [
    AppTheme.primary,
    AppTheme.secondary,
    AppTheme.tertiaryContainer,
    AppTheme.secondary,
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
      Padding(
        padding: const EdgeInsets.only(left: 2),
        child: Text(
          title,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      const SizedBox(height: 6),
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
  const _ProfileHero({
    required this.name,
    required this.memberId,
    required this.avatarUrl,
  });
  final String name, memberId;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final imageUrl = usableMediaUrl(avatarUrl);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 34,
            backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
            foregroundImage: imageUrl == null ? null : NetworkImage(imageUrl),
            child: imageUrl == null
                ? Text(
                    name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  )
                : null,
          ),
          const SizedBox(height: 10),
          Text(
            name,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 2),
          Text(
            'Mã thành viên: $memberId',
            style: Theme.of(
              context,
            ).textTheme.labelSmall?.copyWith(color: scheme.onSurfaceVariant),
          ),
          const SizedBox(height: 10),
          FilledButton(
            onPressed: () {},
            style: FilledButton.styleFrom(
              minimumSize: const Size(132, 38),
              backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
              foregroundColor: Theme.of(context).colorScheme.primary,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: const Text('Thay đổi đại diện'),
          ),
        ],
      ),
    );
  }
}

class _ProfileFormGroup extends StatelessWidget {
  const _ProfileFormGroup({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerLowest,
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      children: [
        for (var index = 0; index < children.length; index++) ...[
          if (index > 0) const SizedBox(height: 8),
          children[index],
        ],
      ],
    ),
  );
}

class _ProfileField extends StatelessWidget {
  const _ProfileField({
    required this.label,
    required this.icon,
    required this.controller,
    this.keyboardType,
    this.textInputAction,
    this.badge,
    this.readOnly = false,
    this.actionLabel,
    this.onAction,
  });
  final String label;
  final IconData icon;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final String? badge;
  final bool readOnly;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(10, 7, 10, 6),
          decoration: _profileFieldDecoration(scheme),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                  fontSize: 10,
                ),
              ),
              TextField(
                controller: controller,
                keyboardType: keyboardType,
                textInputAction: textInputAction,
                readOnly: readOnly,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.only(top: 5, bottom: 1),
                  prefixIcon: Icon(icon, color: Theme.of(context).colorScheme.primary, size: 17),
                  prefixIconConstraints: const BoxConstraints(
                    minWidth: 27,
                    minHeight: 20,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (badge != null || actionLabel != null)
          Padding(
            padding: const EdgeInsets.only(top: 3, left: 2),
            child: Row(
              children: [
                if (badge != null) _VerifiedBadge(label: badge!),
                const Spacer(),
                if (actionLabel != null)
                  InkWell(
                    onTap: onAction,
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 5,
                      ),
                      child: Text(
                        actionLabel!,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _ProfileReadOnlyField extends StatelessWidget {
  const _ProfileReadOnlyField({
    required this.label,
    required this.icon,
    required this.value,
    this.badge,
    this.trailing,
    this.onTap,
  });
  final String label, value;
  final IconData icon;
  final String? badge;
  final IconData? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Semantics(
          button: onTap != null,
          label: '$label: $value',
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(8),
            child: Container(
              constraints: const BoxConstraints(minHeight: 58),
              padding: const EdgeInsets.fromLTRB(10, 7, 10, 8),
              decoration: _profileFieldDecoration(scheme),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                      fontSize: 10,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      Icon(icon, color: Theme.of(context).colorScheme.primary, size: 17),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          value,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                        ),
                      ),
                      if (trailing != null)
                        Icon(trailing, color: scheme.onSurfaceVariant),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        if (badge != null)
          Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.only(top: 3, left: 2),
              child: _VerifiedBadge(label: badge!),
            ),
          ),
      ],
    );
  }
}

class _VerifiedBadge extends StatelessWidget {
  const _VerifiedBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.check, size: 12, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 3),
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.primary, fontSize: 10),
        ),
      ],
    );
  }
}

class _MembershipHeader extends StatelessWidget {
  const _MembershipHeader({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          'Vai trò & Tư cách thành viên',
          style: Theme.of(
            context,
          ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
        ),
      ),
      Text(
        '$count tư cách',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

class _MembershipCard extends StatelessWidget {
  const _MembershipCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.status,
    this.highlighted = false,
  });

  final IconData icon;
  final String title, subtitle, status;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final accent = highlighted ? scheme.primary : Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: scheme.onSurface.withValues(alpha: .04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: accent, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              status,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: accent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProviderDocumentsCard extends StatelessWidget {
  const _ProviderDocumentsCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.description_outlined,
                  color: Theme.of(context).colorScheme.primary,
                  size: 19,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Chứng chỉ nghề & Hồ sơ Thợ',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Bằng cấp, giấy phép hành nghề →',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: scheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

BoxDecoration _profileFieldDecoration(ColorScheme scheme) => BoxDecoration(
  color: scheme.surfaceContainerLowest,
  borderRadius: BorderRadius.circular(8),
  border: Border.all(color: scheme.outlineVariant.withValues(alpha: .65)),
);

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
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: scheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: scheme.onSurface.withValues(alpha: .035),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0)
              Divider(
                height: 1,
                indent: 60,
                color: scheme.outlineVariant.withValues(alpha: .38),
              ),
            _AccountMenuTile(item: items[index]),
          ],
        ],
      ),
    );
  }
}

class _AccountMenuTile extends StatelessWidget {
  const _AccountMenuTile({required this.item});

  final _MenuItem item;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      onTap: item.onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 68),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(
                  item.icon,
                  size: 18,
                  color: item.iconColor ?? Theme.of(context).colorScheme.primary,
                ),
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
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              if (item.badge != null)
                Container(
                  margin: const EdgeInsets.only(left: 6),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.badge!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              const SizedBox(width: 5),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: scheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _maskedPhone(String value) {
  final phone = value.trim();
  if (phone.isEmpty) return 'Chưa cập nhật số điện thoại';
  if (phone.length < 7) return phone;
  return '${phone.substring(0, 4)} *** ${phone.substring(phone.length - 3)}';
}

String _memberId(String value) {
  final normalized = value.trim().toUpperCase();
  if (normalized.isEmpty) return '#HDG------';
  final suffix = normalized.length <= 6
      ? normalized.padLeft(6, '0')
      : normalized.substring(normalized.length - 6);
  return '#HDG-$suffix';
}

String _formatBirthday(DateTime? value) => value == null
    ? 'Chưa cập nhật'
    : DateFormat('dd/MM/yyyy', 'vi_VN').format(value);

String _genderLabel(String? value) => switch (value) {
  'male' => 'Nam',
  'female' => 'Nữ',
  'other' => 'Khác',
  _ => 'Chưa cập nhật',
};

String _residenceLabel(List<AddressItem>? addresses) {
  if (addresses == null || addresses.isEmpty) return 'Chưa cập nhật';
  AddressItem selected = addresses.first;
  for (final address in addresses) {
    if (address.isDefault) {
      selected = address;
      break;
    }
  }
  return selected.province.isEmpty ? selected.fullAddress : selected.province;
}

bool _hasProviderMembership(Map<String, dynamic> profile) =>
    '${profile['role'] ?? ''}'.toUpperCase() == 'PROVIDER' ||
    '${profile['providerOnboardingStatus'] ?? ''}'.isNotEmpty;

int _membershipCount(Map<String, dynamic> profile) =>
    _hasProviderMembership(profile) ? 2 : 1;

String _providerStatusLabel(String value) => switch (value.toUpperCase()) {
  'APPROVED' => 'Đã duyệt',
  'PENDING_REVIEW' => 'Đang duyệt',
  'REJECTED' => 'Cần cập nhật',
  _ => 'Đang đăng ký',
};

String _money(num value) => '${NumberFormat('#,##0', 'vi_VN').format(value)}đ';
String _transactionLabel(String type) => switch (type) {
  'deposit' => 'Nạp tiền',
  'payment' => 'Thanh toán đơn hàng',
  'refund' => 'Hoàn tiền',
  _ => 'Giao dịch ví',
};
