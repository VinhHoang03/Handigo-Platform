import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_exception.dart';
import '../../orders/domain/order_summary.dart';
import 'provider_screens.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'quotation_voice_sheet.dart';

class QuotationEditorScreen extends ConsumerStatefulWidget {
  const QuotationEditorScreen({
    required this.order,
    this.quotation,
    this.embedded = false,
    this.onSaved,
    this.onBusyChanged,
    super.key,
  });
  final bool embedded;
  final Future<void> Function()? onSaved;
  final ValueChanged<bool>? onBusyChanged;
  final OrderDetail order;
  final RepairQuotation? quotation;

  @override
  ConsumerState<QuotationEditorScreen> createState() =>
      _QuotationEditorScreenState();
}

class _QuotationEditorScreenState extends ConsumerState<QuotationEditorScreen> {
  final form = GlobalKey<FormState>();
  late final note = TextEditingController(
    text: widget.quotation?.inspectionNote,
  );
  late final recommendation = TextEditingController(
    text: widget.quotation?.recommendation,
  );
  late final duration = TextEditingController(
    text:
        '${widget.quotation?.estimatedDurationMinutes ?? widget.order.durationMinutes ?? 60}',
  );
  late final discount = TextEditingController(
    text: '${widget.quotation?.discountAmount ?? 0}',
  );
  late final List<_ItemDraft> items =
      widget.quotation?.items.map(_ItemDraft.fromItem).toList() ?? [];
  bool busy = false;
  int _revision = 0;
  String? error;

  Future<void> scan() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    widget.onBusyChanged?.call(true);
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );
      if (file == null || !mounted) return;
      final scanned = await ref
          .read(providerRepositoryProvider)
          .scanQuotation(widget.order.id, file);
      if (!mounted) return;
      setState(() {
        if (items.length == 1 && items.first.title.text.trim().isEmpty) {
          items.removeLast().dispose();
        }
        items.addAll(scanned.take(100 - items.length).map(_ItemDraft.fromItem));
        _revision++;
        error =
            'Đã đọc ảnh. Vui lòng kiểm tra từng hạng mục và đơn giá trước khi lưu.';
      });
    } catch (failure) {
      if (mounted) {
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể đọc ảnh. Bạn vẫn có thể nhập báo giá thủ công.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => busy = false);
        widget.onBusyChanged?.call(false);
      }
    }
  }

  @override
  void dispose() {
    for (final controller in [note, recommendation, duration, discount]) {
      controller.dispose();
    }
    for (final item in items) {
      item.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (busy || !form.currentState!.validate()) return;
    if (items.isEmpty) {
      setState(() => error = 'Vui lòng thêm ít nhất một hạng mục báo giá.');
      return;
    }
    if (items.any(
      (item) =>
          item.title.text.trim().isEmpty ||
          item.title.text.trim().length > 200 ||
          !_types.containsKey(item.type) ||
          _integer(item.quantity.text, 1, 1000) != null ||
          _amount(item.price.text) != null,
    )) {
      setState(
        () => error =
            'Có hạng mục chưa hợp lệ. Chạm vào hạng mục để kiểm tra tên, số lượng và đơn giá.',
      );
      return;
    }
    final subtotal = items.fold<double>(
      0,
      (sum, item) =>
          sum + double.parse(item.price.text) * int.parse(item.quantity.text),
    );
    if (double.parse(discount.text) > subtotal) {
      setState(() => error = 'Giảm giá không được lớn hơn tổng các hạng mục.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    widget.onBusyChanged?.call(true);
    try {
      await ref.read(providerRepositoryProvider).saveQuotation(
        widget.order.id,
        {
          'items': items
              .map(
                (item) => {
                  ...item.original,
                  'title': item.title.text.trim(),
                  'quantity': int.parse(item.quantity.text),
                  'unitPrice': double.parse(item.price.text),
                  'itemType': item.type,
                },
              )
              .toList(),
          'estimatedDurationMinutes': int.parse(duration.text),
          'discountAmount': double.parse(discount.text),
          'inspectionNote': note.text.trim(),
          'recommendation': recommendation.text.trim(),
        },
        current: widget.quotation,
      );
      if (!mounted) return;
      if (widget.embedded) {
        await widget.onSaved?.call();
      } else {
        Navigator.pop(context, true);
      }
    } catch (failure) {
      if (mounted) {
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể lưu báo giá. Dữ liệu đã nhập được giữ lại.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => busy = false);
        widget.onBusyChanged?.call(false);
      }
    }
  }

  Future<void> _voice() async {
    if (busy) return;
    final instruction = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const QuotationVoiceSheet(),
    );
    if (!mounted || instruction == null || instruction.trim().isEmpty) return;
    setState(() {
      busy = true;
      error = null;
    });
    widget.onBusyChanged?.call(true);
    final revision = _revision;
    try {
      final reply = await ref.read(providerRepositoryProvider).assistQuotation(
        widget.order.id,
        {
          'instruction': instruction.trim(),
          'revision': revision,
          'items': [
            for (var i = 0; i < items.length; i++)
              {
                'rowId': 'row-$i',
                'title': items[i].title.text.trim(),
                'description': items[i].original['description'] ?? '',
                'note': items[i].original['note'] ?? '',
                'itemType': items[i].type,
                'quantity': int.tryParse(items[i].quantity.text) ?? 1,
                'unitPrice': double.tryParse(items[i].price.text) ?? 0,
              },
          ],
          'inspectionNote': note.text,
          'recommendation': recommendation.text,
        },
      );
      if (!mounted) return;
      if (reply['revision'] != revision || revision != _revision) {
        throw const FormatException(
          'Báo giá đã thay đổi. Vui lòng thử lại để AI xử lý dữ liệu mới.',
        );
      }
      final next = [
        for (final item in items)
          <String, dynamic>{
            ...item.original,
            'title': item.title.text,
            'quantity': int.parse(item.quantity.text),
            'unitPrice': double.parse(item.price.text),
            'itemType': item.type,
          },
      ];
      for (final update
          in (reply['updates'] as List? ?? const []).whereType<Map>()) {
        final fields = Map<String, dynamic>.from(update['fields'] as Map);
        if (update['rowId'] == null) {
          next.add({
            'title': '',
            'quantity': 1,
            'unitPrice': 0,
            'itemType': 'material',
            ...fields,
          });
        } else {
          final index = int.tryParse(
            update['rowId'].toString().replaceFirst('row-', ''),
          );
          if (index == null || index < 0 || index >= items.length) {
            throw const FormatException('AI trả về hạng mục không hợp lệ.');
          }
          next[index] = {...next[index], ...fields};
        }
      }
      if (next.length > 100) {
        throw const FormatException('Báo giá tối đa 100 hạng mục.');
      }
      final drafts = next
          .map((item) => _ItemDraft.fromItem(QuotationItem.fromJson(item)))
          .toList();
      setState(() {
        for (final item in items) {
          item.dispose();
        }
        items
          ..clear()
          ..addAll(drafts);
        if (reply['inspectionNote'] is String) {
          note.text = reply['inspectionNote'] as String;
        }
        if (reply['recommendation'] is String) {
          recommendation.text = reply['recommendation'] as String;
        }
        _revision++;
        error = [
          reply['message'] ?? 'Đã điền vào báo giá.',
          ...?reply['warnings'] as List?,
          'Kiểm tra các hạng mục và đơn giá trước khi lưu.',
        ].join('\n');
      });
    } catch (failure) {
      if (mounted) {
        setState(
          () => error = failure is ApiException
              ? failure.message
              : failure is FormatException
              ? failure.message
              : 'Chưa thể điền báo giá bằng AI. Dữ liệu hiện tại được giữ lại.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => busy = false);
        widget.onBusyChanged?.call(false);
      }
    }
  }

  Future<void> _editItem([int? index]) async {
    if (busy) return;
    final source = index == null ? null : items[index];
    final draft = source == null
        ? _ItemDraft()
        : _ItemDraft(
            name: source.title.text,
            count: int.parse(source.quantity.text),
            amount: double.parse(source.price.text),
            type: source.type,
            original: source.original,
          );
    final key = GlobalKey<FormState>();
    final accepted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            16,
            20,
            MediaQuery.viewInsetsOf(context).bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Form(
              key: key,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    index == null
                        ? 'Thêm hạng mục báo giá'
                        : 'Chỉnh sửa hạng mục',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: draft.title,
                    maxLength: 200,
                    decoration: const InputDecoration(
                      labelText: 'Tên hạng mục',
                    ),
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Nhập tên hạng mục.'
                        : null,
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: draft.type,
                    decoration: const InputDecoration(
                      labelText: 'Loại hạng mục',
                    ),
                    items: [
                      for (final entry in _types.entries)
                        DropdownMenuItem(
                          value: entry.key,
                          child: Text(entry.value),
                        ),
                    ],
                    onChanged: (value) => update(() => draft.type = value!),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: draft.quantity,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Số lượng'),
                    validator: (value) => _integer(value, 1, 1000),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: draft.price,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Đơn giá (đ)'),
                    validator: _amount,
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: () {
                      if (key.currentState!.validate()) {
                        Navigator.pop(context, true);
                      }
                    },
                    child: const Text('Xác nhận hạng mục'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    // Chờ sheet kết thúc hiệu ứng đóng trước khi giải phóng các ô nhập.
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!mounted || accepted != true) {
      draft.dispose();
      return;
    }
    setState(() {
      if (index == null) {
        items.add(draft);
      } else {
        items[index] = draft;
        source!.dispose();
      }
      _revision++;
    });
  }

  static const _types = {
    'material': 'Vật tư',
    'labor': 'Nhân công',
    'replacement_part': 'Linh kiện',
    'other': 'Khác',
  };
  String _money(num value) =>
      '${NumberFormat.decimalPattern('vi_VN').format(value)} đ';

  Widget _itemCard(int index) {
    final item = items[index];
    final quantity = int.tryParse(item.quantity.text) ?? 1;
    final price = double.tryParse(item.price.text) ?? 0;
    final scheme = Theme.of(context).colorScheme;
    return Card(
      key: ObjectKey(item),
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: busy ? null : () => _editItem(index),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 4, 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          item.title.text,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: item.type == 'labor'
                                ? scheme.secondaryContainer
                                : scheme.primaryFixed,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            _types[item.type] ?? 'Khác',
                            style: Theme.of(context).textTheme.labelSmall,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: 'Số lượng $quantity × ${_money(price)} = ',
                          ),
                          TextSpan(
                            text: _money(quantity * price),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Xóa hạng mục',
                onPressed: busy
                    ? null
                    : () {
                        setState(() {
                          items.removeAt(index);
                          _revision++;
                        });
                        item.dispose();
                      },
                icon: Icon(Icons.delete_outline, color: scheme.error, size: 20),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final subtotal = items.fold<double>(
      0,
      (sum, item) =>
          sum +
          (int.tryParse(item.quantity.text) ?? 0) *
              (double.tryParse(item.price.text) ?? 0),
    );
    final total = (subtotal - (double.tryParse(discount.text) ?? 0)).clamp(
      0,
      double.infinity,
    );
    final content = Form(
      key: form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                Icons.format_list_bulleted_rounded,
                color: Theme.of(context).colorScheme.primary,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Hạng mục báo giá (${items.length})',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              ),
              IconButton(
                tooltip: 'Quét ảnh bằng AI',
                onPressed: busy || items.length >= 100 ? null : scan,
                icon: const Icon(Icons.add_photo_alternate_outlined),
              ),
              IconButton(
                tooltip: 'Nhập báo giá bằng giọng nói AI',
                onPressed: busy ? null : _voice,
                icon: const Icon(Icons.mic_none_rounded),
              ),
            ],
          ),
          if (busy)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(error!),
            ),
          for (var i = 0; i < items.length; i++) _itemCard(i),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'Chưa có hạng mục. Thêm thủ công, quét ảnh hoặc dùng giọng nói AI.',
              ),
            ),
          OutlinedButton.icon(
            onPressed: busy || items.length >= 100 ? null : _editItem,
            icon: const Icon(Icons.add_circle_outline),
            label: const Text('Thêm hạng mục báo giá'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: duration,
            enabled: !busy,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Thời lượng sửa chữa (phút)',
            ),
            validator: (value) => _integer(value, 1, 1440),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: discount,
            onChanged: (_) => setState(() {}),
            enabled: !busy,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Giảm giá (đ)'),
            validator: _amount,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: note,
            enabled: !busy,
            minLines: 1,
            maxLines: 5,
            maxLength: 2000,
            decoration: const InputDecoration(labelText: 'Ghi chú khảo sát'),
          ),
          TextFormField(
            controller: recommendation,
            enabled: !busy,
            minLines: 1,
            maxLines: 5,
            maxLength: 2000,
            decoration: const InputDecoration(labelText: 'Đề xuất xử lý'),
          ),
          const SizedBox(height: 12),
          Text(
            'Tổng báo giá: ${_money(total)}',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          Text('Cọc đã áp dụng: ${_money(widget.order.appliedDeposit)}'),
          Text(
            'Thu trực tiếp: ${_money((total - widget.order.appliedDeposit).clamp(0, double.infinity))}',
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: busy ? null : save,
            child: Text(busy ? 'Đang xử lý...' : 'Lưu báo giá'),
          ),
        ],
      ),
    );
    if (widget.embedded) return content;
    return Scaffold(
      appBar: AppBar(title: const Text('Báo giá sửa chữa')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: content,
      ),
    );
  }
}

String? _integer(String? value, int min, int max) {
  final number = int.tryParse(value ?? '');
  return number == null || number < min || number > max
      ? 'Nhập số nguyên từ $min đến $max.'
      : null;
}

String? _amount(String? value) {
  final number = double.tryParse(value ?? '');
  return number == null || !number.isFinite || number < 0 || number > 1000000000
      ? 'Nhập số tiền không âm hợp lệ.'
      : null;
}

class _ItemDraft {
  _ItemDraft({
    String name = '',
    int count = 1,
    double amount = 0,
    this.type = 'material',
    this.original = const {},
  }) : title = TextEditingController(text: name),
       quantity = TextEditingController(text: '$count'),
       price = TextEditingController(text: '$amount');
  factory _ItemDraft.fromItem(QuotationItem item) => _ItemDraft(
    name: item.title,
    count: item.quantity,
    amount: item.unitPrice,
    type: item.itemType,
    original: item.toJson(),
  );
  final TextEditingController title, quantity, price;
  String type;
  final Map<String, dynamic> original;
  void dispose() {
    title.dispose();
    quantity.dispose();
    price.dispose();
  }
}
