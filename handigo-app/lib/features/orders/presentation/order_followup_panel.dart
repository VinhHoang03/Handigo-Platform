import '../../../shared/widgets/rating_stars.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../../../app/providers/app_providers.dart';
import '../../../core/network/api_exception.dart';
import '../domain/order_summary.dart';
import 'order_screens.dart';

final recurringOrdersProvider = FutureProvider.autoDispose
    .family<List<OrderSummary>, String>(
      (ref, id) => ref.watch(orderRepositoryProvider).series(id),
    );
final orderFeedbackContextProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>(
      (ref, id) async =>
          (await ref
                  .watch(apiClientProvider)
                  .request(
                    '/feedback/orders/$id/context',
                    authenticated: true,
                  ))['data']
              as Map<String, dynamic>,
    );

Future<void> showOrderReport(BuildContext context, OrderDetail order) async {
  await Navigator.push<bool>(
    context,
    MaterialPageRoute(
      builder: (_) => _OrderResponseScreen(order: order, report: true),
    ),
  );
}

class OrderFollowupPanel extends ConsumerStatefulWidget {
  const OrderFollowupPanel({required this.order, super.key});
  final OrderDetail order;
  @override
  ConsumerState<OrderFollowupPanel> createState() => _OrderFollowupPanelState();
}

class _OrderFollowupPanelState extends ConsumerState<OrderFollowupPanel> {
  bool busy = false;
  String? error;

  Future<void> respond(bool accept) async {
    if (busy) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tìm chuyên gia thay thế'),
        content: Text(
          accept
              ? 'Đồng ý để Handigo tìm chuyên gia thay thế cho đơn này?'
              : 'Từ chối tìm thợ thay thế? Hệ thống sẽ xử lý đơn và tiền hoàn theo chính sách hiện tại.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Quay lại'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref
          .read(orderRepositoryProvider)
          .respondToReassignment(widget.order.id, accept);
      ref.invalidate(orderDetailProvider(widget.order.id));
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể cập nhật lựa chọn.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> chooseReplacement() async {
    if (busy ||
        widget.order.serviceId == null ||
        widget.order.addressId == null)
      return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final order = widget.order;
      final providers = await ref
          .read(serviceCatalogRepositoryProvider)
          .nearbyProviders({
            'serviceId': order.serviceId,
            'addressId': order.addressId,
            'orderId': order.id,
            if (order.scheduledAt != null)
              'scheduledAt': order.scheduledAt!.toUtc().toIso8601String(),
          });
      if (!mounted) return;
      final id = await showModalBottomSheet<String>(
        useRootNavigator: true,
        context: context,
        builder: (context) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              const ListTile(title: Text('Chọn chuyên gia thay thế')),
              if (providers.isEmpty)
                const ListTile(
                  title: Text(
                    'Chưa tìm thấy chuyên gia phù hợp. Vui lòng thử lại sau.',
                  ),
                ),
              for (final provider in providers)
                ListTile(
                  title: Text(
                    '${(provider['user'] as Map?)?['fullName'] ?? 'Chuyên gia'}',
                  ),
                  onTap: () => Navigator.pop(context, '${provider['id']}'),
                ),
            ],
          ),
        ),
      );
      if (id == null) return;
      await ref.read(orderRepositoryProvider).selectReplacement(order.id, id);
      ref.invalidate(orderDetailProvider(order.id));
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể chọn chuyên gia thay thế.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> openForm({
    Map<String, dynamic>? feedback,
    bool report = false,
  }) async {
    final saved = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => _OrderResponseScreen(
          order: widget.order,
          feedback: feedback,
          report: report,
        ),
      ),
    );
    if (saved == true)
      ref.invalidate(orderFeedbackContextProvider(widget.order.id));
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (error != null &&
            order.reassignment['status'] != 'awaiting_customer')
          Text(
            error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        if (order.status == 'created' &&
            (order.bookingStatus == 'rejected' ||
                order.reassignment['status'] == 'awaiting_customer'))
          OutlinedButton.icon(
            onPressed: busy ? null : chooseReplacement,
            icon: const Icon(Icons.person_search_outlined),
            label: const Text('Chọn chuyên gia thay thế'),
          ),
        if (order.reassignment['status'] == 'awaiting_customer')
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Chuyên gia chưa thể tiếp tục. Bạn có muốn tìm chuyên gia thay thế?',
                  ),
                  if (error != null) Text(error!),
                  FilledButton(
                    onPressed: busy ? null : () => respond(true),
                    child: const Text('Đồng ý tìm thợ thay thế'),
                  ),
                  TextButton(
                    onPressed: busy ? null : () => respond(false),
                    child: const Text('Từ chối và xử lý hoàn tiền'),
                  ),
                ],
              ),
            ),
          ),
        if (order.recurringGroupId != null)
          Card(
            child: ExpansionTile(
              title: const Text('Các buổi trong chuỗi lịch'),
              children: [
                ref
                    .watch(recurringOrdersProvider(order.id))
                    .when(
                      loading: () => const LinearProgressIndicator(),
                      error: (_, stack) => TextButton(
                        onPressed: () =>
                            ref.invalidate(recurringOrdersProvider(order.id)),
                        child: const Text('Tải lại chuỗi lịch'),
                      ),
                      data: (items) => Column(
                        children: [
                          for (final item in items)
                            ListTile(
                              title: Text(item.code),
                              subtitle: Text(orderStatusLabel(item.status)),
                              onTap: () =>
                                  context.push('/customer/orders/${item.id}'),
                            ),
                        ],
                      ),
                    ),
              ],
            ),
          ),
        if (order.status == 'completed')
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: ref
                  .watch(orderFeedbackContextProvider(order.id))
                  .when(
                    loading: () => const LinearProgressIndicator(),
                    error: (_, stack) => TextButton(
                      onPressed: () => ref.invalidate(
                        orderFeedbackContextProvider(order.id),
                      ),
                      child: const Text('Tải lại đánh giá'),
                    ),
                    data: (data) {
                      final feedback = data['feedback'] is Map<String, dynamic>
                          ? data['feedback'] as Map<String, dynamic>
                          : null;
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Đánh giá dịch vụ',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          if (feedback != null) ...[
                            Text(
                              '${formatRating(feedback['rating'] as num)} / 5 sao',
                            ),
                            Text('${feedback['comment'] ?? ''}'),
                            if (feedback['providerReply'] is Map)
                              Text(
                                'Phản hồi của chuyên gia: ${(feedback['providerReply'] as Map)['content']}',
                              ),
                          ],
                          if (data['canReview'] == true)
                            if (feedback == null)
                              _InlineOrderReview(orderId: order.id)
                            else
                              OutlinedButton(
                                onPressed: () => openForm(feedback: feedback),
                                child: const Text('Chỉnh sửa đánh giá'),
                              )
                          else
                            Text(
                              '${data['reason'] ?? 'Đơn chưa đủ điều kiện đánh giá.'}',
                            ),
                        ],
                      );
                    },
                  ),
            ),
          ),
      ],
    );
  }
}

class _InlineOrderReview extends ConsumerStatefulWidget {
  const _InlineOrderReview({required this.orderId});
  final String orderId;

  @override
  ConsumerState<_InlineOrderReview> createState() => _InlineOrderReviewState();
}

class _InlineOrderReviewState extends ConsumerState<_InlineOrderReview> {
  final comment = TextEditingController();
  double rating = 0;
  bool sending = false;
  bool sent = false;
  String? error;

  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (sending || sent || rating == 0) return;
    setState(() {
      sending = true;
      error = null;
    });
    try {
      await ref
          .read(apiClientProvider)
          .request(
            '/feedback',
            method: 'POST',
            authenticated: true,
            data: {
              'orderId': widget.orderId,
              'rating': rating,
              'comment': comment.text.trim(),
              'images': <String>[],
            },
          );
      if (!mounted) return;
      setState(() => sent = true);
      ref.invalidate(orderFeedbackContextProvider(widget.orderId));
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể gửi đánh giá. Nội dung đã nhập được giữ lại.',
        );
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const SizedBox(height: 8),
      RatingStars(
        value: rating,
        onChanged: sending || sent
            ? null
            : (value) => setState(() => rating = value),
      ),
      if (rating > 0)
        Text(
          '${formatRating(rating)} / 5 sao',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      if (rating > 0) ...[
        const SizedBox(height: 8),
        TextField(
          controller: comment,
          enabled: !sending && !sent,
          minLines: 2,
          maxLines: 5,
          maxLength: 1000,
          decoration: const InputDecoration(
            labelText: 'Nhận xét (không bắt buộc)',
            hintText: 'Chia sẻ thêm trải nghiệm của bạn...',
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        FilledButton(
          onPressed: sending || sent ? null : submit,
          child: Text(
            sending
                ? 'Đang gửi...'
                : sent
                ? 'Đã gửi đánh giá'
                : 'Gửi đánh giá',
          ),
        ),
      ],
    ],
  );
}

class _OrderResponseScreen extends ConsumerStatefulWidget {
  const _OrderResponseScreen({
    required this.order,
    this.feedback,
    required this.report,
  });
  final OrderDetail order;
  final Map<String, dynamic>? feedback;
  final bool report;
  @override
  ConsumerState<_OrderResponseScreen> createState() =>
      _OrderResponseScreenState();
}

class _OrderResponseScreenState extends ConsumerState<_OrderResponseScreen> {
  final form = GlobalKey<FormState>();
  final title = TextEditingController();
  late final content = TextEditingController(
    text: widget.feedback?['comment'] as String?,
  );
  late double rating = (widget.feedback?['rating'] as num?)?.toDouble() ?? 5;
  late final images = (widget.feedback?['images'] as List? ?? [])
      .whereType<String>()
      .toList();
  final files = <XFile>[];
  final uploaded = <String, String>{};
  Future<void> pickImage() async {
    if (busy || images.length + files.length >= 5) return;
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (file == null || !mounted) return;
    if (await file.length() > 5 * 1024 * 1024) {
      if (mounted) setState(() => error = 'Mỗi ảnh tối đa 5 MB.');
      return;
    }
    if (mounted) setState(() => files.add(file));
  }

  bool busy = false;
  String? error;
  @override
  void dispose() {
    title.dispose();
    content.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (busy || !form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      if (widget.report) {
        await api.request(
          '/reports',
          method: 'POST',
          authenticated: true,
          data: {
            'targetType': 'order',
            'orderId': widget.order.id,
            'reportType': 'other',
            'title': title.text.trim(),
            'description': content.text.trim(),
          },
        );
      } else {
        for (final file in files) {
          if (uploaded.containsKey(file.path)) continue;
          final urls = await api.uploadImages('/feedback/images', [file]);
          if (urls is! List || urls.isEmpty || urls.first is! String)
            throw const ApiException('Phản hồi tải ảnh đánh giá không hợp lệ.');
          uploaded[file.path] = urls.first as String;
        }
        final id = widget.feedback?['_id'] ?? widget.feedback?['id'];
        await api.request(
          id == null ? '/feedback' : '/feedback/$id',
          method: id == null ? 'POST' : 'PUT',
          authenticated: true,
          data: {
            if (id == null) 'orderId': widget.order.id,
            'rating': rating,
            'images': [...images, ...files.map((file) => uploaded[file.path]!)],
            'comment': content.text.trim(),
          },
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể gửi. Nội dung đã nhập được giữ lại.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.report ? 'Báo cáo vấn đề' : 'Đánh giá dịch vụ'),
    ),
    body: Form(
      key: form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Đơn ${widget.order.code}'),
          if (!widget.report) ...[
            for (final url in images)
              ListTile(
                leading: Image.network(
                  url,
                  width: 48,
                  height: 48,
                  fit: BoxFit.cover,
                  errorBuilder: (_, error, stack) => const Icon(Icons.image),
                ),
                title: const Text('Ảnh đánh giá'),
                trailing: IconButton(
                  tooltip: 'Xóa ảnh',
                  onPressed: busy
                      ? null
                      : () => setState(() => images.remove(url)),
                  icon: const Icon(Icons.close),
                ),
              ),
            for (final file in files)
              ListTile(
                title: Text(file.name),
                trailing: IconButton(
                  tooltip: 'Xóa ảnh đã chọn',
                  onPressed: busy
                      ? null
                      : () => setState(() => files.remove(file)),
                  icon: const Icon(Icons.close),
                ),
              ),
            OutlinedButton.icon(
              onPressed: busy || images.length + files.length >= 5
                  ? null
                  : pickImage,
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: Text('Thêm ảnh (${images.length + files.length}/5)'),
            ),
          ],
          const SizedBox(height: 16),
          if (error != null)
            Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          if (widget.report)
            TextFormField(
              controller: title,
              enabled: !busy,
              maxLength: 200,
              decoration: const InputDecoration(labelText: 'Tiêu đề'),
              validator: (value) => (value ?? '').trim().length < 5
                  ? 'Nhập tiêu đề ít nhất 5 ký tự.'
                  : null,
            )
          else
            RatingStars(
              value: rating,
              onChanged: busy
                  ? null
                  : (value) => setState(() => rating = value),
            ),
          const SizedBox(height: 16),
          TextFormField(
            controller: content,
            enabled: !busy,
            minLines: 4,
            maxLines: 8,
            maxLength: widget.report ? 3000 : 1000,
            decoration: InputDecoration(
              labelText: widget.report ? 'Mô tả vấn đề' : 'Nhận xét',
            ),
            validator: (value) =>
                widget.report && (value ?? '').trim().length < 10
                ? 'Mô tả ít nhất 10 ký tự.'
                : null,
          ),
        ],
      ),
    ),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: busy ? null : save,
          child: Text(busy ? 'Đang gửi...' : 'Gửi'),
        ),
      ),
    ),
  );
}
