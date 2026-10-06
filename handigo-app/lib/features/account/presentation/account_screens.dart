import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/paged_result.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/app_states.dart';
import '../../home/presentation/device_location_provider.dart';
import '../data/account_repository.dart';
import '../domain/account_models.dart';

const _figmaPrimary = Color(0xFF4F35D5);
const _figmaPrimarySoft = Color(0xFFEFEBFF);
const _accountBackground = Color(0xFFF6F5FA);
const _accountSurface = Color(0xFFFFFFFF);
const _accountInk = Color(0xFF201B36);
const _accountMuted = Color(0xFF777286);
const _accountDivider = Color(0xFFEDEAF3);
const _accountGold = Color(0xFF926319);
const _accountDanger = Color(0xFFC64050);
const _accountIconPath = 'assets/icons/account';

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
    final user = auth.user;
    final profile = ref.watch(accountProfileProvider).asData?.value;
    final addresses = ref.watch(accountAddressesProvider).asData?.value;
    final wallet = ref.watch(accountWalletProvider).asData?.value;
    final vouchers = ref.watch(accountVouchersProvider).asData?.value;
    final isApprovedProvider =
        user?.role.name == 'provider' ||
        user?.providerOnboardingStatus == 'APPROVED';

    return Scaffold(
      backgroundColor: _accountBackground,
      appBar: AppBar(
        centerTitle: true,
        toolbarHeight: 62,
        backgroundColor: _accountSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => context.canPop() ? context.pop() : null,
          icon: SvgPicture.asset(
            '$_accountIconPath/back.svg',
            width: 22,
            height: 22,
          ),
        ),
        title: Text(
          'Tài khoản & Cài đặt',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: _accountInk,
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Trợ giúp',
            onPressed: () => context.push('/customer/support'),
            icon: SvgPicture.asset(
              '$_accountIconPath/app_help.svg',
              width: 22,
              height: 22,
            ),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        bottom: false,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
              children: [
                _ProfileSummaryCard(
                  name: user?.fullName ?? 'Khách hàng',
                  contact: _maskedPhone('${profile?['phone'] ?? ''}'),
                  badge: 'Thành viên Gold',
                  avatarUrl: user?.avatar,
                  onEdit: () => context.push('/customer/profile'),
                ),
                const SizedBox(height: 24),
                _ProviderModeCard(
                  isApproved: isApprovedProvider,
                  onPressed: () => isApprovedProvider
                      ? context.go('/provider')
                      : context.push('/customer/provider-onboarding'),
                ),
                const SizedBox(height: 24),
                _WalletOverviewCard(
                  balance: wallet?.balance,
                  onDeposit: () => context.push('/customer/wallet'),
                  onHistory: () => context.push('/customer/wallet'),
                ),
                const SizedBox(height: 24),
                _AccountSection(
                  title: 'Quản lý cá nhân',
                  items: [
                    _MenuItem(
                      label: 'Thông tin cá nhân',
                      subtitle: 'Hồ sơ, xác minh & thông tin liên hệ',
                      iconAsset: '$_accountIconPath/user.svg',
                      onTap: () => context.push('/customer/profile'),
                    ),
                    _MenuItem(
                      label: 'Sổ địa chỉ',
                      subtitle: addresses == null
                          ? 'Quản lý các địa chỉ đã lưu'
                          : '${addresses.length} địa chỉ đã lưu',
                      iconAsset: '$_accountIconPath/pin.svg',
                      onTap: () => context.push('/customer/addresses'),
                    ),
                    _MenuItem(
                      label: 'Phương thức thanh toán',
                      subtitle: 'Quản lý thẻ & tài khoản liên kết',
                      iconAsset: '$_accountIconPath/card.svg',
                      onTap: () => context.push('/customer/wallet'),
                    ),
                    _MenuItem(
                      label: 'Voucher & ưu đãi',
                      subtitle: vouchers == null
                          ? 'Xem các ưu đãi đang có'
                          : '${vouchers.length} ưu đãi sẵn sàng sử dụng',
                      iconAsset: '$_accountIconPath/gift.svg',
                      onTap: () => context.push('/customer/vouchers'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _AccountSection(
                  title: 'Cài đặt ứng dụng',
                  items: [
                    _MenuItem(
                      label: 'Thông báo & nhắc lịch',
                      subtitle: 'Lịch hẹn, tin nhắn & cập nhật dịch vụ',
                      iconAsset: '$_accountIconPath/bell.svg',
                      onTap: () => context.push('/customer/notifications'),
                    ),
                    const _MenuItem(
                      label: 'Ngôn ngữ',
                      subtitle: 'Tiếng Việt',
                      iconAsset: '$_accountIconPath/globe.svg',
                    ),
                    _MenuItem(
                      label: 'Bảo mật & đăng nhập',
                      subtitle: 'Mật khẩu, Face ID & vân tay',
                      iconAsset: '$_accountIconPath/shield.svg',
                      onTap: () => context.push('/customer/settings'),
                    ),
                    _MenuItem(
                      label: 'Giao diện',
                      subtitle: 'Sáng · Theo cài đặt thiết bị',
                      iconAsset: '$_accountIconPath/moon.svg',
                      onTap: () => context.push('/customer/settings'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _AccountSection(
                  title: 'Hỗ trợ & thông tin',
                  items: [
                    _MenuItem(
                      label: 'Trung tâm trợ giúp',
                      subtitle: 'Chat với Handigo · Hỗ trợ 24/7',
                      iconAsset: '$_accountIconPath/help.svg',
                      onTap: () => context.push('/customer/support'),
                    ),
                    _MenuItem(
                      label: 'Góp ý & báo cáo sự cố',
                      subtitle: 'Chúng tôi luôn lắng nghe bạn',
                      iconAsset: '$_accountIconPath/chat.svg',
                      onTap: () => context.push('/customer/complaints'),
                    ),
                    _MenuItem(
                      label: 'Điều khoản & quyền riêng tư',
                      subtitle: 'Cách Handigo bảo vệ dữ liệu của bạn',
                      iconAsset: '$_accountIconPath/file.svg',
                      onTap: () => context.push('/customer/settings'),
                    ),
                    _MenuItem(
                      label: 'Đánh giá Handigo',
                      subtitle: 'Chia sẻ trải nghiệm của bạn',
                      iconAsset: '$_accountIconPath/star.svg',
                      onTap: () => context.push('/customer/feedback'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: () => ref.read(authControllerProvider).logout(),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: _accountSurface,
                    foregroundColor: _accountDanger,
                    elevation: 0,
                    side: const BorderSide(color: _accountDivider),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    textStyle: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  child: const Text('Đăng xuất'),
                ),
                const SizedBox(height: 24),
                Column(
                  children: [
                    Text(
                      'Handigo · Phiên bản 2.4.0',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: _accountMuted,
                        fontSize: 12,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Tiện ích trong tầm tay',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: _accountMuted,
                        fontSize: 12,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ],
            ),
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
      backgroundColor: _accountBackground,
      appBar: AppBar(
        centerTitle: true,
        toolbarHeight: 56,
        backgroundColor: Colors.white,
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
                        const Icon(
                          Icons.verified_user_outlined,
                          size: 17,
                          color: _figmaPrimary,
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
                          backgroundColor: _figmaPrimary,
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
      backgroundColor: _accountBackground,
      appBar: AppBar(
        backgroundColor: _accountSurface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        toolbarHeight: 62,
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () => context.canPop() ? context.pop() : null,
          icon: SvgPicture.asset(
            '$_accountIconPath/back.svg',
            width: 22,
            height: 22,
            colorFilter: const ColorFilter.mode(_accountInk, BlendMode.srcIn),
          ),
        ),
        title: const Text(
          'Sổ địa chỉ của tôi',
          style: TextStyle(
            color: _accountInk,
            fontSize: 20,
            fontWeight: FontWeight.w700,
            letterSpacing: -.2,
          ),
        ),
      ),
      body: SafeArea(
        top: false,
        child: ref
            .watch(accountAddressesProvider)
            .when(
              loading: () => const AppLoading(),
              error: (_, _) => AppMessage(
                message: 'Không thể tải địa chỉ.',
                onRetry: () => ref.invalidate(accountAddressesProvider),
              ),
              data: (items) {
                return RefreshIndicator(
                  color: _figmaPrimary,
                  onRefresh: () => ref.refresh(accountAddressesProvider.future),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                        children: [
                          _AddAddressCard(
                            onTap: () => _addressForm(context, ref),
                          ),
                          const SizedBox(height: 24),
                          const _AddressSectionLabel('Vị trí hiện tại'),
                          const SizedBox(height: 12),
                          _CurrentLocationSection(
                            onDetermine: () => _determineLocation(context, ref),
                          ),
                          const SizedBox(height: 28),
                          Row(
                            children: [
                              const Expanded(
                                child: Text(
                                  'Địa chỉ đã lưu',
                                  style: TextStyle(
                                    color: _accountInk,
                                    fontSize: 17,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Text(
                                '${items.length} địa chỉ',
                                style: const TextStyle(
                                  color: _accountMuted,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (items.isEmpty)
                            _EmptyAddress(
                              onAdd: () => _addressForm(context, ref),
                            )
                          else
                            ...items.expand(
                              (item) => [
                                _AddressCard(
                                  item: item,
                                  onSetDefault: item.isDefault
                                      ? null
                                      : () async {
                                          await ref
                                              .read(accountRepositoryProvider)
                                              .updateAddress(item.id, {
                                                'isDefault': true,
                                              });
                                          ref.invalidate(
                                            accountAddressesProvider,
                                          );
                                        },
                                  onEdit: () =>
                                      _addressForm(context, ref, item: item),
                                  onDelete: () async {
                                    await ref
                                        .read(accountRepositoryProvider)
                                        .deleteAddress(item.id);
                                    ref.invalidate(accountAddressesProvider);
                                  },
                                ),
                                const SizedBox(height: 12),
                              ],
                            ),
                          const SizedBox(height: 16),
                          const _AddressPrivacyFooter(),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
      ),
    );
  }
}

Future<void> _determineLocation(BuildContext context, WidgetRef ref) async {
  ref.invalidate(deviceLocationProvider);
  final location = await ref.read(deviceLocationProvider.future);
  if (!context.mounted) return;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(location.label)));
}

Future<void> _addressForm(
  BuildContext context,
  WidgetRef ref, {
  AddressItem? item,
}) async {
  final name = TextEditingController(text: item?.recipientName ?? ''),
      phone = TextEditingController(text: item?.recipientPhone ?? ''),
      address = TextEditingController(text: item?.fullAddress ?? ''),
      province = TextEditingController(text: item?.province ?? ''),
      ward = TextEditingController(text: item?.ward ?? ''),
      note = TextEditingController(text: item?.note ?? '');
  final form = await showDialog<Map<String, String>>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text(item == null ? 'Thêm địa chỉ' : 'Chỉnh sửa địa chỉ'),
      content: SingleChildScrollView(
        child: Column(
          children: [
            _field(name, 'Người nhận'),
            _field(phone, 'Số điện thoại'),
            _field(address, 'Địa chỉ đầy đủ'),
            _field(province, 'Tỉnh/thành phố'),
            _field(ward, 'Phường/xã'),
            _field(note, 'Ghi chú cho thợ (không bắt buộc)'),
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
            'note': note.text,
          }),
          child: const Text('Lưu'),
        ),
      ],
    ),
  );
  final requiredValues = form == null
      ? const <String>[]
      : [
          form['recipientName'] ?? '',
          form['recipientPhone'] ?? '',
          form['fullAddress'] ?? '',
          form['province'] ?? '',
          form['ward'] ?? '',
        ];
  if (form != null &&
      requiredValues.every((value) => value.trim().isNotEmpty)) {
    if (item == null) {
      await ref.read(accountRepositoryProvider).createAddress(form);
    } else {
      await ref.read(accountRepositoryProvider).updateAddress(item.id, form);
    }
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
  const _MenuItem({
    required this.label,
    required this.subtitle,
    required this.iconAsset,
    this.onTap,
  });

  final String label, subtitle;
  final String iconAsset;
  final VoidCallback? onTap;
}

class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({
    required this.name,
    required this.contact,
    required this.badge,
    required this.avatarUrl,
    required this.onEdit,
  });
  final String name, contact, badge;
  final String? avatarUrl;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(20);
    return Material(
      color: _accountSurface,
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
                        color: _accountInk,
                        fontSize: 22,
                        height: 1.45,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      contact,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: _accountMuted,
                        fontSize: 12,
                        height: 1.45,
                      ),
                    ),
                    Text(
                      '✦  $badge',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: _accountGold,
                        fontSize: 12,
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

class _ProviderModeCard extends StatelessWidget {
  const _ProviderModeCard({required this.isApproved, required this.onPressed});

  final bool isApproved;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: _figmaPrimary,
      borderRadius: BorderRadius.circular(20),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          isApproved ? 'ĐỐI TÁC ĐÃ XÁC MINH' : 'MỞ RỘNG CƠ HỘI',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: _accountSurface,
            fontSize: 12,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          isApproved ? 'Sẵn sàng nhận việc mới?' : 'Trở thành Đối tác',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: _accountSurface,
            fontSize: 22,
            height: 1.45,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          isApproved
              ? 'Chuyển sang chế độ Thợ để quản lý\nlịch làm việc và thu nhập.'
              : 'Đăng ký cung cấp dịch vụ trên Handigo.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: _accountSurface,
            fontSize: 14,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: onPressed,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            backgroundColor: _accountSurface,
            foregroundColor: _figmaPrimary,
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: Text(
            isApproved ? 'Chuyển sang chế độ Thợ  →' : 'Đăng ký ngay  →',
            style: const TextStyle(
              fontSize: 14,
              height: 1.45,
              fontWeight: FontWeight.w600,
            ),
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
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _accountSurface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Ví Handigo',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: _accountInk,
                    fontSize: 14,
                    height: 1.45,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                'Được bảo vệ',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: _figmaPrimary,
                  fontSize: 12,
                  height: 1.45,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Số dư khả dụng',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: _accountMuted,
              fontSize: 12,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            balance == null ? 'Đang tải...' : _accountMoney(balance!),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: _accountInk,
              fontSize: 30,
              height: 1.45,
              fontWeight: FontWeight.w800,
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
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: _figmaPrimary,
                    foregroundColor: _accountSurface,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: onHistory,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: _figmaPrimarySoft,
                    foregroundColor: _figmaPrimary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
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
        color: _figmaPrimarySoft,
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
      color: _figmaPrimary,
      fontSize: 22,
      height: 1.45,
      fontWeight: FontWeight.w800,
    ),
  );
}

String _initials(String value) {
  final parts = value.trim().split(RegExp(r'\s+'));
  if (parts.isEmpty || parts.first.isEmpty) return '?';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return '${parts[parts.length - 2][0]}${parts.last[0]}'.toUpperCase();
}

class _AccountSection extends StatelessWidget {
  const _AccountSection({required this.title, required this.items});
  final String title;
  final List<_MenuItem> items;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: _accountMuted,
          fontSize: 14,
          height: 1.45,
          fontWeight: FontWeight.w600,
        ),
      ),
      const SizedBox(height: 10),
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 34,
            backgroundColor: _figmaPrimarySoft,
            foregroundImage: imageUrl == null ? null : NetworkImage(imageUrl),
            child: imageUrl == null
                ? Text(
                    name.isEmpty ? '?' : name.substring(0, 1).toUpperCase(),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: _figmaPrimary,
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
              backgroundColor: _figmaPrimarySoft,
              foregroundColor: _figmaPrimary,
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
      color: Colors.white,
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
                  prefixIcon: Icon(icon, color: _figmaPrimary, size: 17),
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
                          color: _figmaPrimary,
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
                      Icon(icon, color: _figmaPrimary, size: 17),
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
        const Icon(Icons.check, size: 12, color: _figmaPrimary),
        const SizedBox(width: 3),
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: _figmaPrimary, fontSize: 10),
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
    final accent = highlighted ? const Color(0xFF6750C9) : _figmaPrimary;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
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
              color: _figmaPrimarySoft,
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
              color: _figmaPrimarySoft,
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
      color: _figmaPrimarySoft,
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
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.description_outlined,
                  color: _figmaPrimary,
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
  color: Colors.white,
  borderRadius: BorderRadius.circular(8),
  border: Border.all(color: scheme.outlineVariant.withValues(alpha: .65)),
);

class _AddAddressCard extends StatelessWidget {
  const _AddAddressCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: _accountSurface,
    borderRadius: BorderRadius.circular(18),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: _figmaPrimarySoft,
                shape: BoxShape.circle,
              ),
              child: SvgPicture.asset(
                '$_accountIconPath/pin.svg',
                width: 21,
                height: 21,
                colorFilter: const ColorFilter.mode(
                  _figmaPrimary,
                  BlendMode.srcIn,
                ),
              ),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Thêm địa chỉ mới',
                    style: TextStyle(
                      color: _accountInk,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Thêm địa chỉ để đặt dịch vụ nhanh hơn',
                    style: TextStyle(
                      color: _accountMuted,
                      fontSize: 13,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(
              Icons.chevron_right_rounded,
              color: _accountMuted,
              size: 24,
            ),
          ],
        ),
      ),
    ),
  );
}

class _AddressSectionLabel extends StatelessWidget {
  const _AddressSectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) => Text(
    label,
    style: const TextStyle(
      color: _accountMuted,
      fontSize: 12,
      fontWeight: FontWeight.w600,
    ),
  );
}

class _CurrentLocationSection extends StatelessWidget {
  const _CurrentLocationSection({required this.onDetermine});

  final VoidCallback onDetermine;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.only(top: 2),
        child: SvgPicture.asset(
          '$_accountIconPath/pin.svg',
          width: 22,
          height: 22,
          colorFilter: const ColorFilter.mode(_figmaPrimary, BlendMode.srcIn),
        ),
      ),
      const SizedBox(width: 12),
      const Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Dùng vị trí hiện tại của bạn',
              style: TextStyle(
                color: _accountInk,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            SizedBox(height: 3),
            Text(
              'Giúp điền địa chỉ nhanh hơn',
              style: TextStyle(color: _accountMuted, fontSize: 13),
            ),
          ],
        ),
      ),
      const SizedBox(width: 8),
      TextButton(
        onPressed: onDetermine,
        style: TextButton.styleFrom(
          foregroundColor: _figmaPrimary,
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
          minimumSize: const Size(0, 32),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
        ),
        child: const Text('Xác định vị trí'),
      ),
    ],
  );
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.item,
    required this.onSetDefault,
    required this.onEdit,
    required this.onDelete,
  });

  final AddressItem item;
  final VoidCallback? onSetDefault;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: _accountSurface,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                item.isDefault
                    ? Icons.home_outlined
                    : Icons.location_on_outlined,
                color: _figmaPrimary,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  item.isDefault ? 'Nhà riêng' : 'Địa chỉ đã lưu',
                  style: const TextStyle(
                    color: _accountInk,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              if (item.isDefault)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: _figmaPrimarySoft,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: const Text(
                    'Mặc định',
                    style: TextStyle(
                      color: _figmaPrimary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: item.recipientName,
                  style: const TextStyle(
                    color: _accountInk,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const TextSpan(
                  text: '  •  ',
                  style: TextStyle(color: _accountMuted),
                ),
                TextSpan(
                  text: item.recipientPhone,
                  style: const TextStyle(color: _accountMuted),
                ),
              ],
            ),
            style: const TextStyle(fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 8),
          Text(
            _fullAddress(item),
            style: const TextStyle(
              color: _accountMuted,
              fontSize: 13,
              height: 1.45,
            ),
          ),
          if (item.note?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.only(left: 12),
              decoration: const BoxDecoration(
                border: Border(
                  left: BorderSide(color: _accountDivider, width: 2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Ghi chú cho thợ:',
                    style: TextStyle(
                      color: _accountMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '“${item.note!.trim()}”',
                    style: const TextStyle(
                      color: _accountInk,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Divider(height: 1, color: _accountDivider),
          ),
          Row(
            children: [
              if (item.isDefault)
                const Expanded(
                  child: Row(
                    children: [
                      Icon(Icons.check_rounded, color: _accountMuted, size: 17),
                      SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          'Địa chỉ mặc định',
                          style: TextStyle(
                            color: _accountMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                Expanded(
                  child: InkWell(
                    onTap: onSetDefault,
                    child: const Padding(
                      padding: EdgeInsets.symmetric(vertical: 5),
                      child: Text(
                        'Đặt làm mặc định',
                        style: TextStyle(
                          color: _figmaPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              TextButton.icon(
                onPressed: onEdit,
                style: _addressActionStyle(_accountInk),
                icon: const Icon(Icons.edit_outlined, size: 17),
                label: const Text('Chỉnh sửa'),
              ),
              IconButton(
                tooltip: 'Xóa địa chỉ',
                onPressed: onDelete,
                visualDensity: VisualDensity.compact,
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  color: _accountDanger,
                  size: 20,
                ),
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

String _fullAddress(AddressItem item) {
  final parts = [
    item.fullAddress,
    item.ward,
    item.province,
  ].map((part) => part.trim()).where((part) => part.isNotEmpty).toList();
  return parts.join(', ');
}

ButtonStyle _addressActionStyle(Color color) => TextButton.styleFrom(
  foregroundColor: color,
  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
  minimumSize: const Size(0, 32),
  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
);

class _EmptyAddress extends StatelessWidget {
  const _EmptyAddress({required this.onAdd});
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: _accountSurface,
      borderRadius: BorderRadius.circular(18),
    ),
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.location_off_outlined, size: 56, color: _figmaPrimary),
            const SizedBox(height: 16),
            Text(
              'Bạn chưa có địa chỉ',
              style: const TextStyle(
                color: _accountInk,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Thêm địa chỉ để đặt dịch vụ nhanh hơn.',
              textAlign: TextAlign.center,
              style: TextStyle(color: _accountMuted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onAdd,
              style: FilledButton.styleFrom(backgroundColor: _figmaPrimary),
              icon: const Icon(Icons.add),
              label: const Text('Thêm địa chỉ'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _AddressPrivacyFooter extends StatelessWidget {
  const _AddressPrivacyFooter();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SvgPicture.asset(
          '$_accountIconPath/shield.svg',
          width: 21,
          height: 21,
          colorFilter: const ColorFilter.mode(_figmaPrimary, BlendMode.srcIn),
        ),
        const SizedBox(width: 10),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Bảo mật thông tin địa chỉ',
                style: TextStyle(
                  color: _accountInk,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: 4),
              Text(
                'Địa chỉ của bạn chỉ được chia sẻ với kỹ thuật viên sau khi đơn đặt dịch vụ được xác nhận.',
                style: TextStyle(
                  color: _accountMuted,
                  fontSize: 12,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
      ],
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
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: _accountSurface,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          for (var index = 0; index < items.length; index++) ...[
            if (index > 0)
              const Divider(height: 1, thickness: 1, color: _accountDivider),
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
    return InkWell(
      onTap: item.onTap,
      child: SizedBox(
        height: 76,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: _figmaPrimarySoft,
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
                        color: _accountInk,
                        fontSize: 14,
                        height: 1.45,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: _accountMuted,
                        fontSize: 12,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                size: 16,
                color: _accountMuted,
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
String _accountMoney(num value) =>
    '${NumberFormat('#,##0', 'vi_VN').format(value)} ₫';
String _transactionLabel(String type) => switch (type) {
  'deposit' => 'Nạp tiền',
  'payment' => 'Thanh toán đơn hàng',
  'refund' => 'Hoàn tiền',
  _ => 'Giao dịch ví',
};
