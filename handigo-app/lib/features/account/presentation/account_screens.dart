import '../../../shared/utils/address_format.dart';
import '../../booking/presentation/booking_provider.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/paged_result.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/account_overview_widgets.dart';
import '../../../shared/widgets/customer_page_header.dart';
import '../../home/presentation/device_location_provider.dart';
import '../../orders/domain/order_summary.dart';
import '../../orders/presentation/order_screens.dart';
import '../data/account_repository.dart';
import '../domain/account_models.dart';
import '../../home/domain/customer_home_data.dart';
import '../../home/presentation/customer_home_provider.dart';
import '../../home/presentation/reward_redemption.dart';
import 'wallet_deposit_dialog.dart';

const _figmaPrimary = Color(0xFF4F35D5);
const _figmaPrimarySoft = Color(0xFFEFEBFF);
const _accountBackground = Color(0xFFF6F5FA);
const _accountSurface = Color(0xFFFFFFFF);
const _accountInk = Color(0xFF201B36);
const _accountMuted = Color(0xFF777286);
const _accountDivider = Color(0xFFEDEAF3);
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
final accountBanksProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).bankAccounts(),
);
final accountTransactionPageProvider = FutureProvider.autoDispose
    .family<PagedResult<WalletTransactionItem>, int>(
      (ref, page) =>
          ref.watch(accountRepositoryProvider).walletTransactions(page: page),
    );
final accountPaymentHistoryProvider = FutureProvider.autoDispose
    .family<PagedResult<PaymentHistoryItem>, int>(
      (ref, page) =>
          ref.watch(accountRepositoryProvider).paymentHistory(page: page),
    );
final accountVouchersProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).vouchers(),
);
final accountPublicVouchersProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).publicVouchers(),
);
final accountOwnedVouchersProvider = FutureProvider.autoDispose
    .family<PagedResult<VoucherItem>, int>(
      (ref, page) =>
          ref.watch(accountRepositoryProvider).ownedVouchers(page: page),
    );
final accountVoucherUsageProvider = FutureProvider.autoDispose
    .family<PagedResult<VoucherUsageItem>, int>(
      (ref, page) =>
          ref.watch(accountRepositoryProvider).voucherUsageHistory(page: page),
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
final accountReportsProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(accountRepositoryProvider).reports(),
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
    final isApprovedProvider = user?.canAccessProvider == true;

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: CustomerPageHeader(
        toolbarHeight: 64 * MediaQuery.textScalerOf(context).scale(1),
        backgroundColor: _accountSurface,
        automaticallyImplyLeading: false,
        title: 'Tài khoản & Cài đặt',
        titleColor: _accountInk,
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
                AccountProfileSummaryCard(
                  name: user?.fullName ?? 'Khách hàng',
                  contact: _maskedPhone('${profile?['phone'] ?? ''}'),
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
                  onHistory: () => context.push('/customer/wallet/history'),
                ),
                const SizedBox(height: 24),
                AccountSection(
                  title: 'Quản lý cá nhân',
                  items: [
                    AccountMenuItem(
                      label: 'Sổ địa chỉ',
                      subtitle: addresses == null
                          ? 'Quản lý các địa chỉ đã lưu'
                          : '${addresses.length} địa chỉ đã lưu',
                      iconAsset: '$_accountIconPath/pin.svg',
                      onTap: () => context.push('/customer/addresses'),
                    ),
                    AccountMenuItem(
                      label: 'Phương thức thanh toán',
                      subtitle: 'Ví & tài khoản ngân hàng đã lưu',
                      iconAsset: '$_accountIconPath/card.svg',
                      onTap: () => context.push('/customer/wallet'),
                    ),
                    AccountMenuItem(
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
                AccountSection(
                  title: 'Cài đặt ứng dụng',
                  items: [
                    AccountMenuItem(
                      label: 'Thông báo & nhắc lịch',
                      subtitle: 'Lịch hẹn, tin nhắn & cập nhật dịch vụ',
                      iconAsset: '$_accountIconPath/bell.svg',
                      onTap: () => context.push('/customer/notifications'),
                    ),
                    const AccountMenuItem(
                      label: 'Ngôn ngữ & giao diện',
                      subtitle: 'Tiếng Việt · Sáng / Tối',
                      iconAsset: '$_accountIconPath/globe.svg',
                      comingSoon: true,
                    ),
                    AccountMenuItem(
                      label: 'Bảo mật & đăng nhập',
                      subtitle: 'Mật khẩu, Face ID & vân tay',
                      iconAsset: '$_accountIconPath/shield.svg',
                      onTap: () => context.push('/customer/settings'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                AccountSection(
                  title: 'Hỗ trợ & thông tin',
                  items: [
                    AccountMenuItem(
                      label: 'Trung tâm trợ giúp',
                      subtitle: 'Chat với Handigo · Hỗ trợ 24/7',
                      iconAsset: '$_accountIconPath/help.svg',
                      onTap: () => context.push('/customer/support'),
                    ),
                    AccountMenuItem(
                      label: 'Góp ý & báo cáo sự cố',
                      subtitle: 'Chúng tôi luôn lắng nghe bạn',
                      iconAsset: '$_accountIconPath/chat.svg',
                      onTap: () => context.push('/customer/complaints'),
                    ),
                    AccountMenuItem(
                      label: 'Điều khoản & quyền riêng tư',
                      subtitle: 'Cách Handigo bảo vệ dữ liệu của bạn',
                      iconAsset: '$_accountIconPath/file.svg',
                      onTap: () => context.push('/customer/settings'),
                    ),
                    AccountMenuItem(
                      label: 'Đánh giá Handigo',
                      subtitle: 'Chia sẻ trải nghiệm của bạn',
                      iconAsset: '$_accountIconPath/star.svg',
                      onTap: () => context.push('/customer/feedback'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                AccountLogoutButton(
                  onPressed: () async {
                    final confirmed = await showAccountLogoutConfirmation(
                      context,
                      userName: user?.fullName ?? 'Khách hàng Handigo',
                    );
                    if (confirmed) {
                      await ref.read(authControllerProvider).logout();
                    }
                  },
                ),
                const AccountVersionFooter(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key, this.addressRoute = '/customer/addresses'});

  final String addressRoute;

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
      useRootNavigator: true,
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(
              title: Text(
                'Chọn giới tính',
                style: TextStyle(fontWeight: FontWeight.w600),
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
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: scheme.onSurface,
            fontWeight: FontWeight.w600,
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
                      fontWeight: FontWeight.w600,
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
                        onTap: () => context.push(widget.addressRoute),
                      ),
                    ],
                  ),
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
                          backgroundColor: Theme.of(
                            context,
                          ).colorScheme.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          textStyle: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(fontWeight: FontWeight.w600),
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
            fontSize: 22,
            fontWeight: FontWeight.w600,
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
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
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
                            ...items.asMap().entries.expand(
                              (entry) => [
                                _AddressCard(
                                  item: entry.value,
                                  fallbackLabel: entry.value.isDefault
                                      ? 'Nhà riêng'
                                      : 'Địa chỉ ${entry.key + 1}',
                                  onSetDefault: entry.value.isDefault
                                      ? null
                                      : () async {
                                          await ref
                                              .read(accountRepositoryProvider)
                                              .updateAddress(entry.value.id, {
                                                'isDefault': true,
                                              });
                                          ref.invalidate(
                                            accountAddressesProvider,
                                          );
                                        },
                                  onEdit: () => _addressForm(
                                    context,
                                    ref,
                                    item: entry.value,
                                  ),
                                  onDelete: () async {
                                    await ref
                                        .read(accountRepositoryProvider)
                                        .deleteAddress(entry.value.id);
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
  final label = TextEditingController(text: item?.addressLabel ?? ''),
      name = TextEditingController(text: item?.recipientName ?? ''),
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
            _field(label, 'Tên địa chỉ (VD: Nhà riêng, Văn phòng)'),
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
            'addressLabel': label.text,
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
          form['addressLabel'] ?? '',
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
    return Scaffold(
      appBar: AppBar(title: const Text('Phương thức thanh toán')),
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
                              color: Theme.of(context).colorScheme.primary,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Ví Handigo',
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w600),
                              ),
                            ),
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
                              ?.copyWith(fontWeight: FontWeight.w600),
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
                                onPressed: () =>
                                    context.push('/customer/wallet/history'),
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
          Row(
            children: [
              Expanded(
                child: Text(
                  'Phương thức đã lưu',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              IconButton.filled(
                tooltip: 'Thêm phương thức thanh toán',
                onPressed: () async {
                  final added = await showDialog<bool>(
                    context: context,
                    builder: (_) => const _AddBankAccountDialog(),
                  );
                  if (added == true && context.mounted) {
                    ref.invalidate(accountBanksProvider);
                  }
                },
                icon: const Icon(Icons.add),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ref
              .watch(accountBanksProvider)
              .when(
                loading: () => const AppLoading(),
                error: (_, _) => AppMessage(
                  message: 'Không thể tải phương thức thanh toán.',
                  onRetry: () => ref.invalidate(accountBanksProvider),
                ),
                data: (items) {
                  final active = items
                      .where((item) => item['status'] != 'inactive')
                      .toList();
                  if (active.isEmpty) {
                    return const AppMessage(
                      message:
                          'Chưa có tài khoản ngân hàng đã lưu. Nhấn dấu + để thêm.',
                      icon: Icons.account_balance_outlined,
                    );
                  }
                  return Column(
                    children: active.map((item) {
                      final number = '${item['accountNumber'] ?? ''}';
                      final masked = number.length > 4
                          ? '•••• ${number.substring(number.length - 4)}'
                          : '•••• $number';
                      return Card(
                        child: ListTile(
                          leading: const CircleAvatar(
                            child: Icon(Icons.account_balance_outlined),
                          ),
                          title: Text('${item['bankName'] ?? ''}'),
                          subtitle: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${item['accountHolderName'] ?? ''}\n$masked',
                              ),
                              if (item['isDefault'] == true)
                                const Padding(
                                  padding: EdgeInsets.only(top: 4),
                                  child: Chip(label: Text('Mặc định')),
                                ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
        ],
      ),
    );
  }
}

class _AddBankAccountDialog extends ConsumerStatefulWidget {
  const _AddBankAccountDialog();

  @override
  ConsumerState<_AddBankAccountDialog> createState() =>
      _AddBankAccountDialogState();
}

class _AddBankAccountDialogState extends ConsumerState<_AddBankAccountDialog> {
  final _formKey = GlobalKey<FormState>();
  final _bank = TextEditingController();
  final _code = TextEditingController();
  final _number = TextEditingController();
  final _holder = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _bank.dispose();
    _code.dispose();
    _number.dispose();
    _holder.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving || !_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(accountRepositoryProvider).createBankAccount({
        'bankName': _bank.text.trim(),
        'bankCode': _code.text.trim(),
        'accountNumber': _number.text.trim(),
        'accountHolderName': _holder.text.trim(),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Không thể lưu tài khoản ngân hàng. Vui lòng thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(
    TextEditingController controller,
    String label,
    int min,
    int max,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: controller,
      enabled: !_saving,
      maxLength: max,
      decoration: InputDecoration(labelText: label, counterText: ''),
      validator: (value) => (value?.trim().length ?? 0) < min
          ? '$label phải có ít nhất $min ký tự.'
          : null,
    ),
  );

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: AlertDialog(
      title: const Text('Thêm phương thức thanh toán'),
      scrollable: true,
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Tài khoản ngân hàng'),
            const SizedBox(height: 16),
            _field(_bank, 'Tên ngân hàng', 1, 100),
            _field(_code, 'Mã ngân hàng', 1, 30),
            _field(_number, 'Số tài khoản', 4, 50),
            _field(_holder, 'Tên chủ tài khoản', 2, 100),
            if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: Text(_saving ? 'Đang lưu...' : 'Lưu'),
        ),
      ],
    ),
  );
}

class CustomerPaymentHistoryScreen extends ConsumerStatefulWidget {
  const CustomerPaymentHistoryScreen({super.key});

  @override
  ConsumerState<CustomerPaymentHistoryScreen> createState() =>
      _CustomerPaymentHistoryScreenState();
}

class _CustomerPaymentHistoryScreenState
    extends ConsumerState<CustomerPaymentHistoryScreen> {
  int _source = 0;
  int _page = 1;

  String _status(String? value) => switch (value) {
    'paid' || 'completed' || 'success' => 'Thành công',
    'pending' || 'processing' => 'Đang xử lý',
    'failed' => 'Thất bại',
    'refunded' || 'reversed' => 'Đã hoàn tiền',
    'cancelled' => 'Đã hủy',
    _ => 'Đang cập nhật',
  };

  String _method(String value) => switch (value) {
    'wallet' => 'Ví Handigo',
    'payos' || 'bank' => 'Chuyển khoản ngân hàng',
    'vnpay' => 'VNPay',
    'cash' => 'Tiền mặt',
    _ => 'Thanh toán đơn hàng',
  };

  String _detail(String? status, String? createdAt) {
    final date = DateTime.tryParse(createdAt ?? '')?.toLocal();
    return '${_status(status)}${date == null ? '' : ' · ${DateFormat('dd/MM/yyyy HH:mm').format(date)}'}';
  }

  Widget _pager(int totalPages) => totalPages <= 1
      ? const SizedBox.shrink()
      : Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(
              tooltip: 'Trang trước',
              onPressed: _page > 1 ? () => setState(() => _page--) : null,
              icon: const Icon(Icons.chevron_left),
            ),
            Text('Trang $_page / $totalPages'),
            IconButton(
              tooltip: 'Trang sau',
              onPressed: _page < totalPages
                  ? () => setState(() => _page++)
                  : null,
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        );

  Widget _walletHistory() => ref
      .watch(accountTransactionPageProvider(_page))
      .when(
        loading: () => const AppLoading(),
        error: (_, _) => AppMessage(
          message: 'Không thể tải giao dịch ví.',
          onRetry: () => ref.invalidate(accountTransactionPageProvider(_page)),
        ),
        data: (page) => page.items.isEmpty
            ? const AppMessage(message: 'Chưa có giao dịch ví.')
            : Column(
                children: [
                  ...page.items.map(
                    (item) => Card(
                      child: ListTile(
                        leading: Icon(
                          item.direction == 'in'
                              ? Icons.arrow_downward
                              : Icons.arrow_upward,
                        ),
                        title: Text(
                          item.description ?? _transactionLabel(item.type),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_detail(item.status, item.createdAt)),
                            Text(
                              '${item.direction == 'in' ? '+' : '-'}${_money(item.amount)}',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  _pager(page.totalPages),
                ],
              ),
      );

  Widget _paymentHistory() => ref
      .watch(accountPaymentHistoryProvider(_page))
      .when(
        loading: () => const AppLoading(),
        error: (_, _) => AppMessage(
          message: 'Không thể tải lịch sử thanh toán.',
          onRetry: () => ref.invalidate(accountPaymentHistoryProvider(_page)),
        ),
        data: (page) => page.items.isEmpty
            ? const AppMessage(message: 'Chưa có thanh toán đơn hàng.')
            : Column(
                children: [
                  ...page.items.map(
                    (item) => Card(
                      child: ListTile(
                        leading: const Icon(Icons.receipt_long_outlined),
                        title: Text(_method(item.method)),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_detail(item.status, item.createdAt)),
                            Text(
                              _money(item.amount),
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  _pager(page.totalPages),
                ],
              ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Lịch sử giao dịch')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final entry in const {
              0: 'Ví Handigo',
              1: 'Thanh toán đơn',
            }.entries)
              ChoiceChip(
                label: Text(entry.value),
                selected: _source == entry.key,
                onSelected: (_) => setState(() {
                  _source = entry.key;
                  _page = 1;
                }),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (_source == 0) _walletHistory() else _paymentHistory(),
      ],
    ),
  );
}

Future<void> _deposit(BuildContext context, WidgetRef ref) async {
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => WalletDepositDialog(
      repository: ref.read(accountRepositoryProvider),
      onChanged: () {
        if (!context.mounted) return;
        ref.invalidate(accountWalletProvider);
        ref.invalidate(accountTransactionsProvider);
        ref.invalidate(accountTransactionPageProvider);
      },
    ),
  );
}

class VoucherScreen extends ConsumerStatefulWidget {
  const VoucherScreen({super.key});
  @override
  ConsumerState<VoucherScreen> createState() => _VoucherScreenState();
}

class _VoucherScreenState extends ConsumerState<VoucherScreen> {
  int _tab = 0, _page = 1;
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  void _useVoucher(String code) {
    final normalized = code.trim().toUpperCase();
    if (normalized.isEmpty) return;
    ref.read(bookingDraftProvider.notifier).setVoucherCode(normalized);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Đã chọn voucher $normalized. Điều kiện áp dụng sẽ được kiểm tra khi xác nhận đặt dịch vụ.',
        ),
      ),
    );
    if (context.canPop()) context.pop();
  }

  Future<void> _redeem(HomeRewardOffer offer, int balance) async {
    if (await confirmRewardRedemption(context, ref, offer, balance)) {
      ref.invalidate(accountOwnedVouchersProvider);
      ref.invalidate(accountVouchersProvider);
      ref.invalidate(accountPublicVouchersProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final rewards = ref.watch(customerHomeRewardsProvider);
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Kho Voucher & Ưu đãi'),
          leading: IconButton(
            tooltip: 'Quay lại',
            onPressed: () => context.pop(),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Card(
                color: theme.colorScheme.surfaceContainerLowest,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(
                        Icons.stars_outlined,
                        color: theme.colorScheme.primary,
                        size: 32,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Điểm tích lũy hiện có'),
                            rewards.when(
                              loading: () => const LinearProgressIndicator(),
                              error: (_, _) => TextButton(
                                onPressed: () =>
                                    ref.invalidate(customerHomeRewardsProvider),
                                child: const Text('Tải lại điểm tích lũy'),
                              ),
                              data: (data) => Text(
                                '${NumberFormat.decimalPattern('vi').format(data.balance)} điểm',
                                style: theme.textTheme.titleLarge?.copyWith(
                                  color: theme.colorScheme.primary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              onTap: (index) => setState(() {
                _tab = index;
                _page = 1;
              }),
              tabs: const [
                Tab(text: 'Voucher của tôi'),
                Tab(text: 'Voucher hiện có'),
                Tab(text: 'Lịch sử sử dụng'),
              ],
            ),
            Expanded(
              child: switch (_tab) {
                0 =>
                  ref
                      .watch(accountOwnedVouchersProvider(_page))
                      .when(
                        loading: () => const AppLoading(),
                        error: (_, _) => AppMessage(
                          message: 'Không thể tải voucher của bạn.',
                          onRetry: () => ref.invalidate(
                            accountOwnedVouchersProvider(_page),
                          ),
                        ),
                        data: (data) => _pagedList(
                          data.items
                              .map(
                                (item) => _VoucherCard(
                                  item: item,
                                  onUse: () => _useVoucher(item.code),
                                ),
                              )
                              .toList(),
                          data.totalPages,
                          'Bạn chưa có voucher riêng. Hãy dùng điểm để đổi voucher ở tab Voucher hiện có.',
                        ),
                      ),
                1 => _available(),
                _ =>
                  ref
                      .watch(accountVoucherUsageProvider(_page))
                      .when(
                        loading: () => const AppLoading(),
                        error: (_, _) => AppMessage(
                          message: 'Không thể tải lịch sử sử dụng voucher.',
                          onRetry: () => ref.invalidate(
                            accountVoucherUsageProvider(_page),
                          ),
                        ),
                        data: (data) => _pagedList(
                          data.items.map(_usageCard).toList(),
                          data.totalPages,
                          'Bạn chưa sử dụng voucher nào.',
                        ),
                      ),
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _pagedList(List<Widget> cards, int totalPages, String emptyMessage) =>
      ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (cards.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Text(emptyMessage, textAlign: TextAlign.center),
            ),
          ...cards,
          if (_page > 1 || totalPages > 1)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  tooltip: 'Trang trước',
                  onPressed: _page > 1 ? () => setState(() => _page--) : null,
                  icon: const Icon(Icons.chevron_left),
                ),
                Expanded(
                  child: Text(
                    'Trang $_page / ${totalPages > 0 ? totalPages : 1}',
                    textAlign: TextAlign.center,
                  ),
                ),
                IconButton(
                  tooltip: 'Trang sau',
                  onPressed: _page < totalPages
                      ? () => setState(() => _page++)
                      : null,
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
        ],
      );

  Widget _available() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      Row(
        children: [
          Expanded(
            child: TextField(
              controller: _code,
              decoration: const InputDecoration(
                hintText: 'Nhập mã voucher',
                prefixIcon: Icon(Icons.local_offer_outlined),
              ),
            ),
          ),
          const SizedBox(width: 8),
          FilledButton(
            onPressed: () => _useVoucher(_code.text),
            child: const Text('Áp dụng'),
          ),
        ],
      ),
      const SizedBox(height: 20),
      Text(
        'Đổi voucher bằng điểm',
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const SizedBox(height: 10),
      ref
          .watch(customerHomeRewardsProvider)
          .when(
            loading: () => const AppLoading(),
            error: (_, _) => AppMessage(
              message: 'Không thể tải ưu đãi đổi điểm.',
              onRetry: () => ref.invalidate(customerHomeRewardsProvider),
            ),
            data: (data) => Column(
              children: [
                if (data.offers.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Hiện chưa có ưu đãi đổi điểm.'),
                  ),
                for (final offer in data.offers)
                  _VoucherCard(
                    item: VoucherItem(
                      code: '',
                      name: rewardOfferName(
                        offer,
                        NumberFormat.decimalPattern('vi'),
                      ),
                      discountType: offer.discountType,
                      discountValue: offer.discountValue,
                      minOrderAmount: offer.minOrderAmount,
                      maxDiscountAmount: offer.maxDiscountAmount,
                      applicableOrderType: offer.applicableOrderType,
                    ),
                    points: offer.points,
                    validityDays: data.validityDays,
                    actionLabel: data.balance >= offer.points
                        ? 'Đổi voucher'
                        : 'Chưa đủ điểm',
                    onUse: data.balance >= offer.points
                        ? () => _redeem(offer, data.balance)
                        : null,
                  ),
              ],
            ),
          ),
      const SizedBox(height: 12),
      Text('Voucher công khai', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 10),
      ref
          .watch(accountPublicVouchersProvider)
          .when(
            loading: () => const AppLoading(),
            error: (_, _) => AppMessage(
              message: 'Không thể tải voucher hiện có.',
              onRetry: () => ref.invalidate(accountPublicVouchersProvider),
            ),
            data: (items) => Column(
              children: [
                if (items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Hiện chưa có voucher công khai khả dụng.'),
                  ),
                for (final item in items)
                  _VoucherCard(
                    item: item,
                    publicVoucher: true,
                    onUse: () => _useVoucher(item.code),
                  ),
              ],
            ),
          ),
    ],
  );

  Widget _usageCard(VoucherUsageItem item) {
    final usedAt = DateTime.tryParse(item.usedAt ?? '');
    return Card(
      color: Theme.of(context).colorScheme.surfaceContainerLowest,
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.history_rounded),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            if (item.code.isNotEmpty) Text('Mã ${item.code}'),
            Text('Đã giảm ${_money(item.discountAmount)}'),
            if (usedAt != null)
              Text(
                'Ngày dùng ${DateFormat('HH:mm · dd/MM/yyyy').format(usedAt.toLocal())}',
              ),
            Text(
              item.status == 'cancelled_not_restored'
                  ? 'Đơn đã hủy · Voucher không được hoàn lại'
                  : 'Đã sử dụng',
            ),
            if (item.orderId != null)
              TextButton(
                onPressed: () =>
                    context.push('/customer/orders/${item.orderId}'),
                child: Text('Xem đơn ${item.orderCode ?? ''}'),
              ),
          ],
        ),
      ),
    );
  }
}

class _VoucherCard extends StatelessWidget {
  const _VoucherCard({
    required this.item,
    this.onUse,
    this.points,
    this.validityDays,
    this.publicVoucher = false,
    this.actionLabel = 'Dùng ngay',
  });
  final VoucherItem item;
  final VoidCallback? onUse;
  final int? points;
  final int? validityDays;
  final bool publicVoucher;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final discount = item.discountType == 'PERCENT'
        ? '${item.discountValue.toStringAsFixed(0)}%'
        : _money(item.discountValue);
    final reserved = item.reservedOrderId != null;
    final condition = switch (item.applicableOrderType) {
      'fixed_price' => 'Áp dụng cho dịch vụ giá cố định.',
      'variable_price' => 'Áp dụng cho tiền cọc dịch vụ khảo sát.',
      _ => 'Áp dụng cho dịch vụ đủ điều kiện.',
    };
    return Card(
      color: theme.colorScheme.surfaceContainerLowest,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(12),
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
                        'Giảm $discount',
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: theme.colorScheme.primary,
                        ),
                      ),
                      Text(item.name, style: theme.textTheme.titleSmall),
                      if (item.code.isNotEmpty)
                        Text(
                          'Mã ${item.code}',
                          style: theme.textTheme.bodySmall,
                        ),
                      if (points != null)
                        Text(
                          '${NumberFormat.decimalPattern('vi').format(points)} điểm để đổi',
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: theme.colorScheme.primary,
                          ),
                        ),
                      if (publicVoucher) const Text('Không cần đổi điểm'),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (item.description?.isNotEmpty == true) Text(item.description!),
            Text(condition),
            if (validityDays != null)
              Text('Hiệu lực $validityDays ngày kể từ khi đổi'),
            if (item.minOrderAmount > 0)
              Text('Đơn tối thiểu ${_money(item.minOrderAmount)}'),
            if (item.maxDiscountAmount != null && item.maxDiscountAmount! > 0)
              Text('Giảm tối đa ${_money(item.maxDiscountAmount!)}'),
            if (!item.neverExpires && item.endAt != null)
              Text(
                'Hạn dùng ${DateTime.tryParse(item.endAt!) == null ? item.endAt : DateFormat('dd/MM/yyyy').format(DateTime.parse(item.endAt!).toLocal())}',
              ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton(
                onPressed: reserved
                    ? () => context.push(
                        '/customer/orders/${item.reservedOrderId}',
                      )
                    : item.usable
                    ? onUse
                    : null,
                child: Text(
                  reserved
                      ? 'Xem đơn đang giữ mã'
                      : item.expired
                      ? 'Đã hết hạn'
                      : !item.usable
                      ? 'Chưa khả dụng'
                      : actionLabel,
                ),
              ),
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
    return AccountDetailScaffold(
      title: 'Đánh giá Handigo',
      child: ref
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
                        '${'★' * item.rating.floor()}${item.rating % 1 == 0 ? '' : '½'} (${item.rating}/5)',
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
    onCreate: () => _showCaseForm(context, ref, report: false),
    empty: 'Bạn chưa có yêu cầu hỗ trợ nào.',
  );
}

class ComplaintScreen extends ConsumerWidget {
  const ComplaintScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => _CaseList(
    title: 'Báo cáo sự cố',
    provider: accountReportsProvider,
    onCreate: () => _showCaseForm(context, ref, report: true),
    empty: 'Bạn chưa có báo cáo nào.',
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
  Widget build(BuildContext context, WidgetRef ref) => AccountDetailScaffold(
    title: title,
    actions: [
      IconButton(
        tooltip: 'Tạo mới',
        onPressed: onCreate,
        icon: const Icon(Icons.add),
      ),
    ],
    child: ref
        .watch(provider)
        .when(
          loading: () => const AppLoading(),
          error: (_, _) => AppMessage(
            message: 'Không thể tải dữ liệu.',
            onRetry: () => ref.invalidate(provider),
          ),
          data: (page) => page.items.isEmpty
              ? AppMessage(message: empty)
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: page.items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final item = page.items[i] as SupportItem;
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    item.title,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                ),
                                _CaseStatusBadge(status: item.status),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              item.description,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (item.category?.isNotEmpty == true) ...[
                              const SizedBox(height: 10),
                              Text(
                                _caseTypeLabel(item.category!),
                                style: Theme.of(context).textTheme.labelMedium
                                    ?.copyWith(
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.primary,
                                    ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
  );
}

Future<void> _showCaseForm(
  BuildContext context,
  WidgetRef ref, {
  required bool report,
}) async {
  final created = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => FractionallySizedBox(
      heightFactor: .96,
      child: _CaseFormSheet(report: report),
    ),
  );
  if (created == true) {
    ref.invalidate(report ? accountReportsProvider : accountTicketsProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            report ? 'Đã gửi báo cáo sự cố.' : 'Đã gửi yêu cầu hỗ trợ.',
          ),
        ),
      );
    }
  }
}

class _CaseImage {
  const _CaseImage(this.file, this.bytes);
  final XFile file;
  final Uint8List bytes;
}

class _CaseFormSheet extends ConsumerStatefulWidget {
  const _CaseFormSheet({required this.report});
  final bool report;

  @override
  ConsumerState<_CaseFormSheet> createState() => _CaseFormSheetState();
}

class _CaseFormSheetState extends ConsumerState<_CaseFormSheet> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final List<_CaseImage> _images = [];
  String _category = 'ACCOUNT';
  String _reportType = 'user_behavior';
  String _target = 'participant';
  String? _orderId;
  bool _busy = false;
  bool _picking = false;
  String? _error;
  String? _progress;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    if (_busy || _picking || _images.length >= 5) return;
    setState(() {
      _picking = true;
      _error = null;
    });
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );
      if (file == null || !mounted) return;
      final extension = file.name.split('.').last.toLowerCase();
      final mime = file.mimeType?.toLowerCase();
      if (mime == null
          ? !['jpg', 'jpeg', 'png', 'webp'].contains(extension)
          : !['image/jpeg', 'image/png', 'image/webp'].contains(mime)) {
        throw const ApiException('Vui lòng chọn ảnh JPG, PNG hoặc WebP.');
      }
      if (await file.length() > 5 * 1024 * 1024) {
        throw const ApiException('Mỗi ảnh không được vượt quá 5 MB.');
      }
      final bytes = await file.readAsBytes();
      if (bytes.isEmpty) {
        throw const ApiException('Ảnh không có dữ liệu.');
      }
      if (_images.any((image) => listEquals(image.bytes, bytes))) {
        throw const ApiException('Ảnh này đã được chọn.');
      }
      setState(() => _images.add(_CaseImage(file, bytes)));
    } catch (error) {
      if (mounted) setState(() => _error = _caseError(error));
    } finally {
      if (mounted) setState(() => _picking = false);
    }
  }

  Future<void> _submit(List<OrderSummary> orders) async {
    if (_busy || _picking || !_form.currentState!.validate()) return;
    final selected = orders.where((order) => order.id == _orderId).firstOrNull;
    if (widget.report && selected == null) {
      setState(() => _error = 'Vui lòng chọn đơn dịch vụ liên quan.');
      return;
    }
    if (widget.report &&
        _reportType == 'service_quality' &&
        selected?.status != 'completed') {
      setState(
        () => _error = 'Báo cáo chất lượng chỉ áp dụng cho đơn đã hoàn thành.',
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _progress = _images.isEmpty
          ? 'Đang gửi yêu cầu…'
          : 'Đang tải ảnh 1/${_images.length}…';
    });
    try {
      final repository = ref.read(accountRepositoryProvider);
      final attachments = <Map<String, dynamic>>[];
      for (var index = 0; index < _images.length; index++) {
        if (!mounted) return;
        setState(
          () => _progress = 'Đang tải ảnh ${index + 1}/${_images.length}…',
        );
        final image = _images[index];
        final url = await repository.uploadCaseImage(image.file);
        attachments.add({
          'fileType': 'image',
          'url': url,
          'mimeType': image.file.mimeType,
          'fileName': image.file.name,
        });
      }
      if (!mounted) return;
      setState(() => _progress = 'Đang gửi yêu cầu…');
      if (widget.report) {
        final user = ref.read(authControllerProvider).user!;
        final targetOrder =
            _reportType == 'service_quality' || _target == 'order';
        final payload = <String, dynamic>{
          'targetType': targetOrder
              ? 'order'
              : user.role.name == 'provider'
              ? 'user'
              : 'provider',
          'orderId': selected!.id,
          'reportType': _reportType,
          'title': _title.text.trim(),
          'description': _description.text.trim(),
          'evidenceImages': attachments.map((file) => file['url']).toList(),
          'evidenceFiles': attachments,
        };
        if (!targetOrder) {
          if (user.role.name == 'provider') {
            if (selected.customerId == null) {
              throw const ApiException(
                'Đơn đã chọn không có thông tin khách hàng để báo cáo.',
              );
            }
            payload['targetUserId'] = selected.customerId;
          } else {
            if (selected.providerId == null) {
              throw const ApiException(
                'Đơn đã chọn chưa có nhà cung cấp để báo cáo.',
              );
            }
            payload['targetProviderId'] = selected.providerId;
          }
        }
        await repository.createReport(payload);
      } else {
        await repository.createTicket({
          'category': _category,
          'subject': _title.text.trim(),
          'description': _description.text.trim(),
          if (_category == 'PAYMENT' && _orderId != null) 'orderId': _orderId,
          if (attachments.isNotEmpty) 'attachments': attachments,
        });
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) setState(() => _error = _caseError(error));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _progress = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final ordersState = ref.watch(orderListProvider);
    final orders = ordersState.asData?.value.items ?? const <OrderSummary>[];
    final availableOrders = widget.report && _reportType == 'service_quality'
        ? orders.where((order) => order.status == 'completed').toList()
        : orders;
    final showOrders = widget.report || _category == 'PAYMENT';
    final user = ref.watch(authControllerProvider).user;
    return PopScope(
      canPop: !_busy && !_picking,
      child: Scaffold(
        backgroundColor: _accountBackground,
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: Text(
            widget.report ? 'Gửi báo cáo sự cố' : 'Tạo yêu cầu hỗ trợ',
          ),
          actions: [
            IconButton(
              tooltip: 'Đóng',
              onPressed: _busy ? null : () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded),
            ),
          ],
        ),
        body: Form(
          key: _form,
          child: ListView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
            children: [
              _CaseIntro(report: widget.report),
              const SizedBox(height: 16),
              Card(
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (!widget.report)
                        DropdownButtonFormField<String>(
                          initialValue: _category,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Loại hỗ trợ',
                            prefixIcon: Icon(Icons.help_outline_rounded),
                          ),
                          items: _supportCategories.entries
                              .map(
                                (entry) => DropdownMenuItem(
                                  value: entry.key,
                                  child: Text(
                                    entry.value,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: _busy
                              ? null
                              : (value) => setState(() {
                                  _category = value!;
                                  if (value != 'PAYMENT') _orderId = null;
                                }),
                        ),
                      if (widget.report) ...[
                        DropdownButtonFormField<String>(
                          initialValue: _reportType,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Loại báo cáo',
                            prefixIcon: Icon(Icons.flag_outlined),
                          ),
                          items: _reportTypes.entries
                              .map(
                                (entry) => DropdownMenuItem(
                                  value: entry.key,
                                  child: Text(
                                    entry.value,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: _busy
                              ? null
                              : (value) => setState(() {
                                  _reportType = value!;
                                  _orderId = null;
                                  if (value == 'service_quality') {
                                    _target = 'order';
                                  }
                                }),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _reportType == 'service_quality'
                              ? 'order'
                              : _target,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Đối tượng báo cáo',
                            prefixIcon: Icon(Icons.person_search_outlined),
                          ),
                          items: [
                            DropdownMenuItem(
                              value: 'participant',
                              child: Text(
                                user?.role.name == 'provider'
                                    ? 'Khách hàng của đơn'
                                    : 'Nhà cung cấp của đơn',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const DropdownMenuItem(
                              value: 'order',
                              child: Text(
                                'Đơn dịch vụ',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                          onChanged: _busy || _reportType == 'service_quality'
                              ? null
                              : (value) => setState(() => _target = value!),
                        ),
                      ],
                      if (showOrders) ...[
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _orderId,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: widget.report
                                ? 'Đơn dịch vụ'
                                : 'Đơn thanh toán liên quan',
                            prefixIcon: const Icon(Icons.receipt_long_outlined),
                          ),
                          items: availableOrders
                              .map(
                                (order) => DropdownMenuItem(
                                  value: order.id,
                                  child: Text(
                                    '${order.code} · ${order.serviceName}',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: _busy || ordersState.isLoading
                              ? null
                              : (value) => setState(() => _orderId = value),
                          validator: widget.report
                              ? (value) => value == null
                                    ? 'Vui lòng chọn đơn dịch vụ.'
                                    : null
                              : null,
                        ),
                        if (ordersState.isLoading) ...[
                          const SizedBox(height: 8),
                          const LinearProgressIndicator(),
                        ],
                        if (ordersState.hasError) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Không thể tải danh sách đơn.',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ],
                        if (!ordersState.isLoading && availableOrders.isEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              _reportType == 'service_quality'
                                  ? 'Không có đơn đã hoàn thành phù hợp.'
                                  : 'Bạn chưa có đơn dịch vụ.',
                            ),
                          ),
                      ],
                      if (widget.report &&
                          _reportType == 'service_quality') ...[
                        const SizedBox(height: 10),
                        Text(
                          'Chỉ áp dụng cho đơn đã hoàn thành trong thời hạn hệ thống cho phép.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _title,
                        enabled: !_busy,
                        maxLength: 200,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Tiêu đề',
                          prefixIcon: Icon(Icons.title_rounded),
                        ),
                        validator: (value) => (value?.trim().length ?? 0) < 5
                            ? 'Tiêu đề cần có ít nhất 5 ký tự.'
                            : null,
                      ),
                      const SizedBox(height: 4),
                      TextFormField(
                        controller: _description,
                        enabled: !_busy,
                        minLines: 5,
                        maxLines: 8,
                        maxLength: 3000,
                        decoration: InputDecoration(
                          labelText: widget.report
                              ? 'Nội dung chi tiết'
                              : 'Mô tả cần hỗ trợ',
                          alignLabelWithHint: true,
                        ),
                        validator: (value) => (value?.trim().length ?? 0) < 10
                            ? 'Nội dung cần có ít nhất 10 ký tự.'
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              _CaseImagePicker(
                images: _images,
                busy: _busy || _picking,
                onAdd: _pickImage,
                onRemove: (index) => setState(() => _images.removeAt(index)),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
        bottomNavigationBar: SafeArea(
          child: Container(
            color: _accountSurface,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_busy) ...[
                  const LinearProgressIndicator(),
                  const SizedBox(height: 6),
                  Text(_progress ?? 'Đang xử lý…'),
                  const SizedBox(height: 8),
                ],
                FilledButton.icon(
                  onPressed: _busy || ordersState.isLoading
                      ? null
                      : () => _submit(orders),
                  icon: const Icon(Icons.send_rounded),
                  label: Text(
                    _busy
                        ? 'Đang gửi…'
                        : widget.report
                        ? 'Gửi báo cáo'
                        : 'Gửi yêu cầu hỗ trợ',
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

class _CaseIntro extends StatelessWidget {
  const _CaseIntro({required this.report});
  final bool report;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: _figmaPrimarySoft,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          report ? Icons.shield_outlined : Icons.support_agent_rounded,
          color: _figmaPrimary,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            report
                ? 'Chọn đúng đơn và mô tả rõ sự cố để Handigo có đủ thông tin xem xét.'
                : 'Đội ngũ Handigo sẽ phản hồi yêu cầu của bạn ngay trong trung tâm hỗ trợ.',
          ),
        ),
      ],
    ),
  );
}

class _CaseImagePicker extends StatelessWidget {
  const _CaseImagePicker({
    required this.images,
    required this.busy,
    required this.onAdd,
    required this.onRemove,
  });
  final List<_CaseImage> images;
  final bool busy;
  final VoidCallback onAdd;
  final ValueChanged<int> onRemove;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Ảnh bằng chứng',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'Không bắt buộc · Tối đa 5 ảnh, mỗi ảnh 5 MB.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          for (var index = 0; index < images.length; index++) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: _accountBackground,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.memory(
                      images[index].bytes,
                      width: 52,
                      height: 52,
                      fit: BoxFit.cover,
                      cacheWidth: 156,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      images[index].file.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Xóa ảnh ${index + 1}',
                    onPressed: busy ? null : () => onRemove(index),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: busy || images.length >= 5 ? null : onAdd,
            icon: const Icon(Icons.add_photo_alternate_outlined),
            label: Text('Thêm ảnh (${images.length}/5)'),
          ),
        ],
      ),
    ),
  );
}

class _CaseStatusBadge extends StatelessWidget {
  const _CaseStatusBadge({required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'resolved' || 'closed' || 'confirmed' => const Color(0xFF198754),
      'cancelled' || 'rejected' => Theme.of(context).colorScheme.error,
      'in_progress' || 'under_review' => const Color(0xFFB05A00),
      _ => Theme.of(context).colorScheme.primary,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _caseStatusLabel(status),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

const _supportCategories = <String, String>{
  'ACCOUNT': 'Tài khoản',
  'PAYMENT': 'Thanh toán',
  'TECHNICAL': 'Lỗi kỹ thuật',
  'APPEAL': 'Yêu cầu xem xét',
  'GUIDANCE': 'Hướng dẫn sử dụng',
};

const _reportTypes = <String, String>{
  'service_quality': 'Chất lượng dịch vụ',
  'harassment': 'Quấy rối',
  'insulting_language': 'Ngôn từ xúc phạm',
  'fraud': 'Gian lận',
  'impersonation': 'Mạo danh',
  'spam_booking': 'Đặt đơn rác',
  'payment_fraud': 'Gian lận thanh toán',
  'user_behavior': 'Hành vi người dùng',
  'other': 'Khác',
};

String _caseError(Object error) => error is ApiException
    ? error.message
    : 'Không thể gửi yêu cầu. Nội dung đã nhập vẫn được giữ lại.';

String _caseStatusLabel(String value) => switch (value) {
  'open' || 'pending' => 'Đã tiếp nhận',
  'in_progress' || 'under_review' => 'Đang xử lý',
  'waiting_user' || 'evidence_requested' => 'Cần bổ sung',
  'resolved' || 'closed' || 'confirmed' => 'Đã xử lý',
  'cancelled' => 'Đã hủy',
  'rejected' => 'Đã từ chối',
  _ => value,
};

String _caseTypeLabel(String value) =>
    _supportCategories[value] ?? _reportTypes[value] ?? value;

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
          ],
        ),
      ],
    ),
  );
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
            fontSize: 13,
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
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          isApproved
              ? 'Chuyển sang chế độ Thợ để quản lý\nlịch làm việc và thu nhập.'
              : 'Đăng ký cung cấp dịch vụ trên Handigo.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: _accountSurface,
            fontSize: 16,
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
              fontSize: 16,
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
                    fontSize: 16,
                    height: 1.45,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Số dư khả dụng',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: _accountMuted,
              fontSize: 13,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            balance == null ? 'Đang tải...' : _accountMoney(balance!),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: _accountInk,
              fontSize: 28,
              height: 1.45,
              fontWeight: FontWeight.w600,
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

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(
    text,
    style: Theme.of(
      context,
    ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
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
                      fontWeight: FontWeight.w600,
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
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
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
              backgroundColor: Theme.of(
                context,
              ).colorScheme.surfaceContainerLow,
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
                  fontSize: 11,
                ),
              ),
              TextField(
                controller: controller,
                keyboardType: keyboardType,
                textInputAction: textInputAction,
                readOnly: readOnly,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w400,
                  fontSize: 16,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  contentPadding: const EdgeInsets.only(top: 5, bottom: 1),
                  prefixIcon: Icon(
                    icon,
                    color: Theme.of(context).colorScheme.primary,
                    size: 17,
                  ),
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
                          fontWeight: FontWeight.w600,
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
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      Icon(
                        icon,
                        color: Theme.of(context).colorScheme.primary,
                        size: 17,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          value,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w400,
                                fontSize: 16,
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
        Icon(
          Icons.check,
          size: 12,
          color: Theme.of(context).colorScheme.primary,
        ),
        const SizedBox(width: 3),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.primary,
            fontSize: 11,
          ),
        ),
      ],
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
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Thêm địa chỉ để đặt dịch vụ nhanh hơn',
                    style: TextStyle(
                      color: _accountMuted,
                      fontSize: 13,
                      height: 1.4,
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
      fontSize: 13,
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
                fontSize: 16,
                fontWeight: FontWeight.w600,
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
          textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
        ),
        child: const Text('Xác định vị trí'),
      ),
    ],
  );
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.item,
    required this.fallbackLabel,
    required this.onSetDefault,
    required this.onEdit,
    required this.onDelete,
  });

  final AddressItem item;
  final String fallbackLabel;
  final VoidCallback? onSetDefault;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final label = item.addressLabel.trim().isEmpty
        ? fallbackLabel
        : item.addressLabel.trim();
    return DecoratedBox(
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
                Icon(_addressLabelIcon(label), color: _figmaPrimary, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                      color: _accountInk,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
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
                        fontWeight: FontWeight.w500,
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
                      fontWeight: FontWeight.w600,
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
                        fontSize: 13,
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
                        Icon(
                          Icons.check_rounded,
                          color: _accountMuted,
                          size: 17,
                        ),
                        SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            'Địa chỉ mặc định',
                            style: TextStyle(
                              color: _accountMuted,
                              fontSize: 13,
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
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
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
}

IconData _addressLabelIcon(String label) {
  final normalized = label.trim().toLowerCase();
  if (normalized.contains('văn phòng') || normalized.contains('công ty')) {
    return Icons.business_outlined;
  }
  if (normalized.contains('nhà')) return Icons.home_outlined;
  return Icons.location_on_outlined;
}

String _fullAddress(AddressItem item) => item.displayAddress;

ButtonStyle _addressActionStyle(Color color) => TextButton.styleFrom(
  foregroundColor: color,
  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
  minimumSize: const Size(0, 32),
  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
  textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
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
                fontSize: 16,
                fontWeight: FontWeight.w600,
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
                  fontWeight: FontWeight.w600,
                ),
              ),
              SizedBox(height: 4),
              Text(
                'Địa chỉ của bạn chỉ được chia sẻ với kỹ thuật viên sau khi đơn đặt dịch vụ được xác nhận.',
                style: TextStyle(
                  color: _accountMuted,
                  fontSize: 13,
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
  return selected.province.isEmpty
      ? selected.displayAddress
      : formatAddress(selected.province);
}

String _money(num value) => '${NumberFormat('#,##0', 'vi_VN').format(value)}đ';
String _accountMoney(num value) =>
    '${NumberFormat('#,##0', 'vi_VN').format(value)} ₫';
String _transactionLabel(String type) => switch (type) {
  'deposit' => 'Nạp tiền',
  'payment' => 'Thanh toán đơn hàng',
  'refund' => 'Hoàn tiền',
  _ => 'Giao dịch ví',
};
