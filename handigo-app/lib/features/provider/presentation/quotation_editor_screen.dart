import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_exception.dart';
import '../../orders/domain/order_summary.dart';
import 'provider_screens.dart';
import 'package:image_picker/image_picker.dart';

class QuotationEditorScreen extends ConsumerStatefulWidget {
  const QuotationEditorScreen({required this.order, this.quotation, super.key});
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
      widget.quotation?.items.map(_ItemDraft.fromItem).toList() ??
      [_ItemDraft()];
  bool busy = false;
  String? error;

  Future<void> scan() async {
    if (busy) return;
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
    );
    if (file == null || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final scanned = await ref
          .read(providerRepositoryProvider)
          .scanQuotation(widget.order.id, file);
      if (!mounted) return;
      setState(() {
        if (items.length == 1 && items.first.title.text.trim().isEmpty) {
          items.removeLast().dispose();
        }
        items.addAll(scanned.take(100 - items.length).map(_ItemDraft.fromItem));
        if (items.isEmpty) items.add(_ItemDraft());
        error =
            'Đã đọc ảnh. Vui lòng kiểm tra từng hạng mục và đơn giá trước khi lưu.';
      });
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể đọc ảnh. Bạn vẫn có thể nhập báo giá thủ công.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
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
      if (mounted) Navigator.pop(context, true);
    } catch (failure) {
      if (mounted)
        setState(
          () => error = failure is ApiException
              ? failure.message
              : 'Chưa thể lưu báo giá. Dữ liệu đã nhập được giữ lại.',
        );
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        widget.quotation == null ? 'Lập báo giá sửa chữa' : 'Chỉnh sửa báo giá',
      ),
    ),
    body: Form(
      key: form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            widget.order.serviceName,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: busy ? null : scan,
            icon: const Icon(Icons.document_scanner_outlined),
            label: const Text('Đọc hạng mục từ ảnh báo giá'),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
          for (var i = 0; i < items.length; i++)
            Card(
              key: ObjectKey(items[i]),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text('Hạng mục ${i + 1}')),
                        IconButton(
                          tooltip: 'Xóa hạng mục',
                          onPressed: busy || items.length == 1
                              ? null
                              : () {
                                  final item = items[i];
                                  setState(() => items.removeAt(i));
                                  item.dispose();
                                },
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ],
                    ),
                    TextFormField(
                      controller: items[i].title,
                      enabled: !busy,
                      maxLength: 200,
                      decoration: const InputDecoration(
                        labelText: 'Tên hạng mục',
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'Nhập tên hạng mục.'
                          : null,
                    ),
                    DropdownButtonFormField<String>(
                      initialValue: items[i].type,
                      decoration: const InputDecoration(
                        labelText: 'Loại hạng mục',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'labor',
                          child: Text('Nhân công'),
                        ),
                        DropdownMenuItem(
                          value: 'material',
                          child: Text('Vật tư'),
                        ),
                        DropdownMenuItem(
                          value: 'replacement_part',
                          child: Text('Linh kiện'),
                        ),
                        DropdownMenuItem(value: 'other', child: Text('Khác')),
                      ],
                      onChanged: busy
                          ? null
                          : (value) => setState(() => items[i].type = value!),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: items[i].quantity,
                      enabled: !busy,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Số lượng'),
                      validator: (value) => _integer(value, 1, 1000),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: items[i].price,
                      enabled: !busy,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Đơn giá (đ)',
                      ),
                      validator: _amount,
                    ),
                  ],
                ),
              ),
            ),
          OutlinedButton.icon(
            onPressed: busy || items.length >= 100
                ? null
                : () => setState(() => items.add(_ItemDraft())),
            icon: const Icon(Icons.add),
            label: const Text('Thêm hạng mục'),
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
            enabled: !busy,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Giảm giá (đ)'),
            validator: _amount,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: note,
            enabled: !busy,
            minLines: 2,
            maxLines: 5,
            maxLength: 2000,
            decoration: const InputDecoration(labelText: 'Ghi chú khảo sát'),
          ),
          TextFormField(
            controller: recommendation,
            enabled: !busy,
            minLines: 2,
            maxLines: 5,
            maxLength: 2000,
            decoration: const InputDecoration(labelText: 'Đề xuất xử lý'),
          ),
        ],
      ),
    ),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: FilledButton(
          onPressed: busy ? null : save,
          child: Text(busy ? 'Đang lưu...' : 'Lưu báo giá'),
        ),
      ),
    ),
  );
}

String? _integer(String? value, int min, int max) {
  final number = int.tryParse(value ?? '');
  return number == null || number < min || number > max
      ? 'Nhập số nguyên từ $min đến $max.'
      : null;
}

String? _amount(String? value) {
  final number = double.tryParse(value ?? '');
  return number == null || !number.isFinite || number < 0
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
