import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/network/api_exception.dart';
import 'ai_chat_controller.dart';

class AiChatHistory extends StatefulWidget {
  const AiChatHistory({
    required this.controller,
    required this.onSelected,
    super.key,
  });
  final AiChatController controller;
  final ValueChanged<String> onSelected;
  @override
  State<AiChatHistory> createState() => _AiChatHistoryState();
}

class _AiChatHistoryState extends State<AiChatHistory> {
  int _page = 1;
  late Future<Map<String, dynamic>> _history;
  @override
  void initState() {
    super.initState();
    _history = widget.controller.history(_page);
  }

  void _load(int page) => setState(() {
    _page = page;
    _history = widget.controller.history(page);
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return FutureBuilder<Map<String, dynamic>>(
      future: _history,
      builder: (context, snapshot) {
        final loading = snapshot.connectionState != ConnectionState.done;
        final items = (snapshot.data?['items'] as List? ?? [])
            .whereType<Map>()
            .toList();
        final pages =
            (snapshot.data?['pagination'] as Map?)?['totalPages'] as int? ?? 0;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'LỊCH SỬ',
              style: TextStyle(fontSize: 12, color: scheme.primary),
            ),
            const SizedBox(height: 4),
            Text(
              'Cuộc trò chuyện của bạn',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            const Text('Mở lại cuộc trò chuyện để tiếp tục yêu cầu.'),
            const SizedBox(height: 20),
            if (widget.controller.error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  widget.controller.error!,
                  style: TextStyle(color: scheme.error),
                ),
              ),
            if (loading)
              const Center(child: CircularProgressIndicator())
            else if (snapshot.hasError) ...[
              Text(
                snapshot.error is ApiException
                    ? (snapshot.error as ApiException).message
                    : 'Chưa tải được lịch sử trò chuyện.',
              ),
              TextButton(
                onPressed: () => _load(_page),
                child: const Text('Thử lại'),
              ),
            ] else if (items.isEmpty)
              const Text('Chưa có cuộc trò chuyện nào.')
            else ...[
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Card(
                    margin: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(
                        color: item['sessionId'] == widget.controller.sessionId
                            ? scheme.primary.withValues(alpha: .45)
                            : scheme.outlineVariant.withValues(alpha: .4),
                      ),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      leading: Icon(
                        Icons.chat_bubble_outline_rounded,
                        color: scheme.primary,
                      ),
                      title: Text(
                        '${item['title'] ?? 'Cuộc trò chuyện mới'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (DateTime.tryParse('${item['updatedAt']}')
                              case final date?)
                            Text(
                              DateFormat(
                                'dd/MM/yyyy HH:mm',
                              ).format(date.toLocal()),
                            ),
                          if (item['needsAttention'] == true)
                            Text(
                              'Có thao tác cần xử lý',
                              style: TextStyle(color: scheme.primary),
                            ),
                        ],
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap:
                          widget.controller.canSwitchSession &&
                              item['sessionId'] is String
                          ? () => widget.onSelected(item['sessionId'] as String)
                          : null,
                    ),
                  ),
                ),
              if (pages > 1)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      tooltip: 'Trang trước',
                      onPressed: _page > 1 ? () => _load(_page - 1) : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('Trang $_page/$pages'),
                    IconButton(
                      tooltip: 'Trang sau',
                      onPressed: _page < pages ? () => _load(_page + 1) : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
            ],
          ],
        );
      },
    );
  }
}
