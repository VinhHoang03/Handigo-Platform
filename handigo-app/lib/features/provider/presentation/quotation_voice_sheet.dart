import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart';

class QuotationVoiceSheet extends StatefulWidget {
  const QuotationVoiceSheet({super.key});

  @override
  State<QuotationVoiceSheet> createState() => _QuotationVoiceSheetState();
}

class _QuotationVoiceSheetState extends State<QuotationVoiceSheet> {
  final _speech = SpeechToText();
  final _text = TextEditingController();
  bool _listening = false;
  bool _starting = false;
  String _prefix = '';
  String? _error;

  @override
  void dispose() {
    _speech.cancel();
    _text.dispose();
    super.dispose();
  }

  Future<void> _record() async {
    if (_starting) return;
    if (_listening) {
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }
    setState(() {
      _starting = true;
      _error = null;
    });
    try {
      final available = await _speech.initialize(
        onStatus: (status) {
          if (mounted && ['done', 'notListening'].contains(status)) {
            setState(() => _listening = false);
          }
        },
        onError: (_) {
          if (mounted) {
            setState(() {
              _listening = false;
              _error =
                  'Chưa nhận được giọng nói. Hãy thử lại hoặc nhập nội dung bên dưới.';
            });
          }
        },
      );
      if (!mounted) return;
      if (!available) {
        setState(
          () => _error =
              'Chưa truy cập được micro. Hãy cấp quyền hoặc nhập mô tả báo giá.',
        );
        return;
      }
      _prefix = _text.text.trim();
      setState(() => _listening = true);
      await _speech.listen(
        listenOptions: SpeechListenOptions(
          localeId: 'vi_VN',
          listenFor: const Duration(seconds: 90),
        ),
        onResult: (result) {
          if (!mounted) return;
          setState(() {
            final value = [
              _prefix,
              result.recognizedWords,
            ].where((part) => part.isNotEmpty).join('\n');
            _text.text = value.length > 6000 ? value.substring(0, 6000) : value;
            if (result.finalResult) _listening = false;
          });
        },
      );
    } catch (_) {
      if (mounted) {
        setState(() {
          _listening = false;
          _error = 'Không thể bật micro. Bạn vẫn có thể nhập mô tả báo giá.';
        });
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Nhập báo giá bằng giọng nói AI',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            const Text(
              'Nói tên hạng mục, số lượng và đơn giá. Kiểm tra nội dung trước khi để AI điền vào báo giá.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _text,
              enabled: !_listening && !_starting,
              minLines: 3,
              maxLines: 6,
              maxLength: 6000,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                labelText: 'Nội dung báo giá',
                hintText:
                    'Ví dụ: thay 2 tụ điện, mỗi cái 180 nghìn, công thay 100 nghìn...',
              ),
            ),
            if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            OutlinedButton.icon(
              onPressed: _starting ? null : _record,
              icon: Icon(
                _listening ? Icons.stop_rounded : Icons.mic_none_rounded,
              ),
              label: Text(
                _starting
                    ? 'Đang bật micro...'
                    : _listening
                    ? 'Dừng ghi âm'
                    : 'Bắt đầu ghi âm',
              ),
            ),
            FilledButton.icon(
              onPressed: _listening || _starting || _text.text.trim().isEmpty
                  ? null
                  : () => Navigator.pop(context, _text.text.trim()),
              icon: const Icon(Icons.auto_awesome_outlined),
              label: const Text('Điền vào báo giá'),
            ),
          ],
        ),
      ),
    ),
  );
}
