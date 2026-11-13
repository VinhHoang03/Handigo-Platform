import '../../../shared/widgets/linked_provider_avatar.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/widgets/app_search_field.dart';
import 'dart:async';
import '../../../core/network/realtime_connection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../../auth/domain/app_user.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../shared/widgets/customer_page_header.dart';
import '../../../core/network/paged_result.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_feedback.dart';
import '../data/chat_repository.dart';
import '../domain/chat_models.dart';

final chatRepositoryProvider = Provider<ChatRepository>(
  (ref) => ChatRepository(ref.watch(apiClientProvider)),
);
final conversationListProvider = FutureProvider.autoDispose(
  (ref) => ref
      .watch(chatRepositoryProvider)
      .conversations(currentUserId: ref.watch(authControllerProvider).user?.id),
);
final _orderConversationProvider = FutureProvider.autoDispose
    .family<Conversation, String>(
      (ref, orderId) =>
          ref.watch(chatRepositoryProvider).conversationForOrder(orderId),
    );
final _chatMessagesProvider = FutureProvider.autoDispose
    .family<PagedResult<ChatMessage>, String>((ref, conversationId) {
      final user = ref.watch(authControllerProvider).user;
      if (user == null) throw const ApiException('Vui lòng đăng nhập lại.');
      return ref
          .watch(chatRepositoryProvider)
          .messages(conversationId, user.id);
    });

class ConversationListScreen extends ConsumerStatefulWidget {
  const ConversationListScreen({super.key});
  @override
  ConsumerState<ConversationListScreen> createState() =>
      _ConversationListScreenState();
}

class _ConversationListScreenState
    extends ConsumerState<ConversationListScreen> {
  final _searchController = TextEditingController();
  String _selectedFilter = 'ALL';
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(conversationListProvider);
    final isProvider =
        ref.watch(authControllerProvider).user?.role == UserRole.provider;
    return Scaffold(
      appBar: CustomerPageHeader(
        toolbarHeight: 64 * MediaQuery.textScalerOf(context).scale(1),
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerLowest,
        showBottomBorder: true,
        title: 'Đoạn chat',
        centerTitle: false,
        leading: isProvider
            ? IconButton(
                tooltip: 'Quay lại',
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/provider');
                  }
                },
                icon: const Icon(Icons.arrow_back_rounded),
              )
            : const Center(child: CustomerHeaderIcon(Icons.forum_outlined)),
      ),
      body: state.when(
        loading: () => const AppLoading(),
        error: (_, _) => AppMessage(
          message: 'Không thể tải cuộc trò chuyện.',
          onRetry: () => ref.invalidate(conversationListProvider),
        ),
        data: (page) {
          final query = _query.trim().toLowerCase();
          final filtered = page.items.where((item) {
            final matchesFilter =
                _selectedFilter == 'ALL' ||
                (_selectedFilter == 'ORDER' && item.orderCode.isNotEmpty) ||
                (_selectedFilter == 'SUPPORT' && item.orderCode.isEmpty);
            final matchesQuery =
                query.isEmpty ||
                item.title.toLowerCase().contains(query) ||
                item.orderCode.toLowerCase().contains(query) ||
                (item.lastMessage ?? '').toLowerCase().contains(query);
            return matchesFilter && matchesQuery;
          }).toList();
          return RefreshIndicator(
            onRefresh: () => ref.refresh(conversationListProvider.future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 24),
              children: [
                AppSearchField(
                  controller: _searchController,
                  onChanged: (value) => setState(() => _query = value),
                  hintText: 'Tìm tên thợ, mã đơn, dịch vụ...',
                  suffixIcon: _query.isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Xóa nội dung tìm kiếm',
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _query = '');
                          },
                          icon: const Icon(Icons.close_rounded),
                        ),
                ),
                const SizedBox(height: 10),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _ChatFilterChip(
                        label: 'Tất cả',
                        value: 'ALL',
                        selected: _selectedFilter,
                        onSelected: _selectFilter,
                      ),
                      _ChatFilterChip(
                        label: 'Đơn hàng',
                        value: 'ORDER',
                        selected: _selectedFilter,
                        onSelected: _selectFilter,
                      ),
                      _ChatFilterChip(
                        label: 'Hỗ trợ',
                        value: 'SUPPORT',
                        selected: _selectedFilter,
                        onSelected: _selectFilter,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                if (page.items.isEmpty)
                  const AppMessage(
                    icon: Icons.forum_outlined,
                    message: 'Bạn chưa có cuộc trò chuyện nào.',
                  )
                else if (filtered.isEmpty)
                  AppMessage(
                    icon: Icons.search_off_rounded,
                    message: 'Không tìm thấy cuộc trò chuyện phù hợp.',
                    action: OutlinedButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() {
                          _query = '';
                          _selectedFilter = 'ALL';
                        });
                      },
                      child: const Text('Xóa bộ lọc'),
                    ),
                  )
                else
                  ...filtered.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _ConversationCard(
                        item: item,
                        currentUserId: ref
                            .read(authControllerProvider)
                            .user
                            ?.id,
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ChatScreen(
                              conversationId: item.id,
                              title: item.title,
                              providerId: item.providerId,
                              avatar: item.avatar,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _selectFilter(String value) => setState(() => _selectedFilter = value);
}

class _ChatFilterChip extends StatelessWidget {
  const _ChatFilterChip({
    required this.label,
    required this.value,
    required this.selected,
    required this.onSelected,
  });
  final String label, value, selected;
  final ValueChanged<String> onSelected;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(
      label: Text(label),
      selected: selected == value,
      onSelected: (_) => onSelected(value),
    ),
  );
}

class _ConversationCard extends StatelessWidget {
  const _ConversationCard({
    required this.item,
    required this.currentUserId,
    required this.onTap,
  });
  final Conversation item;
  final String? currentUserId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final avatarUrl = usableMediaUrl(item.avatar);
    final isUnread =
        item.lastMessage != null && item.lastMessageSenderId != currentUserId;
    final isMine =
        currentUserId != null && item.lastMessageSenderId == currentUserId;
    final preview = item.lastMessage == null
        ? 'Chưa có tin nhắn'
        : isMine
        ? 'Bạn: ${item.lastMessage}'
        : item.lastMessage!;
    return Card(
      color: theme.colorScheme.surfaceContainerLowest,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: theme.brightness == Brightness.light
              ? const Color(0xFFDDDCE5)
              : theme.colorScheme.outlineVariant,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox.square(
                dimension: 48,
                child: ClipOval(
                  child: avatarUrl == null
                      ? ColoredBox(
                          color: theme.colorScheme.primaryContainer,
                          child: Icon(
                            Icons.person_outline,
                            color: theme.colorScheme.onPrimaryContainer,
                          ),
                        )
                      : Image.network(
                          avatarUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => ColoredBox(
                            color: theme.colorScheme.primaryContainer,
                            child: Icon(
                              Icons.person_outline,
                              color: theme.colorScheme.onPrimaryContainer,
                            ),
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      preview,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        height: 1.4,
                        fontWeight: isUnread
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                    if (item.orderCode.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(
                            Icons.verified,
                            size: 12,
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              '#${item.orderCode}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (isUnread) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.primary,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '1',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                    ],
                    Text(
                      _chatTime(item.lastMessageAt ?? item.updatedAt),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.primary,
                        height: 1.4,
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

String _chatTime(DateTime? value) {
  if (value == null) return '';
  final local = value.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({
    required this.conversationId,
    this.title = 'Tin nhắn',
    this.providerId,
    this.avatar,
    super.key,
  });
  final String conversationId, title;
  final String? providerId, avatar;
  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class ChatByOrderScreen extends ConsumerWidget {
  const ChatByOrderScreen({required this.orderId, super.key});
  final String orderId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final extra = GoRouterState.of(context).extra;
    final provider = _orderConversationProvider(orderId);
    final state = extra is Conversation
        ? AsyncData(extra)
        : ref.watch(provider);

    final conversation = state.asData?.value;
    if (conversation != null) {
      return ChatScreen(
        key: ValueKey(conversation.id),
        conversationId: conversation.id,
        title: conversation.title,
        providerId: conversation.providerId,
        avatar: conversation.avatar,
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Tin nhắn')),
      body: state.isLoading
          ? const AppLoading()
          : AppMessage(
              message: 'Không thể mở cuộc trò chuyện của đơn hàng này.',
              onRetry: () => ref.invalidate(provider),
            ),
    );
  }
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final input = TextEditingController();
  bool sending = false;
  bool? _canSend;
  bool _availabilityFailed = false;
  int _availabilityRequest = 0;
  Timer? _availabilityTimer;
  AppLifecycleListener? _lifecycleListener;
  StreamSubscription<dynamic>? realtime;
  @override
  void initState() {
    super.initState();
    _seen();
    unawaited(_refreshAvailability());
    _lifecycleListener = AppLifecycleListener(onResume: _refreshAvailability);
    _availabilityTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      final lifecycle = WidgetsBinding.instance.lifecycleState;
      if ((lifecycle == null || lifecycle == AppLifecycleState.resumed) &&
          ModalRoute.of(context)?.isCurrent == true) {
        unawaited(_refreshAvailability());
      }
    });
    Future.microtask(() {
      if (!mounted) return;
      final connection = ref.read(realtimeConnectionProvider);
      void join() => connection?.emit('conversation:join', {
        'conversationId': widget.conversationId,
      });
      join();
      realtime = connection?.events.listen((event) {
        if (event.name == 'connect') {
          join();
          unawaited(_refreshAvailability());
        }
        if (event.name == 'order:updated') {
          unawaited(_refreshAvailability());
        }
        if (event.name == 'message:new' || event.name == 'message:seen') {
          if (mounted) {
            ref.invalidate(_chatMessagesProvider(widget.conversationId));
            ref.invalidate(conversationListProvider);
          }
        }
      });
    });
  }

  Future<void> _refreshAvailability() async {
    final request = ++_availabilityRequest;
    bool? canSend;
    try {
      canSend = await ref
          .read(chatRepositoryProvider)
          .canSend(widget.conversationId);
    } catch (_) {
      // Chỉ hiện khung soạn khi máy chủ đã xác nhận quyền gửi.
    }
    if (mounted &&
        request == _availabilityRequest &&
        (canSend != _canSend || _availabilityFailed != (canSend == null))) {
      setState(() {
        _canSend = canSend;
        _availabilityFailed = canSend == null;
      });
    }
  }

  Future<void> _seen() async {
    try {
      await ref.read(chatRepositoryProvider).seen(widget.conversationId);
    } on ApiException {
      // Người dùng vẫn xem được tin nhắn khi thao tác đánh dấu đã đọc gặp lỗi.
    }
  }

  @override
  void dispose() {
    _availabilityTimer?.cancel();
    _lifecycleListener?.dispose();
    realtime?.cancel();
    input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final messagesProvider = _chatMessagesProvider(widget.conversationId);
    final messageState = ref.watch(messagesProvider);
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            if (ref.watch(authControllerProvider).user?.role ==
                    UserRole.customer &&
                widget.providerId?.isNotEmpty == true)
              LinkedProviderAvatar(
                name: widget.title,
                providerId: widget.providerId,
                url: widget.avatar,
                size: 36,
              )
            else
              CircleAvatar(
                radius: 16,
                backgroundColor: scheme.primaryContainer,
                foregroundColor: scheme.onPrimaryContainer,
                child: const Icon(Icons.person, size: 18),
              ),
            const SizedBox(width: 9),
            Expanded(
              child: Text(
                widget.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: messageState.when(
              skipLoadingOnRefresh: messageState.hasValue,
              loading: () => const AppLoading(),
              error: (_, _) => AppMessage(
                message: 'Không thể tải tin nhắn.',
                onRetry: () => ref.invalidate(messagesProvider),
              ),
              data: (page) {
                final messages = page.items;
                if (messages.isEmpty) {
                  return AppMessage(
                    icon: Icons.forum_outlined,
                    message: _canSend == true
                        ? 'Chưa có tin nhắn. Hãy gửi lời chào để bắt đầu.'
                        : 'Cuộc trò chuyện chưa có tin nhắn.',
                  );
                }
                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                  itemCount: messages.length,
                  itemBuilder: (_, index) {
                    final message = messages[messages.length - 1 - index];
                    final avatarUrl = usableMediaUrl(message.senderAvatar);
                    return Align(
                      alignment: message.isMine
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            if (!message.isMine) ...[
                              SizedBox.square(
                                dimension: 32,
                                child: ClipOval(
                                  child: ColoredBox(
                                    color: scheme.primaryContainer,
                                    child: avatarUrl == null
                                        ? Icon(
                                            Icons.person_outline,
                                            size: 20,
                                            color: scheme.onPrimaryContainer,
                                          )
                                        : Image.network(
                                            avatarUrl,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, _, _) => Icon(
                                              Icons.person_outline,
                                              size: 20,
                                              color: scheme.onPrimaryContainer,
                                            ),
                                          ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Flexible(
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 10,
                                ),
                                constraints: BoxConstraints(
                                  maxWidth:
                                      MediaQuery.sizeOf(context).width * .78,
                                ),
                                decoration: BoxDecoration(
                                  color: message.isMine
                                      ? scheme.primary
                                      : scheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.only(
                                    topLeft: const Radius.circular(18),
                                    topRight: const Radius.circular(18),
                                    bottomLeft: Radius.circular(
                                      message.isMine ? 18 : 4,
                                    ),
                                    bottomRight: Radius.circular(
                                      message.isMine ? 4 : 18,
                                    ),
                                  ),
                                ),
                                child: Text(
                                  message.content,
                                  style: TextStyle(
                                    color: message.isMine
                                        ? scheme.onPrimary
                                        : scheme.onSurface,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          if (_canSend == true)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: input,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        decoration: const InputDecoration(
                          labelText: 'Tin nhắn',
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    ValueListenableBuilder<TextEditingValue>(
                      valueListenable: input,
                      builder: (_, draft, _) => IconButton.filled(
                        tooltip: sending ? 'Đang gửi tin nhắn' : 'Gửi tin nhắn',
                        onPressed: sending || draft.text.trim().isEmpty
                            ? null
                            : _send,
                        icon: sending
                            ? const SizedBox.square(
                                dimension: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.send_rounded),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  _canSend == false
                      ? 'Đơn đã kết thúc.'
                      : _availabilityFailed
                      ? 'Không thể xác minh quyền gửi tin nhắn. Hệ thống sẽ thử lại.'
                      : 'Đang xác minh quyền gửi tin nhắn.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _send() async {
    final draft = input.text;
    final content = draft.trim();
    if (_canSend != true || sending || content.isEmpty) return;
    setState(() => sending = true);
    try {
      await ref
          .read(chatRepositoryProvider)
          .send(widget.conversationId, content);
      if (!mounted) return;
      if (input.text == draft) input.clear();
      ref.invalidate(_chatMessagesProvider(widget.conversationId));
      ref.invalidate(conversationListProvider);
    } catch (error) {
      if (!mounted) return;
      if (error is ApiException && error.code == 'CHAT_ORDER_INACTIVE') {
        setState(() {
          _canSend = false;
          _availabilityFailed = false;
        });
        unawaited(_refreshAvailability());
      }
      AppToast.show(
        context,
        error is ApiException
            ? error.message
            : 'Không thể gửi tin nhắn. Vui lòng thử lại.',
      );
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }
}
