import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:speech_to_text/speech_to_text.dart' as speech;
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/config/app_config.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../../providers/domain/featured_provider.dart';
import '../../services/domain/service.dart';
import '../../services/domain/service_category.dart';
import '../../orders/presentation/order_screens.dart';
import '../../chat/presentation/chat_screens.dart';
import '../../account/presentation/account_screens.dart';
import '../domain/customer_home_data.dart';
import 'customer_home_provider.dart';
import 'device_location_provider.dart';

class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key});

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _index = 0;
  late final List<Widget> _pages = const [
    CustomerHomeScreen(),
    CustomerOrdersTab(),
    CustomerMessagesTab(),
    CustomerAccountTab(),
  ];

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: NavigationBarTheme(
        data: NavigationBarThemeData(
          backgroundColor: scheme.surfaceContainerLowest,
          indicatorColor: scheme.primary,
          indicatorShape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          iconTheme: WidgetStateProperty.resolveWith(
            (states) => IconThemeData(
              color: states.contains(WidgetState.selected)
                  ? scheme.onPrimary
                  : scheme.onSurfaceVariant,
            ),
          ),
          labelTextStyle: WidgetStateProperty.resolveWith(
            (states) => Theme.of(context).textTheme.labelSmall?.copyWith(
              color: states.contains(WidgetState.selected)
                  ? scheme.primary
                  : scheme.onSurfaceVariant,
              fontWeight: states.contains(WidgetState.selected)
                  ? FontWeight.w700
                  : FontWeight.w500,
            ),
          ),
        ),
        child: NavigationBar(
          height: 70,
          elevation: 8,
          selectedIndex: _index,
          onDestinationSelected: (index) => setState(() => _index = index),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home),
              label: 'Trang chủ',
            ),
            NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long),
              label: 'Đơn hàng',
            ),
            NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline),
              selectedIcon: Icon(Icons.chat_bubble),
              label: 'Tin nhắn',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Tài khoản',
            ),
          ],
        ),
      ),
    );
  }
}

class CustomerHomeScreen extends ConsumerWidget {
  const CustomerHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final home = ref.watch(customerHomeProvider);
    final location = ref.watch(deviceLocationProvider);
    return Scaffold(
      appBar: CustomerAppBar(
        userName: auth.user?.fullName ?? 'bạn',
        unreadCount: home.asData?.value.unreadNotificationCount ?? 0,
        locationLabel: location.asData?.value ?? 'Đang xác định vị trí...',
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(customerHomeProvider.future),
        child: home.when(
          loading: () => const AppLoading(),
          error: (error, _) => AppMessage(
            message: 'Không thể tải dữ liệu trang chủ.',
            onRetry: () => ref.invalidate(customerHomeProvider),
          ),
          data: (data) => CustomerHomeContent(data: data),
        ),
      ),
    );
  }
}

class CustomerAppBar extends StatelessWidget implements PreferredSizeWidget {
  const CustomerAppBar({
    required this.userName,
    required this.unreadCount,
    required this.locationLabel,
    super.key,
  });

  final String userName;
  final int unreadCount;
  final String locationLabel;

  @override
  Size get preferredSize => const Size.fromHeight(72);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AppBar(
      toolbarHeight: 72,
      titleSpacing: 12,
      elevation: 0,
      shadowColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      shape: Border(
        bottom: BorderSide(
          color: Colors.black.withValues(alpha: .16),
          width: .8,
        ),
      ),
      title: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: scheme.surfaceContainerLow,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.location_on_outlined, color: scheme.primary),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'VỊ TRÍ HIỆN TẠI',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: scheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Row(
                  children: [
                    Text(
                      locationLabel,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 3),
                    Icon(Icons.keyboard_arrow_down, size: 16, color: scheme.primary),
                  ],
                ),
              ],
            ),
          ),
          Text(
            'Handigo',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: scheme.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          tooltip: 'Thông báo',
          onPressed: () => context.push('/customer/notifications'),
          icon: Badge(
            isLabelVisible: unreadCount > 0,
            backgroundColor: scheme.secondary,
            textColor: scheme.onSecondary,
            label: Text(unreadCount > 99 ? '99+' : '$unreadCount'),
            child: Icon(Icons.notifications_none, color: scheme.onSurfaceVariant),
          ),
        ),
        const SizedBox(width: 8),
      ],
    );
  }
}

class CustomerHomeContent extends StatelessWidget {
  const CustomerHomeContent({required this.data, super.key});

  final CustomerHomeData data;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        _HomeSearchField(categories: data.categories),
        const SizedBox(height: 14),
        const _HomeIntroCard(),
        const SizedBox(height: 24),
        _HomeSectionHeader(
          title: 'Danh mục dịch vụ',
          actionLabel: 'Xem tất cả',
          onAction: () => context.push('/customer/services'),
        ),
        const SizedBox(height: 12),
        _CategoryGrid(categories: data.categories),
        const SizedBox(height: 24),
        _HomeSectionHeader(
          title: 'Dịch vụ nổi bật',
          actionLabel: 'Xem tất cả',
          onAction: () => context.push('/customer/services'),
        ),
        const SizedBox(height: 12),
        _ServiceHorizontalList(services: data.services),
        const SizedBox(height: 24),
        _HomeSectionHeader(
          title: 'Thợ nổi bật gần đây',
          actionLabel: 'Bán kính 5km',
        ),
        const SizedBox(height: 12),
        _ProviderList(providers: data.providers),
      ],
    );
  }
}

class _HomeSearchField extends StatelessWidget {
  const _HomeSearchField({required this.categories});

  final List<ServiceCategory> categories;

  @override
  Widget build(BuildContext context) => _HomeSearchFieldBody(categories: categories);
}

class _HomeSearchFieldBody extends StatefulWidget {
  const _HomeSearchFieldBody({required this.categories});

  final List<ServiceCategory> categories;

  @override
  State<_HomeSearchFieldBody> createState() => _HomeSearchFieldBodyState();
}

class _HomeSearchFieldBodyState extends State<_HomeSearchFieldBody> {
  final _speech = speech.SpeechToText();
  bool _isListening = false;

  @override
  void dispose() {
    _speech.stop();
    super.dispose();
  }

  Future<void> _startVoiceSearch() async {
    if (_isListening) {
      await _speech.stop();
      if (mounted) setState(() => _isListening = false);
      return;
    }

    final available = await _speech.initialize(
      onStatus: (status) {
        if (mounted && status == 'done') setState(() => _isListening = false);
      },
      onError: (_) {
        if (mounted) setState(() => _isListening = false);
      },
    );
    if (!available) {
      if (mounted) {
        AppToast.show(
          context,
          'Thiết bị chưa hỗ trợ hoặc chưa cấp quyền tìm kiếm bằng giọng nói.',
          type: AppToastType.error,
        );
      }
      return;
    }

    if (mounted) setState(() => _isListening = true);
    await _speech.listen(
      localeId: 'vi_VN',
      onResult: (result) {
        if (!mounted || result.recognizedWords.trim().isEmpty) return;
        if (result.finalResult) {
          setState(() => _isListening = false);
          _speech.stop();
          context.push(
            '/customer/services?q=${Uri.encodeComponent(result.recognizedWords.trim())}',
          );
        }
      },
    );
  }

  Future<void> _showFilters() async {
    final result = await AppModal.show<_HomeSearchFilter>(
      context,
      title: 'Bộ lọc tìm kiếm',
      builder: (context) => _HomeSearchFilterContent(
        categories: widget.categories,
      ),
    );
    if (!mounted || result == null) return;
    final params = <String, String>{
      if (result.categoryId != null) 'categoryId': result.categoryId!,
      if (result.searchQuery != null) 'q': result.searchQuery!,
    };
    final query = params.isEmpty
        ? ''
        : '?${Uri(queryParameters: params).query}';
    context.push('/customer/services$query');
  }

  @override
  Widget build(BuildContext context) => TextField(
    readOnly: true,
    onTap: () => context.push('/customer/services'),
    decoration: InputDecoration(
      hintText: _isListening ? 'Đang nghe, hãy nói tên dịch vụ...' : 'Tìm dịch vụ sửa chữa, dọn dẹp...',
      prefixIcon: const Icon(Icons.search),
      suffixIcon: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: _isListening ? 'Dừng tìm kiếm bằng giọng nói' : 'Tìm kiếm bằng giọng nói',
            onPressed: _startVoiceSearch,
            icon: Icon(_isListening ? Icons.stop_circle_outlined : Icons.mic_none),
          ),
          IconButton(
            tooltip: 'Lọc dịch vụ',
            onPressed: _showFilters,
            icon: const Icon(Icons.tune),
          ),
        ],
      ),
    ),
  );
}

class _HomeSearchFilter {
  const _HomeSearchFilter({this.categoryId, this.searchQuery});
  final String? categoryId;
  final String? searchQuery;
}

class _HomeSearchFilterContent extends StatefulWidget {
  const _HomeSearchFilterContent({required this.categories});
  final List<ServiceCategory> categories;

  @override
  State<_HomeSearchFilterContent> createState() => _HomeSearchFilterContentState();
}

class _HomeSearchFilterContentState extends State<_HomeSearchFilterContent> {
  String? _selectedCategory;
  String? _searchQuery;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text('Danh mục dịch vụ'),
      const SizedBox(height: 10),
      if (widget.categories.isEmpty)
        const Text('Chưa có bộ lọc danh mục khả dụng.')
      else
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilterChip(
              label: const Text('Tất cả'),
              selected: _selectedCategory == null,
              onSelected: (_) => setState(() => _selectedCategory = null),
            ),
            ...widget.categories.map(
              (category) => FilterChip(
                label: Text(category.name),
                selected: _selectedCategory == category.id,
                onSelected: (_) => setState(() => _selectedCategory = category.id),
              ),
            ),
          ],
        ),
      const SizedBox(height: 20),
      const Text('Tìm kiếm phổ biến'),
      const SizedBox(height: 8),
      Wrap(
        spacing: 8,
        children: ['Sửa điện', 'Vệ sinh máy lạnh', 'Dọn nhà']
            .map(
              (item) => InputChip(
                label: Text(item),
                selected: _searchQuery == item,
                onPressed: () => setState(() => _searchQuery = item),
              ),
            )
            .toList(),
      ),
      const SizedBox(height: 20),
      SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: () => Navigator.of(context).pop(
            _HomeSearchFilter(
              categoryId: _selectedCategory,
              searchQuery: _searchQuery,
            ),
          ),
          child: const Text('Áp dụng bộ lọc'),
        ),
      ),
    ],
  );
}

class _HomeIntroCard extends StatelessWidget {
  const _HomeIntroCard();

  @override
  Widget build(BuildContext context) {
    const darkPurple = Color(0xFF24108F);
    const brightPurple = Color(0xFF4C25DD);
    return Card(
      margin: EdgeInsets.zero,
      elevation: 4,
      shadowColor: darkPurple.withValues(alpha: .35),
      clipBehavior: Clip.antiAlias,
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [brightPurple, darkPurple],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 14, 16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 9,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .16),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: .28),
                        ),
                      ),
                      child: const Text(
                        'ƯU ĐÃI DÀNH CHO BẠN',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(height: 9),
                    Text(
                      'Đặt lịch lần đầu\n- Giảm 20%',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        height: 1.08,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Áp dụng cho dịch vụ vệ sinh và sửa chữa tại nhà.',
                      style: TextStyle(
                        color: Color(0xD9FFFFFF),
                        fontSize: 11,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 11),
                    FilledButton.icon(
                      onPressed: () => context.push('/customer/services'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: darkPurple,
                        minimumSize: const Size(0, 38),
                        padding: const EdgeInsets.symmetric(horizontal: 13),
                      ),
                      icon: const Icon(Icons.arrow_forward, size: 16),
                      label: const Text('Đặt ngay'),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 88,
                height: 116,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 82,
                      height: 82,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .13),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const Icon(
                      Icons.home_repair_service_rounded,
                      size: 64,
                      color: Color(0xFFE7E0FF),
                    ),
                    Positioned(
                      right: 1,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(7),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.local_offer_rounded,
                          size: 18,
                          color: brightPurple,
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
    );
  }
}

class _HomeSectionHeader extends StatelessWidget {
  const _HomeSectionHeader({
    required this.title,
    this.actionLabel,
    this.onAction,
  });
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        if (actionLabel != null)
          onAction == null
              ? DecoratedBox(
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    child: Text(
                      actionLabel!,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                )
              : TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    );
  }
}

class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid({required this.categories});
  final List<ServiceCategory> categories;

  @override
  Widget build(BuildContext context) {
    final visibleCategories = categories.take(7).toList();
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: visibleCategories.length + 1,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio: .82,
      ),
      itemBuilder: (context, index) => index < visibleCategories.length
          ? _CategoryCard(category: visibleCategories[index])
          : const _AllCategoryCard(),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.category});
  final ServiceCategory category;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push(
          '/customer/services?categoryId=${Uri.encodeComponent(category.id)}',
        ),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: _CategoryIcon(
                  category: category,
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                  size: 22,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                category.name,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryIcon extends StatelessWidget {
  const _CategoryIcon({required this.category, required this.color, required this.size});
  final ServiceCategory category;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final source = category.icon?.trim();
    if (_isImageSource(source)) {
      return Image.network(
        _categoryImageUrl(source!),
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => Icon(
          _categoryIcon(category.icon, category.name),
          color: color,
          size: size,
        ),
      );
    }
    return Icon(
      _categoryIcon(category.icon, category.name),
      color: color,
      size: size,
    );
  }
}

class _AllCategoryCard extends StatelessWidget {
  const _AllCategoryCard();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push('/customer/services'),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: scheme.surfaceContainerLow,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.apps_rounded,
                  color: scheme.onSurfaceVariant,
                  size: 22,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Tất cả',
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServiceHorizontalList extends StatelessWidget {
  const _ServiceHorizontalList({required this.services});
  final List<Service> services;

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty)
      return const _HomeEmpty(message: 'Chưa có dịch vụ nổi bật.');
    return SizedBox(
      height: 238,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: services.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) => _ServiceCard(service: services[index]),
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.service});
  final Service service;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 208,
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => context.push('/customer/services/${service.id}'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  _NetworkImage(
                    url: service.image,
                    height: 96,
                    width: double.infinity,
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .94),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.star_rounded, size: 14, color: Theme.of(context).colorScheme.tertiary),
                            const SizedBox(width: 3),
                            Text(
                              service.totalFeedbacks > 0 ? service.averageRating.toStringAsFixed(1) : 'Mới',
                              style: Theme.of(context).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      service.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _servicePrice(service),
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      height: 34,
                      child: FilledButton(
                        onPressed: () => context.push('/customer/bookings/new/${service.id}'),
                        child: const Text('Đặt ngay'),
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

class _ProviderList extends StatelessWidget {
  const _ProviderList({required this.providers});
  final List<FeaturedProvider> providers;

  @override
  Widget build(BuildContext context) {
    if (providers.isEmpty)
      return const _HomeEmpty(
        message: 'Chưa có nhà cung cấp phù hợp để hiển thị.',
      );
    return Column(
      children: [
        for (var index = 0; index < providers.length; index++) ...[
          _ProviderCard(provider: providers[index]),
          if (index < providers.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }
}

class _ProviderCard extends StatelessWidget {
  const _ProviderCard({required this.provider});
  final FeaturedProvider provider;

  @override
  Widget build(BuildContext context) {
    final avatarUrl = usableMediaUrl(provider.avatar);
    return SizedBox(
      width: double.infinity,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          child: Row(
            children: [
              CircleAvatar(
                radius: 25,
                backgroundImage: avatarUrl == null
                    ? null
                    : NetworkImage(avatarUrl),
                child: avatarUrl == null
                    ? const Icon(Icons.person)
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            provider.fullName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          Icons.verified,
                          size: 16,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      provider.services.isEmpty
                          ? 'Dịch vụ tại nhà'
                          : provider.services.take(2).join(' & '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                            const Icon(Icons.star, size: 15, color: AppTheme.starGold),
                        const SizedBox(width: 3),
                        Text(
                          '${provider.averageRating.toStringAsFixed(1)} (${provider.totalFeedbacks} đánh giá)',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    if (provider.workingAreas.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined, size: 14),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              provider.workingAreas.first,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ),
                        ],
                      ),
                    ],
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

class _NetworkImage extends StatelessWidget {
  const _NetworkImage({
    required this.url,
    required this.height,
    required this.width,
  });
  final String? url;
  final double height;
  final double width;

  @override
  Widget build(BuildContext context) {
    final imageUrl = usableMediaUrl(url);
    if (imageUrl == null) return _placeholder(context);
    return Image.network(
      imageUrl,
      height: height,
      width: width,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => _placeholder(context),
    );
  }

  Widget _placeholder(BuildContext context) => Container(
    height: height,
    width: width,
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: const Icon(Icons.home_repair_service_outlined),
  );
}

class _HomeEmpty extends StatelessWidget {
  const _HomeEmpty({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Text(message, textAlign: TextAlign.center),
  );
}

class CustomerOrdersTab extends StatelessWidget {
  const CustomerOrdersTab({super.key});
  @override
  Widget build(BuildContext context) => const OrderListScreen();
}

class CustomerMessagesTab extends StatelessWidget {
  const CustomerMessagesTab({super.key});
  @override
  Widget build(BuildContext context) => const ConversationListScreen();
}

class CustomerAccountTab extends ConsumerWidget {
  const CustomerAccountTab({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return const AccountOverviewScreen();
  }
}

bool _isImageSource(String? value) {
  final source = usableMediaUrl(value);
  return source != null &&
      (source.startsWith('http://') ||
          source.startsWith('https://') ||
          source.startsWith('/') ||
          source.startsWith('data:image/'));
}

String _categoryImageUrl(String value) {
  if (value.startsWith('/')) {
    return Uri.parse(AppConfig.apiBaseUrl).resolve(value).toString();
  }
  return value.replaceFirst(RegExp(r'^http://res\.cloudinary\.com', caseSensitive: false), 'https://res.cloudinary.com');
}

IconData _categoryIcon(String? icon, String name) {
  final key = (icon ?? name).trim().toLowerCase();
  return switch (key) {
    'bolt' || 'electrical' || 'electrical_services' || 'electricity' || 'dien_dan_dung' => Icons.electrical_services_outlined,
    'ac_unit' || 'air_conditioning' || 'air_vent' || 'dien_lanh' => Icons.ac_unit,
    'plumbing' || 'water' || 'water_drop' || 'nuoc_va_duong_ong' => Icons.plumbing,
    'cleaning' || 'cleaning_services' || 'spray_cleaning' || 've_sinh_nha_cua' => Icons.cleaning_services_outlined,
    'home_repair_service' || 'home_repair' || 'appliance_repair' || 'sua_chua_gia_dung' => Icons.home_repair_service_outlined,
    'water_damage' => Icons.water_damage_outlined,
    'handyman' => Icons.handyman_outlined,
    'local_laundry_service' || 'laundry' => Icons.local_laundry_service,
    'format_paint' || 'painting' => Icons.format_paint,
    _ => Icons.category_outlined,
  };
}

String _servicePrice(Service service) {
  final price = service.fixedPrice ?? service.minOptionPrice;
  if (price == null) return 'Liên hệ để biết giá';
  return 'Từ ${price.toStringAsFixed(0)}đ';
}
