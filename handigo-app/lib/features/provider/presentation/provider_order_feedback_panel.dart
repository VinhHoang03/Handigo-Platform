import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';

final providerOrderFeedbackProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>?, String>((ref, id) async {
      final response = await ref
          .watch(apiClientProvider)
          .request('/feedback/provider/orders/$id', authenticated: true);
      return response['data'] as Map<String, dynamic>?;
    });

class ProviderOrderFeedbackPanel extends ConsumerStatefulWidget {
  const ProviderOrderFeedbackPanel({required this.orderId, super.key});
  final String orderId;
  @override
  ConsumerState<ProviderOrderFeedbackPanel> createState() =>
      _ProviderOrderFeedbackPanelState();
}

class _ProviderOrderFeedbackPanelState
    extends ConsumerState<ProviderOrderFeedbackPanel> {
  final reply = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    reply.dispose();
    super.dispose();
  }

  Future<void> save(String id) async {
    if (busy || reply.text.trim().isEmpty) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref
          .read(apiClientProvider)
          .request(
            '/feedback/$id/reply',
            method: 'PUT',
            authenticated: true,
            data: {'content': reply.text.trim()},
          );
      ref.invalidate(providerOrderFeedbackProvider(widget.orderId));
      reply.clear();
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể gửi phản hồi.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: ref
          .watch(providerOrderFeedbackProvider(widget.orderId))
          .when(
            loading: () => const LinearProgressIndicator(),
            error: (_, stack) => TextButton(
              onPressed: () =>
                  ref.invalidate(providerOrderFeedbackProvider(widget.orderId)),
              child: const Text('Tải lại đánh giá đơn hàng'),
            ),
            data: (feedback) => feedback == null
                ? const Text('Khách hàng chưa đánh giá đơn này.')
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Khách hàng đánh giá ${feedback['rating']}/5 sao',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text('${feedback['comment'] ?? ''}'),
                      if (feedback['providerReply'] is Map)
                        Text(
                          'Phản hồi của bạn: ${(feedback['providerReply'] as Map)['content']}',
                        ),
                      if (error != null) Text(error!),
                      TextField(
                        controller: reply,
                        enabled: !busy,
                        minLines: 2,
                        maxLines: 5,
                        maxLength: 1000,
                        decoration: const InputDecoration(
                          labelText: 'Phản hồi khách hàng',
                        ),
                      ),
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () =>
                                  save('${feedback['_id'] ?? feedback['id']}'),
                        child: Text(busy ? 'Đang gửi...' : 'Gửi phản hồi'),
                      ),
                    ],
                  ),
          ),
    ),
  );
}
