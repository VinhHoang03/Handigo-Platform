import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../../../shared/utils/media_url.dart';
import '../../../shared/widgets/app_states.dart';
import '../../../core/network/paged_result.dart';
import '../data/chat_repository.dart';
import '../domain/chat_models.dart';

final chatRepositoryProvider = Provider<ChatRepository>(
  (ref) => ChatRepository(ref.watch(apiClientProvider)),
);
final conversationListProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(chatRepositoryProvider).conversations(
    currentUserId: ref.watch(authControllerProvider).user?.id,
  ),
);

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
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 12,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: scheme.surfaceContainerLow,
              foregroundColor: scheme.primary,
              child: const Icon(Icons.forum_rounded, size: 19),
            ),
            const SizedBox(width: 9),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [const Text('Đoạn chat')],
            ),
          ],
        ),
      ),
      body: state.when(
        loading: () => const AppLoading(),
        error: (_, __) => AppMessage(
          message: 'Không thể tải cuộc trò chuyện.',
          onRetry: () => ref.invalidate(conversationListProvider),
        ),
        data: (page) {
          final filtered = page.items.where((item) {
            final matchesFilter = _selectedFilter == 'ALL' ||
                (_selectedFilter == 'ORDER' && item.orderCode.isNotEmpty) ||
                (_selectedFilter == 'SUPPORT' && item.orderCode.isEmpty);
            final query = _query.trim().toLowerCase();
            final matchesQuery = query.isEmpty ||
                item.title.toLowerCase().contains(query) ||
                item.orderCode.toLowerCase().contains(query) ||
                (item.lastMessage ?? '').toLowerCase().contains(query);
            return matchesFilter && matchesQuery;
          }).toList();
          return RefreshIndicator(
            onRefresh: () => ref.refresh(conversationListProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 24),
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: (value) => setState(() => _query = value),
                  decoration: InputDecoration(
                    hintText: 'Tìm tên thợ, mã đơn, dịch vụ...',
                    prefixIcon: const Icon(Icons.search, size: 19),
                    suffixIcon: Icon(Icons.tune, color: scheme.onSurfaceVariant),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 38,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      _ChatFilterChip(label: 'Tất cả', value: 'ALL', selected: _selectedFilter, onSelected: _selectFilter),
                      _ChatFilterChip(label: 'Đơn hàng', value: 'ORDER', selected: _selectedFilter, onSelected: _selectFilter),
                      _ChatFilterChip(label: 'Hỗ trợ', value: 'SUPPORT', selected: _selectedFilter, onSelected: _selectFilter),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                if (page.items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 36),
                    child: Center(child: Text('Bạn chưa có cuộc trò chuyện nào.')),
                  )
                else if (filtered.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 36),
                    child: Center(child: Text('Không tìm thấy cuộc trò chuyện phù hợp.')),
                  )
                else
                  ...filtered.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _ConversationCard(
                      item: item,
                      currentUserId: ref.read(authControllerProvider).user?.id,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ChatScreen(
                            conversationId: item.id,
                            title: item.title,
                          ),
                        ),
                      ),
                    ),
                  )),
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
  const _ChatFilterChip({required this.label, required this.value, required this.selected, required this.onSelected});
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
  const _ConversationCard({required this.item, required this.currentUserId, required this.onTap});
  final Conversation item;
  final String? currentUserId;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final avatarUrl = usableMediaUrl(item.avatar);
    final isUnread = item.lastMessage != null && item.lastMessageSenderId != currentUserId;
    return Card(
      color: isUnread ? theme.colorScheme.surfaceContainerLow : theme.colorScheme.surfaceContainerLowest,
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 12, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: avatarUrl == null
                    ? Container(
                        width: 44,
                        height: 44,
                        color: theme.colorScheme.primaryContainer,
                        alignment: Alignment.center,
                        child: Icon(
                          Icons.person_outline,
                          color: theme.colorScheme.onPrimaryContainer,
                        ),
                      )
                    : Image.network(
                        avatarUrl,
                        width: 44,
                        height: 44,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 44,
                          height: 44,
                          color: theme.colorScheme.primaryContainer,
                          alignment: Alignment.center,
                          child: Icon(
                            Icons.person_outline,
                            color: theme.colorScheme.onPrimaryContainer,
                          ),
                        ),
                      ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                        ),
                        if (isUnread)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                            decoration: BoxDecoration(color: theme.colorScheme.secondaryContainer, borderRadius: BorderRadius.circular(999)),
                            child: Text('1', style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSecondaryContainer, fontWeight: FontWeight.w800)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        if (item.orderCode.isNotEmpty) ...[
                          Icon(Icons.verified, size: 14, color: theme.colorScheme.primary),
                          const SizedBox(width: 4),
                          Expanded(child: Text('#${item.orderCode}', maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant))),
                        ] else
                          const Spacer(),
                        Text(_chatTime(item.lastMessageAt ?? item.updatedAt), style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.primary)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(item.lastMessage ?? 'Chưa có tin nhắn', maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall?.copyWith(fontWeight: isUnread ? FontWeight.w600 : FontWeight.w400)),
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
    super.key,
  });
  final String conversationId, title;
  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class ChatByOrderScreen extends ConsumerWidget {
  const ChatByOrderScreen({required this.orderId, super.key});
  final String orderId;
  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      FutureBuilder<Conversation>(
        future: ref.read(chatRepositoryProvider).conversationForOrder(orderId),
        builder: (_, snapshot) => snapshot.hasData
            ? ChatScreen(
                conversationId: snapshot.data!.id,
                title: snapshot.data!.title,
              )
            : Scaffold(
                appBar: AppBar(title: const Text('Tin nhắn')),
                body: snapshot.hasError
                    ? const AppMessage(message: 'Đơn hàng chưa thể trò chuyện.')
                    : const AppLoading(),
              ),
      );
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final input = TextEditingController();
  bool sending = false;
  @override
  void initState() {
    super.initState();
    _seen();
  }

  Future<void> _seen() =>
      ref.read(chatRepositoryProvider).seen(widget.conversationId);
  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).user;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
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
        actions: [
          IconButton(
            onPressed: null,
            icon: const Icon(Icons.phone_outlined),
            tooltip: 'Gọi điện',
          ),
          IconButton(
            onPressed: null,
            icon: const Icon(Icons.more_vert),
            tooltip: 'Tùy chọn',
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(12, 10, 12, 4),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: scheme.secondaryContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.receipt_long_outlined,
                  size: 18,
                  color: scheme.onSecondaryContainer,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Trao đổi về đơn dịch vụ',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: scheme.onSecondaryContainer,
                    ),
                  ),
                ),
                const Icon(Icons.chevron_right, size: 18),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder<PagedResult<ChatMessage>>(
              future: ref
                  .read(chatRepositoryProvider)
                  .messages(widget.conversationId, user!.id),
              builder: (_, snapshot) {
                if (!snapshot.hasData)
                  return snapshot.hasError
                      ? const AppMessage(message: 'Không thể tải tin nhắn.')
                      : const AppLoading();
                final messages = snapshot.data!.items;
                return ListView.builder(
                  reverse: false,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
                  itemCount: messages.length,
                  itemBuilder: (_, index) {
                    final message = messages[index];
                    return Align(
                      alignment: message.isMine
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 10,
                        ),
                        constraints: BoxConstraints(
                          maxWidth: MediaQuery.sizeOf(context).width * .78,
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
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: null,
                    icon: const Icon(Icons.add_circle_outline),
                    tooltip: 'Đính kèm',
                  ),
                  Expanded(
                    child: TextField(
                      controller: input,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'Nhập tin nhắn...',
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.filled(
                    onPressed: sending ? null : _send,
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _send() async {
    final content = input.text.trim();
    if (content.isEmpty) return;
    setState(() => sending = true);
    try {
      await ref
          .read(chatRepositoryProvider)
          .send(widget.conversationId, content);
      input.clear();
      setState(() {});
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }
}
