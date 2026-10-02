import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../app/theme/app_theme.dart';
import '../../booking/domain/booking_models.dart';
import '../../booking/presentation/booking_provider.dart';
import '../../services/domain/service.dart';
import '../../services/domain/service_category.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/utils/media_url.dart';
import '../domain/service_detail.dart';
import 'service_catalog_provider.dart';

class ServiceCatalogScreen extends ConsumerStatefulWidget {
  const ServiceCatalogScreen({this.initialSearch, this.initialCategoryId, super.key});

  final String? initialSearch;
  final String? initialCategoryId;

  @override
  ConsumerState<ServiceCatalogScreen> createState() =>
      _ServiceCatalogScreenState();
}

class _ServiceCatalogScreenState extends ConsumerState<ServiceCatalogScreen> {
  late String? _categoryId = widget.initialCategoryId;
  late String _search = widget.initialSearch ?? '';
  late final TextEditingController _searchController = TextEditingController(text: _search);

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(serviceCatalogCategoriesProvider);
    final services = ref.watch(serviceCatalogServicesProvider(_categoryId));
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(
              Icons.home_repair_service_rounded,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 8),
            const Text('Handigo'),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => context.push('/customer/notifications'),
            icon: const Icon(Icons.notifications_none_rounded),
            tooltip: 'Thông báo',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(serviceCatalogCategoriesProvider);
          ref.invalidate(serviceCatalogServicesProvider(_categoryId));
          await ref.read(serviceCatalogServicesProvider(_categoryId).future);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (value) => setState(() => _search = value),
                    decoration: const InputDecoration(
                      hintText: 'Tìm dịch vụ lắp đặt, máy lạnh, điện...',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: () {},
                  icon: const Icon(Icons.tune),
                  tooltip: 'Lọc dịch vụ',
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppTheme.primaryDark,
                    Theme.of(context).colorScheme.primary,
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Tuần lễ vàng Handigo',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Ưu đãi dành riêng cho dịch vụ tại nhà',
                          style: TextStyle(color: Colors.white70),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .18),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Text(
                      'ƯU ĐÃI',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Tất cả dịch vụ',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
                ),
                services.maybeWhen(
                  data: (result) => Text(
                    '${result.items.length} dịch vụ',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  orElse: () => const SizedBox.shrink(),
                ),
              ],
            ),
            const SizedBox(height: 8),
            categories.when(
              loading: () => const SizedBox(height: 48, child: AppLoading()),
              error: (error, _) => AppMessage(
                message: 'Không thể tải danh mục dịch vụ.',
                onRetry: () => ref.invalidate(serviceCatalogCategoriesProvider),
              ),
              data: (items) => _CategoryChips(
                categories: items,
                selectedId: _categoryId,
                onSelected: (id) => setState(() => _categoryId = id),
              ),
            ),
            const SizedBox(height: 16),
            services.when(
              loading: () => const SizedBox(height: 240, child: AppLoading()),
              error: (error, _) => AppMessage(
                message: 'Không thể tải danh sách dịch vụ.',
                onRetry: () =>
                    ref.invalidate(serviceCatalogServicesProvider(_categoryId)),
              ),
              data: (result) {
                final visible = result.items.where((service) {
                  final keyword = _search.trim().toLowerCase();
                  return keyword.isEmpty ||
                      '${service.name} ${service.description}'
                          .toLowerCase()
                          .contains(keyword);
                }).toList();
                if (visible.isEmpty)
                  return const AppMessage(message: 'Không có dịch vụ phù hợp.');
                return _ServiceList(services: visible);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryChips extends StatelessWidget {
  const _CategoryChips({
    required this.categories,
    required this.selectedId,
    required this.onSelected,
  });
  final List<ServiceCategory> categories;
  final String? selectedId;
  final ValueChanged<String?> onSelected;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 48,
    child: ListView(
      scrollDirection: Axis.horizontal,
      children: [
        ChoiceChip(
          label: const Text('Tất cả'),
          selected: selectedId == null,
          onSelected: (_) => onSelected(null),
        ),
        const SizedBox(width: 8),
        ...categories.map(
          (category) => Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(category.name),
              selected: selectedId == category.id,
              onSelected: (_) => onSelected(category.id),
            ),
          ),
        ),
      ],
    ),
  );
}

class _ServiceList extends StatelessWidget {
  const _ServiceList({required this.services});
  final List<Service> services;

  @override
  Widget build(BuildContext context) => ListView.separated(
    shrinkWrap: true,
    physics: const NeverScrollableScrollPhysics(),
    itemCount: services.length,
    separatorBuilder: (_, __) => const SizedBox(height: 12),
    itemBuilder: (context, index) => _ServiceListTile(service: services[index]),
  );
}

class _ServiceListTile extends StatelessWidget {
  const _ServiceListTile({required this.service});
  final Service service;

  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => context.push('/customer/services/${service.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 132,
            width: double.infinity,
            child: _ServiceImage(
              url: service.image,
              height: 132,
              width: double.infinity,
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (service.categoryName != null)
                  Text(
                    service.categoryName!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.secondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                const SizedBox(height: 4),
                Text(
                  service.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  service.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _priceLabel(service),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    FilledButton(
                      onPressed: () =>
                          context.push('/customer/services/${service.id}'),
                      child: const Text('Đặt ngay'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({required this.serviceId, super.key});
  final String serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(serviceDetailProvider(serviceId));
    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết dịch vụ')),
      body: detail.when(
        loading: () => const AppLoading(),
        error: (error, _) => AppMessage(
          message: 'Không thể tải chi tiết dịch vụ.',
          onRetry: () => ref.invalidate(serviceDetailProvider(serviceId)),
        ),
        data: (value) => Scaffold(
          body: _ServiceDetailContent(
            detail: value,
          ),
          bottomNavigationBar: _StickyBookingBar(
            service: value.service,
            priceLabel: value.options.isEmpty
                ? _priceLabel(value.service)
                : 'Từ ${_money(value.options.map((option) => option.price).reduce((a, b) => a < b ? a : b))}',
            onPressed: () => _showBookingOptions(context, ref, value),
          ),
        ),
      ),
    );
  }
}

class _ServiceDetailContent extends ConsumerWidget {
  const _ServiceDetailContent({required this.detail});
  final ServiceDetail detail;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final service = detail.service;
    return ListView(
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        Stack(
          children: [
            _ServiceImage(
              url: service.image,
              height: 230,
              width: double.infinity,
            ),
            Positioned(
              top: 12,
              left: 12,
              child: _DetailIconButton(
                icon: Icons.arrow_back,
                onPressed: () => context.pop(),
              ),
            ),
            Positioned(
              top: 12,
              right: 12,
              child: Row(
                children: [
                  _DetailIconButton(
                    icon: Icons.share_outlined,
                    onPressed: () {},
                  ),
                  const SizedBox(width: 8),
                  _DetailIconButton(
                    icon: Icons.favorite_border,
                    onPressed: () {},
                  ),
                ],
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (service.categoryName != null)
                Text(
                  service.categoryName!,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: Theme.of(context).colorScheme.secondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              const SizedBox(height: 8),
              Text(
                service.name,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              Row(
                children: [
                  Icon(
                    Icons.star_rounded,
                    color: Theme.of(context).colorScheme.tertiary,
                    size: 20,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    service.totalFeedbacks > 0
                        ? '${service.averageRating.toStringAsFixed(1)} (${service.totalFeedbacks} đánh giá)'
                        : 'Chưa có đánh giá',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(width: 16),
                  Icon(Icons.check_circle_outline, color: Theme.of(context).colorScheme.primary, size: 18),
                  const SizedBox(width: 4),
                  Text('${service.totalCompletedOrders} lượt hoàn thành', style: Theme.of(context).textTheme.labelMedium),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                service.description,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 28, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Quy trình 5 bước thực hiện chuẩn Handigo',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 12),
              ...[
                'Kiểm tra vận hành máy ban đầu',
                'Tháo bọc đạt chuyên dụng chống bẩn',
                'Xịt rửa khử khuẩn Nano chuyên sâu',
                'Sấy khô & lắp ráp hoàn chỉnh',
                'Nghiệm thu & bàn giao an tâm',
              ].asMap().entries.map(
                (entry) => _ProcessStep(
                  number: entry.key + 1,
                  title: entry.value,
                  description: const [
                    'Khởi động thử thiết bị, kiểm tra lưu lượng gió và dáng máy để nhiệt độ của gió thực tế.',
                    'Tháo vỏ mặt nạ máy lạnh, phủ bạt bao quanh dàn lạnh với màng gom nước thải không dây bắn bẩn.',
                    'Dùng máy xịt áp lực rửa sạch dàn nhiệt, lồng quạt ly tâm và vật dụng dịch khử khuẩn sinh học.',
                    'Dùng máy sấy sạch nước linh kiện tủ, lắp vỏ bảo vệ và thông đường ống nước xả.',
                    'Chạy kiểm tra 15 phút, dọn dẹp hiện trường sạch sẽ và kích hoạt bảo hành điện tử 30 ngày.',
                  ][entry.key],
                  isLast: entry.key == 4,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

void _showBookingOptions(
  BuildContext context,
  WidgetRef ref,
  ServiceDetail detail,
) {
  ref.read(bookingDraftProvider.notifier).reset();
  ref.read(bookingDraftProvider.notifier).startService(detail.service.id);
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _BookingOptionsSheet(
      detail: detail,
      onContinue: () {
        Navigator.of(sheetContext).pop();
        context.push('/customer/bookings/new/${detail.service.id}');
      },
    ),
  );
}

class _StickyBookingBar extends StatelessWidget {
  const _StickyBookingBar({required this.service, required this.priceLabel, required this.onPressed});
  final Service service;
  final String priceLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
        decoration: BoxDecoration(
          color: scheme.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [BoxShadow(blurRadius: 18, offset: Offset(0, 6), color: Color(0x33000000))],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Giá từ', style: Theme.of(context).textTheme.labelSmall),
                  Text(
                    priceLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: scheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed: onPressed,
              icon: const Icon(Icons.calendar_month_outlined, size: 18),
              label: const Text('Đặt lịch dịch vụ ngay'),
              style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
            ),
          ],
        ),
      ),
    );
  }
}

class _BookingOptionsSheet extends ConsumerWidget {
  const _BookingOptionsSheet({required this.detail, required this.onContinue});
  final ServiceDetail detail;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingDraftProvider);
    final controller = ref.read(bookingDraftProvider.notifier);
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 12, 16, 16 + MediaQuery.paddingOf(context).bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 42, height: 4, decoration: BoxDecoration(color: theme.colorScheme.outlineVariant, borderRadius: BorderRadius.circular(99)))),
              const SizedBox(height: 14),
              Text('Chọn gói dịch vụ', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              if (detail.options.isEmpty)
                const Text('Dịch vụ này chưa có gói tùy chọn.')
              else
                ...detail.options.take(10).map(
                  (option) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(color: draft.selectedOptionIds.contains(option.id) ? theme.colorScheme.primary : theme.colorScheme.outlineVariant),
                    ),
                    child: CheckboxListTile(
                      value: draft.selectedOptionIds.contains(option.id),
                      onChanged: (_) => controller.toggleOption(option.id),
                      title: Text(option.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text('${option.description ?? ''}${option.description?.isNotEmpty == true ? '\n' : ''}${_money(option.price)}'),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                  ),
                ),
              const SizedBox(height: 8),
              SizedBox(width: double.infinity, child: FilledButton(onPressed: onContinue, child: const Text('Tiếp tục đặt lịch'))),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailIconButton extends StatelessWidget {
  const _DetailIconButton({required this.icon, required this.onPressed});
  final IconData icon;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white.withValues(alpha: .92),
    shape: const CircleBorder(),
    child: IconButton(
      onPressed: onPressed,
      icon: Icon(icon),
      color: Theme.of(context).colorScheme.onSurface,
    ),
  );
}

class _Benefit extends StatelessWidget {
  const _Benefit({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title, subtitle;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.primary, size: 22),
        const SizedBox(height: 4),
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall,
        ),
      ],
    ),
  );
}

class _ProcessStep extends StatelessWidget {
  const _ProcessStep({
    required this.number,
    required this.title,
    required this.description,
    required this.isLast,
  });
  final int number;
  final String title, description;
  final bool isLast;
  @override
  Widget build(BuildContext context) => IntrinsicHeight(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Column(
          children: [
            CircleAvatar(
              radius: 14,
              backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
              foregroundColor: Theme.of(context).colorScheme.primary,
              child: Text(
                '$number',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            if (!isLast)
              Expanded(
                child: Container(
                  width: 2,
                  color: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: .18),
                ),
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12, top: 3),
            child: Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(description, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class BookingRouteScreen extends ConsumerWidget {
  const BookingRouteScreen({required this.serviceId, super.key});

  final String serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(serviceDetailProvider(serviceId));
    return detail.when(
      loading: () => const Scaffold(body: AppLoading()),
      error: (_, __) => Scaffold(
        body: AppMessage(
          message: 'Không thể tải dịch vụ để đặt lịch.',
          onRetry: () => ref.invalidate(serviceDetailProvider(serviceId)),
        ),
      ),
      data: (value) => BookingScreen(detail: value),
    );
  }
}

class BookingScreen extends ConsumerStatefulWidget {
  const BookingScreen({required this.detail, super.key});
  final ServiceDetail detail;
  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  int _step = 0;
  bool _busy = false;
  String? _error;
  BookingPreview? _preview;
  List<Address> _addresses = const [];
  final _descriptionController = TextEditingController();
  final _voucherController = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(() async {
      try {
        final addresses = await ref
            .read(serviceCatalogRepositoryProvider)
            .addresses();
        if (mounted) setState(() => _addresses = addresses);
      } catch (_) {
        if (mounted) setState(() => _error = 'Không thể tải sổ địa chỉ.');
      }
    });
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _voucherController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingDraftProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(_step == 0 ? 'Đặt dịch vụ' : 'Xác nhận & Thanh toán'),
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: () =>
              _step == 0 ? context.pop() : setState(() => _step = 0),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      body: _busy
          ? const AppLoading()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                _StepIndicator(step: _step),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  _ErrorBanner(message: _error!),
                ],
                const SizedBox(height: 16),
                if (_step == 0)
                  _BookingForm(
                    detail: widget.detail,
                    addresses: _addresses,
                    descriptionController: _descriptionController,
                    voucherController: _voucherController,
                    onAddAddress: _addAddress,
                  )
                else
                  _BookingReview(
                    detail: widget.detail,
                    draft: draft,
                    preview: _preview,
                  ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: () => _step == 0 ? _loadPreview() : _submitOrder(),
                  icon: Icon(
                    _step == 0
                        ? Icons.arrow_forward_rounded
                        : Icons.lock_outline_rounded,
                  ),
                  label: Text(
                    _step == 0 ? 'Tiếp tục sang Thanh toán' : 'Thanh toán ngay',
                  ),
                ),
              ],
            ),
    );
  }

  Future<void> _loadPreview() async {
    final draft = ref.read(bookingDraftProvider);
    if (draft.selectedOptionIds.isEmpty && widget.detail.options.isNotEmpty) {
      setState(() => _error = 'Vui lòng chọn ít nhất một gói hoặc tuỳ chọn.');
      return;
    }
    if (draft.addressId == null) {
      setState(() => _error = 'Vui lòng chọn địa chỉ thực hiện.');
      return;
    }
    if ((draft.type == BookingType.scheduled ||
            draft.type == BookingType.recurring) &&
        draft.scheduledAt == null) {
      setState(() => _error = 'Vui lòng chọn lịch thực hiện.');
      return;
    }
    if (draft.type == BookingType.recurring &&
        (draft.recurrenceUnit == null || draft.recurrenceCount == null)) {
      setState(() => _error = 'Vui lòng chọn chu kỳ và số buổi định kỳ.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final preview = await ref
          .read(serviceCatalogRepositoryProvider)
          .preview(
            serviceId: widget.detail.service.id,
            type: draft.type,
            selectedOptions: _selectedOptions(draft),
          );
      if (mounted)
        setState(() {
          _preview = preview;
          _step = 1;
        });
    } catch (_) {
      if (mounted)
        setState(() => _error = 'Không thể tính tổng tiền từ hệ thống.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitOrder() async {
    final draft = ref.read(bookingDraftProvider);
    CreatedOrder? createdOrder;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final order = await ref
          .read(serviceCatalogRepositoryProvider)
          .createOrder(
            serviceId: widget.detail.service.id,
            selectedOptions: _selectedOptions(draft),
            addressId: draft.addressId!,
            type: draft.type,
            paymentMethod: draft.paymentMethod,
            scheduledAt: draft.scheduledAt,
            recurrenceUnit: draft.recurrenceUnit,
            recurrenceCount: draft.recurrenceCount,
            problemDescription: _descriptionController.text,
            attachments: draft.attachments,
            voucherCode: draft.voucherCode,
          );
      createdOrder = order;
      final payment = await ref
          .read(serviceCatalogRepositoryProvider)
          .createPayment(orderId: order.id, method: draft.paymentMethod);
      if (!mounted) return;
      ref.read(bookingDraftProvider.notifier).reset();
      context.go(
        '/customer/bookings/success',
        extra: {
          'orderId': order.id,
          'orderCode': order.orderCode,
          'paymentStatus': payment.status,
          'checkoutUrl': payment.checkoutUrl,
        },
      );
    } catch (_) {
      if (!mounted) return;
      if (createdOrder != null) {
        ref.read(bookingDraftProvider.notifier).reset();
        context.go(
          '/customer/bookings/success',
          extra: {
            'orderId': createdOrder.id,
            'orderCode': createdOrder.orderCode,
            'paymentStatus': 'pending',
          },
        );
      } else {
        setState(
          () => _error =
              'Không thể tạo đơn. Dữ liệu đặt dịch vụ vẫn còn để bạn thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<Map<String, dynamic>> _selectedOptions(BookingDraft draft) => draft
      .selectedOptionIds
      .map((id) => {'optionId': id, 'quantity': draft.quantities[id] ?? 1})
      .toList();

  Future<void> _addAddress() async {
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (context) => const _AddAddressDialog(),
    );
    if (result == null || !mounted) return;
    try {
      final address = await ref
          .read(serviceCatalogRepositoryProvider)
          .createAddress(
            recipientName: result['recipientName']!,
            recipientPhone: result['recipientPhone']!,
            fullAddress: result['fullAddress']!,
            province: result['province']!,
            ward: result['ward']!,
          );
      setState(() => _addresses = [..._addresses, address]);
      ref.read(bookingDraftProvider.notifier).setAddress(address.id);
    } catch (_) {
      setState(
        () => _error = 'Không thể thêm địa chỉ. Vui lòng kiểm tra thông tin.',
      );
    }
  }
}

class _BookingForm extends ConsumerWidget {
  const _BookingForm({
    required this.detail,
    required this.addresses,
    required this.descriptionController,
    required this.voucherController,
    required this.onAddAddress,
  });
  final ServiceDetail detail;
  final List<Address> addresses;
  final TextEditingController descriptionController;
  final TextEditingController voucherController;
  final VoidCallback onAddAddress;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final draft = ref.watch(bookingDraftProvider);
    final controller = ref.read(bookingDraftProvider.notifier);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    Icons.home_repair_service_rounded,
                    color: theme.colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Dịch vụ đã chọn',
                        style: theme.textTheme.labelMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        detail.service.name,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (detail.service.description.isNotEmpty)
                        Text(
                          detail.service.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Tùy chọn chi tiết',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        ...detail.options.map(
          (option) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(
                color: draft.selectedOptionIds.contains(option.id)
                    ? theme.colorScheme.primary
                    : theme.colorScheme.outlineVariant,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                children: [
                  Checkbox(
                    value: draft.selectedOptionIds.contains(option.id),
                    onChanged: (_) => controller.toggleOption(option.id),
                  ),
                  Expanded(
                    child: InkWell(
                      onTap: () => controller.toggleOption(option.id),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            option.name,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          if (option.description?.isNotEmpty == true)
                            Text(
                              option.description!,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodySmall,
                            ),
                          const SizedBox(height: 2),
                          Text(
                            _money(option.price),
                            style: TextStyle(
                              color: theme.colorScheme.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (option.allowsQuantity &&
                      draft.selectedOptionIds.contains(option.id))
                    _QuantitySelector(
                      value: draft.quantities[option.id] ?? 1,
                      onChanged: (value) =>
                          controller.setQuantity(option.id, value),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Loại đơn dịch vụ',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            _TypeChip(
              label: 'Bình thường',
              type: BookingType.normal,
              selected: draft.type,
              onSelected: controller.setType,
            ),
            _TypeChip(
              label: 'Khẩn cấp',
              type: BookingType.urgent,
              selected: draft.type,
              onSelected: controller.setType,
            ),
            _TypeChip(
              label: 'Đặt lịch',
              type: BookingType.scheduled,
              selected: draft.type,
              onSelected: controller.setType,
            ),
            _TypeChip(
              label: 'Định kỳ',
              type: BookingType.recurring,
              selected: draft.type,
              onSelected: controller.setType,
            ),
          ],
        ),
        if (draft.type == BookingType.scheduled ||
            draft.type == BookingType.recurring) ...[
          const SizedBox(height: 12),
          _SectionLabel(
            title: 'Chọn lịch hẹn & thời gian',
            icon: Icons.calendar_month_outlined,
          ),
          OutlinedButton.icon(
            onPressed: () async {
              final date = await showDatePicker(
                context: context,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 365)),
                initialDate: DateTime.now().add(const Duration(days: 1)),
              );
              if (date != null)
                controller.setScheduledAt(
                  DateTime(date.year, date.month, date.day, 9),
                );
            },
            icon: const Icon(Icons.event),
            label: Text(
              draft.scheduledAt == null
                  ? 'Chọn ngày thực hiện'
                  : _date(draft.scheduledAt!),
            ),
          ),
        ],
        if (draft.type == BookingType.recurring) ...[
          DropdownButtonFormField<String>(
            value: draft.recurrenceUnit,
            decoration: const InputDecoration(labelText: 'Chu kỳ'),
            items: const [
              DropdownMenuItem(value: 'weekly', child: Text('Hàng tuần')),
              DropdownMenuItem(value: 'monthly', child: Text('Hàng tháng')),
            ],
            onChanged: (value) {
              if (value != null)
                controller.setRecurrence(value, value == 'weekly' ? 1 : 4);
            },
          ),
          DropdownButtonFormField<int>(
            value: draft.recurrenceCount,
            decoration: const InputDecoration(labelText: 'Số buổi'),
            items:
                (draft.recurrenceUnit == 'monthly'
                        ? const [4, 8, 12]
                        : const [1, 2, 3, 4])
                    .map(
                      (value) => DropdownMenuItem(
                        value: value,
                        child: Text('$value buổi'),
                      ),
                    )
                    .toList(),
            onChanged: (value) {
              if (value != null && draft.recurrenceUnit != null)
                controller.setRecurrence(draft.recurrenceUnit!, value);
            },
          ),
        ],
        const SizedBox(height: 16),
        const SizedBox(height: 8),
        _SectionLabel(
          title: 'Địa chỉ làm việc',
          icon: Icons.location_on_outlined,
        ),
        if (addresses.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text('Bạn chưa có địa chỉ.'),
          ),
        OutlinedButton.icon(
          onPressed: onAddAddress,
          icon: const Icon(Icons.add_location_alt_outlined),
          label: const Text('Thêm địa chỉ'),
        ),
        ...addresses.map(
          (address) => Card(
            margin: const EdgeInsets.only(bottom: 8),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(
                color: draft.addressId == address.id
                    ? theme.colorScheme.primary
                    : theme.colorScheme.outlineVariant,
              ),
            ),
            child: RadioListTile<String>(
              value: address.id,
              groupValue: draft.addressId,
              onChanged: (value) {
                if (value != null) controller.setAddress(value);
              },
              title: Row(
                children: [
                  Expanded(
                    child: Text(
                      address.recipientName,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  if (address.isDefault)
                    const Chip(
                      label: Text('Mặc định'),
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
              subtitle: Text(
                '${address.recipientPhone}\n${address.fullAddress}',
              ),
              secondary: const Icon(Icons.home_outlined),
            ),
          ),
        ),
        const SizedBox(height: 12),
        _SectionLabel(
          title: 'Ghi chú cho thợ',
          icon: Icons.sticky_note_2_outlined,
        ),
        TextField(
          controller: descriptionController,
          maxLines: 3,
          maxLength: 2000,
          decoration: const InputDecoration(
            labelText: 'Ghi chú gì đó cho thợ',
            hintText: 'Ví dụ: hướng dẫn đường vào nhà hoặc yêu cầu đặc biệt',
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: voucherController,
          textCapitalization: TextCapitalization.characters,
          onChanged: ref.read(bookingDraftProvider.notifier).setVoucherCode,
          decoration: const InputDecoration(
            labelText: 'Mã voucher (không bắt buộc)',
            prefixIcon: Icon(Icons.discount_outlined),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () => _pickAttachment(context, ref),
          icon: const Icon(Icons.photo_camera_outlined),
          label: Text('Thêm ảnh sự cố (${draft.attachments.length}/4)'),
        ),
        const SizedBox(height: 12),
        _SectionLabel(
          title: 'Phương thức thanh toán',
          icon: Icons.payments_outlined,
        ),
        ...PaymentMethod.values.map(
          (method) => Card(
            margin: const EdgeInsets.only(bottom: 6),
            child: RadioListTile<PaymentMethod>(
              value: method,
              groupValue: draft.paymentMethod,
              onChanged: (value) {
                if (value != null) controller.setPaymentMethod(value);
              },
              secondary: Icon(_paymentIcon(method)),
              title: Text(_paymentLabel(method)),
              subtitle: Text(_paymentHint(method)),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _pickAttachment(BuildContext context, WidgetRef ref) async {
    final current = ref.read(bookingDraftProvider).attachments;
    if (current.length >= 4) return;
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (file == null) return;
    try {
      final url = await ref
          .read(serviceCatalogRepositoryProvider)
          .uploadAttachment(file);
      ref.read(bookingDraftProvider.notifier).setAttachments([...current, url]);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể tải ảnh sự cố.')),
        );
      }
    }
  }
}

class _AddAddressDialog extends StatefulWidget {
  const _AddAddressDialog();
  @override
  State<_AddAddressDialog> createState() => _AddAddressDialogState();
}

class _AddAddressDialogState extends State<_AddAddressDialog> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _province = TextEditingController();
  final _ward = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _province.dispose();
    _ward.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Thêm địa chỉ'),
    content: Form(
      key: _formKey,
      child: SingleChildScrollView(
        child: Column(
          children: [
            _field(_name, 'Họ tên người nhận'),
            _field(_phone, 'Số điện thoại', keyboardType: TextInputType.phone),
            _field(_address, 'Địa chỉ đầy đủ'),
            _field(_province, 'Tỉnh/thành phố'),
            _field(_ward, 'Phường/xã'),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Hủy'),
      ),
      FilledButton(
        onPressed: () {
          if (_formKey.currentState!.validate())
            Navigator.pop(context, {
              'recipientName': _name.text.trim(),
              'recipientPhone': _phone.text.trim(),
              'fullAddress': _address.text.trim(),
              'province': _province.text.trim(),
              'ward': _ward.text.trim(),
            });
        },
        child: const Text('Lưu'),
      ),
    ],
  );

  Widget _field(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(labelText: label),
      validator: (value) =>
          value == null || value.trim().isEmpty ? 'Vui lòng nhập $label' : null,
    ),
  );
}

class _BookingReview extends StatelessWidget {
  const _BookingReview({
    required this.detail,
    required this.draft,
    required this.preview,
  });
  final ServiceDetail detail;
  final BookingDraft draft;
  final BookingPreview? preview;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Card(
        child: ListTile(
          leading: const Icon(Icons.home_repair_service_outlined),
          title: Text(
            detail.service.name,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          subtitle: Text(
            '${_bookingTypeLabel(draft.type)} · ${_paymentLabel(draft.paymentMethod)}',
          ),
        ),
      ),
      const SizedBox(height: 12),
      if (draft.scheduledAt != null)
        Card(
          child: ListTile(
            leading: const Icon(Icons.calendar_month_outlined),
            title: const Text('Lịch hẹn'),
            subtitle: Text(_date(draft.scheduledAt!)),
          ),
        ),
      const SizedBox(height: 8),
      Text(
        'Chi tiết thanh toán',
        style: Theme.of(
          context,
        ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
      ),
      if (preview != null)
        Card(
          margin: const EdgeInsets.only(top: 8),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              children: [
                _PriceRow(label: 'Phí dịch vụ', value: preview!.baseAmount),
                if (preview!.immediateFee > 0)
                  _PriceRow(label: 'Phụ phí', value: preview!.immediateFee),
                if (draft.voucherCode != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Voucher đã chọn: ${draft.voucherCode}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                const Divider(),
                _PriceRow(
                  label: 'Tổng thanh toán',
                  value: preview!.bookingAmount,
                  emphasized: true,
                ),
                if (preview!.depositAmount > 0)
                  Text('Tiền đặt cọc: ${_money(preview!.depositAmount)}'),
              ],
            ),
          ),
        ),
      const SizedBox(height: 8),
      const Text(
        'Tổng tiền và phí được xác nhận từ backend. Không tự tính lại trên thiết bị.',
      ),
    ],
  );
}

class BookingSuccessScreen extends ConsumerStatefulWidget {
  const BookingSuccessScreen({
    this.orderId,
    this.orderCode,
    this.paymentStatus,
    this.checkoutUrl,
    super.key,
  });
  final String? orderId;
  final String? orderCode;
  final String? paymentStatus;
  final String? checkoutUrl;
  @override
  ConsumerState<BookingSuccessScreen> createState() =>
      _BookingSuccessScreenState();
}

class _BookingSuccessScreenState extends ConsumerState<BookingSuccessScreen> {
  bool checking = false;
  String? status;

  Future<void> _reconcile() async {
    if (widget.orderId == null) return;
    setState(() => checking = true);
    try {
      final result = await ref
          .read(serviceCatalogRepositoryProvider)
          .reconcilePayment(widget.orderId!);
      if (mounted) setState(() => status = result.status);
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Chưa thể kiểm tra trạng thái thanh toán.'),
          ),
        );
    } finally {
      if (mounted) setState(() => checking = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                (status ?? widget.paymentStatus) == 'paid'
                    ? Icons.check_circle
                    : Icons.schedule,
                size: 72,
                color: (status ?? widget.paymentStatus) == 'paid'
                    ? AppTheme.successGreen
                    : Colors.orange,
              ),
              const SizedBox(height: 16),
              Text(
                (status ?? widget.paymentStatus) == 'paid'
                    ? 'Đặt dịch vụ thành công'
                    : 'Đơn đã được tạo, đang chờ thanh toán',
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text('Mã đơn: ${widget.orderCode ?? 'đang cập nhật'}'),
              if (widget.checkoutUrl != null)
                const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: Text(
                    'Vui lòng tiếp tục thanh toán theo liên kết do hệ thống cung cấp.',
                  ),
                ),
              if (widget.checkoutUrl != null) ...[
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () async {
                    final uri = Uri.tryParse(widget.checkoutUrl!);
                    if (uri != null && await canLaunchUrl(uri))
                      await launchUrl(
                        uri,
                        mode: LaunchMode.externalApplication,
                      );
                  },
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Mở trang thanh toán'),
                ),
                if (widget.orderId != null)
                  OutlinedButton.icon(
                    onPressed: checking ? null : _reconcile,
                    icon: checking
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator.adaptive(),
                          )
                        : const Icon(Icons.refresh),
                    label: const Text('Kiểm tra trạng thái thanh toán'),
                  ),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => context.go('/customer'),
                child: const Text('Về trang chủ'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({
    required this.label,
    required this.type,
    required this.selected,
    required this.onSelected,
  });
  final String label;
  final BookingType type, selected;
  final ValueChanged<BookingType> onSelected;
  @override
  Widget build(BuildContext context) => ChoiceChip(
    label: Text(label),
    selected: type == selected,
    onSelected: (_) => onSelected(type),
  );
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.title, required this.icon});
  final String title;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(
      children: [
        Icon(icon, size: 19, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
      ],
    ),
  );
}

class _QuantitySelector extends StatelessWidget {
  const _QuantitySelector({required this.value, required this.onChanged});
  final int value;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(12),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          onPressed: value > 1 ? () => onChanged(value - 1) : null,
          icon: const Icon(Icons.remove, size: 16),
          visualDensity: VisualDensity.compact,
        ),
        Text('$value', style: const TextStyle(fontWeight: FontWeight.w700)),
        IconButton(
          onPressed: () => onChanged(value + 1),
          icon: const Icon(Icons.add, size: 16),
          visualDensity: VisualDensity.compact,
        ),
      ],
    ),
  );
}

class _StepIndicator extends StatelessWidget {
  const _StepIndicator({required this.step});
  final int step;
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final labels = ['Chọn gói & lịch', 'Thanh toán'];
    return Row(
      children: [
        for (var index = 0; index < labels.length; index++) ...[
          CircleAvatar(
            radius: 14,
            backgroundColor: index <= step
                ? theme.colorScheme.primary
                : theme.colorScheme.surfaceContainerHighest,
            foregroundColor: index <= step
                ? theme.colorScheme.onPrimary
                : theme.colorScheme.onSurfaceVariant,
            child: index < step
                ? const Icon(Icons.check, size: 16)
                : Text('${index + 1}'),
          ),
          const SizedBox(width: 8),
          Text(
            labels[index],
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: index == step ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
          if (index < labels.length - 1)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Divider(
                  color: index < step
                      ? theme.colorScheme.primary
                      : theme.colorScheme.outlineVariant,
                  thickness: 2,
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    color: Theme.of(context).colorScheme.errorContainer,
    child: Text(message),
  );
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.emphasized = false,
  });
  final String label;
  final double value;
  final bool emphasized;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: emphasized
              ? const TextStyle(fontWeight: FontWeight.bold)
              : null,
        ),
        Text(
          _money(value),
          style: emphasized
              ? TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.primary,
                )
              : null,
        ),
      ],
    ),
  );
}

class _ServiceImage extends StatelessWidget {
  const _ServiceImage({this.url, this.height = 88, this.width = 88});
  final String? url;
  final double height, width;
  @override
  Widget build(BuildContext context) {
    final imageUrl = usableMediaUrl(url);
    return ClipRRect(
    borderRadius: BorderRadius.circular(12),
    child: imageUrl == null
        ? Container(
            height: height,
            width: width,
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: const Icon(Icons.home_repair_service_outlined),
          )
        : Image.network(
            imageUrl,
            height: height,
            width: width,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              height: height,
              width: width,
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: const Icon(Icons.home_repair_service_outlined),
            ),
          ),
  );
  }
}

String _money(double value) => '${value.toStringAsFixed(0)}đ';
String _priceLabel(Service service) {
  final price = service.fixedPrice ?? service.minOptionPrice;
  return price == null ? 'Liên hệ để biết giá' : 'Từ ${_money(price)}';
}

String _date(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
String _paymentLabel(PaymentMethod value) => switch (value) {
  PaymentMethod.wallet => 'Ví Handigo',
  PaymentMethod.bank => 'Chuyển khoản/PayOS',
  PaymentMethod.cash => 'Tiền mặt',
};
IconData _paymentIcon(PaymentMethod value) => switch (value) {
  PaymentMethod.wallet => Icons.account_balance_wallet_outlined,
  PaymentMethod.bank => Icons.account_balance_outlined,
  PaymentMethod.cash => Icons.payments_outlined,
};
String _paymentHint(PaymentMethod value) => switch (value) {
  PaymentMethod.wallet => 'Thanh toán nhanh bằng số dư ví Handigo',
  PaymentMethod.bank => 'Thanh toán qua cổng PayOS',
  PaymentMethod.cash => 'Thanh toán trực tiếp khi hoàn tất dịch vụ',
};
String _bookingTypeLabel(BookingType value) => switch (value) {
  BookingType.normal => 'Bình thường',
  BookingType.urgent => 'Khẩn cấp',
  BookingType.scheduled => 'Đặt lịch',
  BookingType.recurring => 'Định kỳ',
};
