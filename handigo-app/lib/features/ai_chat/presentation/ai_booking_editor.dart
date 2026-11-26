import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_exception.dart';
import '../../booking/domain/booking_models.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../../service_catalog/domain/service_option.dart';
import 'ai_chat_controller.dart';

const bookingEditLabels = {
  'name': 'Tên người nhận',
  'phone': 'Số điện thoại người nhận',
  'quantity': 'Số lượng',
  'address': 'Địa chỉ',
  'schedule': 'Ngày giờ',
  'payment': 'Thanh toán',
  'voucher': 'Mã giảm giá',
};

class AiBookingEditor extends ConsumerStatefulWidget {
  const AiBookingEditor({
    super.key,
    required this.mode,
    required this.draft,
    required this.preview,
  });
  final String mode;
  final Map<String, dynamic> draft, preview;
  @override
  ConsumerState<AiBookingEditor> createState() => _AiBookingEditorState();
}

class _AiBookingEditorState extends ConsumerState<AiBookingEditor> {
  final _form = GlobalKey<FormState>();
  late final Map<String, dynamic> _values;
  late final TextEditingController _text;
  final _quantities = <String, TextEditingController>{};
  List<Address> _addresses = [];
  List<ServiceOption> _options = [];
  bool _loading = false, _saving = false, _useAddress = false;
  String? _error, _choice;
  DateTime? _date;

  @override
  void initState() {
    super.initState();
    _values = Map<String, dynamic>.from(widget.draft['values'] as Map? ?? {});
    final key = widget.mode == 'name'
        ? 'recipientName'
        : widget.mode == 'phone'
        ? 'recipientPhone'
        : 'uniformQuantity';
    _text = TextEditingController(
      text:
          '${_values[key] ?? widget.preview[key] ?? (widget.mode == 'quantity' ? widget.preview['quantity'] ?? 1 : '')}',
    );
    _choice = switch (widget.mode) {
      'payment' => _values['paymentMethod'] as String? ?? 'bank',
      'address' => _values['addressId'] as String?,
      'voucher' => _values['voucherCode'] as String? ?? '',
      _ => null,
    };
    if (widget.mode == 'payment' &&
        widget.preview['serviceType'] == 'variable_price' &&
        _choice == 'cash') {
      _choice = 'bank';
    }
    _date = DateTime.tryParse(
      _values['scheduledAt'] as String? ?? '',
    )?.toLocal();
    for (final item in _values['selectedOptions'] as List? ?? []) {
      _quantities[item['optionId'] as String] = TextEditingController(
        text: '${item['quantity']}',
      );
    }
    if (widget.mode == 'address' ||
        widget.mode == 'quantity' && _quantities.isNotEmpty) {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repository = ref.read(serviceCatalogRepositoryProvider);
      if (widget.mode == 'address') {
        _addresses = await repository.addresses();
        if (!_addresses.any((item) => item.id == _choice)) _choice = null;
      } else {
        final id = _values['serviceId'];
        if (id is! String) {
          throw const ApiException(
            'Chưa xác định được dịch vụ. Hãy nhắn cho trợ lý để kiểm tra lại.',
          );
        }
        _options = (await repository.detail(id)).options;
      }
    } catch (failure) {
      if (mounted) {
        _error = failure is ApiException
            ? failure.message
            : 'Chưa tải được thông tin. Vui lòng thử lại.';
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _quantityError(String? value) =>
      RegExp(r'^\d+$').hasMatch(value ?? '') &&
          (int.tryParse(value ?? '') ?? 0) >= 1 &&
          (int.tryParse(value ?? '') ?? 100) <= 99
      ? null
      : 'Số lượng phải là số nguyên từ 1 đến 99.';

  Future<void> _save() async {
    if (_saving || _loading || !(_form.currentState?.validate() ?? false)) {
      return;
    }
    final controller = ref.read(aiChatControllerProvider);
    final current = controller.session?['bookingDraft'] as Map?;
    if (!controller.canSend ||
        current?['revision'] != widget.draft['revision']) {
      setState(() => _error = 'Bản nháp đã thay đổi. Đóng và mở lại để sửa.');
      return;
    }
    final patch = <String, dynamic>{};
    switch (widget.mode) {
      case 'name':
        patch['recipientName'] = _useAddress
            ? null
            : _text.text.trim().replaceAll(RegExp(r'\s+'), ' ');
      case 'phone':
        patch['recipientPhone'] = _useAddress
            ? null
            : _text.text.trim().replaceAll(RegExp(r'[\s.-]'), '');
      case 'quantity':
        if (_quantities.isEmpty) {
          patch['quantity'] = int.parse(_text.text);
        } else {
          if (_quantities.keys.any(
            (id) => !_options.any((option) => option.id == id),
          )) {
            setState(
              () => _error =
                  'Có tùy chọn không còn khả dụng. Hãy nhắn cho trợ lý kiểm tra lại.',
            );
            return;
          }
          patch['selectedOptions'] = _quantities.entries
              .map(
                (item) => {
                  'optionId': item.key,
                  'quantity': int.parse(item.value.text),
                },
              )
              .toList();
        }
      case 'address':
        patch['addressId'] = _choice;
      case 'payment':
        patch['paymentMethod'] = _choice;
      case 'voucher':
        patch['voucherCode'] = _choice == '' ? null : _choice;
      case 'schedule':
        if (_choice != 'normal' &&
            (_date == null || !_date!.isAfter(DateTime.now()))) {
          setState(() => _error = 'Vui lòng chọn ngày giờ trong tương lai.');
          return;
        }
        patch.addAll({
          'orderType': _choice == 'normal' ? 'normal' : 'scheduled',
          'scheduledAt': _choice == 'normal'
              ? null
              : _date!.toUtc().toIso8601String(),
        });
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    await controller.updateBooking(patch, widget.draft['revision'] as int);
    if (!mounted) return;
    if (controller.error == null) {
      Navigator.pop(context);
    } else {
      setState(() {
        _saving = false;
        _error = controller.error;
      });
    }
  }

  Future<void> _pickSchedule() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      initialDate:
          _date != null &&
              _date!.isAfter(now) &&
              _date!.isBefore(now.add(const Duration(days: 365)))
          ? _date!
          : now,
    );
    if (!mounted || date == null) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_date ?? now),
    );
    if (!mounted || time == null) return;
    setState(() {
      _date = DateTime(date.year, date.month, date.day, time.hour, time.minute);
      _choice = 'scheduled';
    });
  }

  @override
  void dispose() {
    _text.dispose();
    for (final value in _quantities.values) {
      value.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final enabled = !_saving && !_loading;
    final vouchers = (widget.draft['availableVouchers'] as List? ?? [])
        .whereType<Map>();
    final paymentOptions = {
      'bank': 'Chuyển khoản PayOS',
      'wallet': 'Ví Handigo',
      if (widget.preview['serviceType'] != 'variable_price') 'cash': 'Tiền mặt',
    };
    return AlertDialog(
      title: Text('Sửa ${bookingEditLabels[widget.mode]?.toLowerCase()}'),
      content: SizedBox(
        width: 360,
        child: SingleChildScrollView(
          child: Form(
            key: _form,
            child: RadioGroup<String>(
              groupValue: _choice,
              onChanged: (value) {
                if (enabled) setState(() => _choice = value);
              },
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Trợ lý sẽ kiểm tra lại dữ liệu, giá và lịch rồi gửi bản xác nhận mới.',
                  ),
                  const SizedBox(height: 12),
                  if (_loading)
                    const Center(child: CircularProgressIndicator())
                  else if (widget.mode == 'name' || widget.mode == 'phone') ...[
                    TextFormField(
                      controller: _text,
                      enabled: enabled && !_useAddress,
                      decoration: InputDecoration(
                        labelText: bookingEditLabels[widget.mode],
                      ),
                      keyboardType: widget.mode == 'phone'
                          ? TextInputType.phone
                          : TextInputType.name,
                      maxLength: widget.mode == 'name' ? 120 : 25,
                      validator: (value) {
                        if (_useAddress) return null;
                        final text = (value ?? '').trim().replaceAll(
                          RegExp(r'\s+'),
                          ' ',
                        );
                        if (widget.mode == 'phone') {
                          return RegExp(
                                r'^0(?:3[2-9]|5[25689]|7[06789]|8[1-9]|9[0-46-9])\d{7}$',
                              ).hasMatch(text.replaceAll(RegExp(r'[\s.-]'), ''))
                              ? null
                              : 'Số điện thoại Việt Nam không hợp lệ.';
                        }
                        return text.length >= 2 &&
                                text.length <= 120 &&
                                RegExp(
                                  r'^[\p{L}\p{M} ]+$',
                                  unicode: true,
                                ).hasMatch(text)
                            ? null
                            : 'Tên từ 2 đến 120 ký tự, chỉ gồm chữ và khoảng trắng.';
                      },
                    ),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _useAddress,
                      onChanged: enabled
                          ? (value) =>
                                setState(() => _useAddress = value == true)
                          : null,
                      title: const Text('Dùng thông tin từ địa chỉ đã chọn'),
                    ),
                    const Text(
                      'Chỉ dùng cho đơn đang đặt; giữ nguyên hồ sơ và sổ địa chỉ.',
                    ),
                  ] else if (widget.mode == 'quantity') ...[
                    if (_quantities.isEmpty)
                      TextFormField(
                        controller: _text,
                        enabled: enabled,
                        decoration: const InputDecoration(
                          labelText: 'Số lượng',
                        ),
                        keyboardType: TextInputType.number,
                        validator: _quantityError,
                      ),
                    for (final entry in _quantities.entries)
                      TextFormField(
                        controller: entry.value,
                        enabled:
                            enabled &&
                            _options.any(
                              (option) =>
                                  option.id == entry.key &&
                                  option.allowsQuantity,
                            ),
                        decoration: InputDecoration(
                          labelText:
                              _options
                                  .where((option) => option.id == entry.key)
                                  .firstOrNull
                                  ?.name ??
                              'Tùy chọn không còn khả dụng',
                        ),
                        keyboardType: TextInputType.number,
                        validator: _quantityError,
                      ),
                  ] else if (widget.mode == 'address') ...[
                    if (_addresses.isEmpty)
                      const Text(
                        'Chưa có địa chỉ. Đóng và nhắn địa chỉ mới cho trợ lý.',
                      ),
                    for (final address in _addresses)
                      RadioListTile<String>(
                        value: address.id,
                        enabled: enabled,
                        title: Text(address.displayAddress),
                        subtitle: Text(
                          '${address.recipientName} · ${address.recipientPhone}',
                        ),
                      ),
                  ] else if (widget.mode == 'payment') ...[
                    for (final entry in paymentOptions.entries)
                      RadioListTile<String>(
                        value: entry.key,
                        enabled: enabled,
                        title: Text(entry.value),
                      ),
                    if (widget.preview['serviceType'] == 'variable_price')
                      const Text(
                        'Tiền cọc khảo sát thanh toán qua PayOS hoặc ví.',
                      ),
                  ] else if (widget.mode == 'voucher') ...[
                    RadioListTile<String>(
                      value: '',
                      enabled: enabled,
                      title: const Text('Không dùng voucher'),
                    ),
                    for (final voucher in vouchers)
                      RadioListTile<String>(
                        value: voucher['code'] as String,
                        enabled: enabled,
                        title: Text('${voucher['code']}'),
                        subtitle: Text('${voucher['name'] ?? ''}'),
                      ),
                    if (vouchers.isEmpty)
                      const Text(
                        'Chưa có mã khả dụng. Bạn có thể nhắn mã để trợ lý kiểm tra.',
                      ),
                  ] else if (widget.mode == 'schedule') ...[
                    Text(
                      _date == null
                          ? 'Chưa chọn lịch hẹn'
                          : 'Lịch hẹn: ${_date!.day}/${_date!.month}/${_date!.year} ${_date!.hour.toString().padLeft(2, '0')}:${_date!.minute.toString().padLeft(2, '0')}',
                    ),
                    OutlinedButton(
                      onPressed: enabled ? _pickSchedule : null,
                      child: const Text('Chọn ngày giờ hẹn'),
                    ),
                    OutlinedButton(
                      onPressed: enabled
                          ? () => setState(() => _choice = 'normal')
                          : null,
                      child: Text(
                        _choice == 'normal'
                            ? 'Đã chọn đặt ngay'
                            : 'Chuyển sang đặt ngay',
                      ),
                    ),
                    const Text(
                      'Hệ thống kiểm tra giờ hoạt động, thời gian đặt trước và khả năng phục vụ sau khi gửi.',
                    ),
                  ],
                  if (_error != null) ...[
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                    if (widget.mode == 'address' || widget.mode == 'quantity')
                      TextButton(
                        onPressed: enabled ? _load : null,
                        child: const Text('Tải lại thông tin'),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Đóng'),
        ),
        FilledButton(
          onPressed:
              enabled &&
                  !(widget.mode == 'address' &&
                      !_addresses.any((item) => item.id == _choice))
              ? _save
              : null,
          child: Text(_saving ? 'Đang gửi…' : 'Gửi thay đổi'),
        ),
      ],
    );
  }
}
