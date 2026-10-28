import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:image_picker/image_picker.dart';
import 'package:speech_to_text/speech_to_text.dart' as speech;
import '../../../core/network/api_exception.dart';
import '../../../app/providers/app_providers.dart';
import '../../auth/domain/app_user.dart';
import 'ai_chat_controller.dart';
import 'ai_chat_history.dart';
import 'ai_chat_composer.dart';

Future<void> showAiChatSheet(BuildContext context) =>
    showModalBottomSheet<void>(
      useRootNavigator: true,
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      constraints: const BoxConstraints(maxWidth: 460),
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          8,
          8,
          8,
          8 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SizedBox(
          height:
              MediaQuery.sizeOf(context).height * .9 -
              MediaQuery.viewInsetsOf(context).bottom,
          child: const AiChatSheet(),
        ),
      ),
    );

class AiChatSheet extends ConsumerStatefulWidget {
  const AiChatSheet({super.key});
  @override
  ConsumerState<AiChatSheet> createState() => _AiChatSheetState();
}

class _AiChatSheetState extends ConsumerState<AiChatSheet> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final _voice = speech.SpeechToText();
  bool _showHistory = false, _uploading = false, _listening = false;
  String? _inputError;
  List<String>? _attachments;

  Future<void> _upload() async {
    final controller = ref.read(aiChatControllerProvider);
    final current = _attachments ?? controller.attachments;
    if (_uploading ||
        _listening ||
        !controller.canSend ||
        current.length >= 4) {
      return;
    }
    setState(() {
      _uploading = true;
      _inputError = null;
    });
    try {
      final file = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (file == null || !mounted) return;
      final url = await controller.uploadAttachment(file);
      if (mounted) setState(() => _attachments = [...current, url]);
    } catch (error) {
      if (mounted) {
        setState(
          () => _inputError = error is ApiException
              ? error.message
              : 'Không thể tải ảnh. Vui lòng kiểm tra quyền truy cập ảnh và thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _toggleVoice() async {
    if (_listening) {
      await _voice.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }
    if (_uploading || !ref.read(aiChatControllerProvider).canSend) return;
    setState(() {
      _listening = true;
      _inputError = null;
    });
    void statusChanged(String status) {
      if (mounted && (status == 'done' || status == 'notListening')) {
        setState(() => _listening = false);
      }
    }

    void recognitionFailed(dynamic error) {
      if (mounted) {
        setState(() {
          _listening = false;
          _inputError =
              'Không thể nhận giọng nói. Vui lòng thử lại hoặc nhập bằng bàn phím.';
        });
      }
    }

    try {
      final available = await _voice.initialize(
        onStatus: statusChanged,
        onError: recognitionFailed,
      );
      if (!mounted) return;
      if (!available) {
        setState(() {
          _listening = false;
          _inputError =
              'Vui lòng cấp quyền micro và nhận dạng giọng nói để sử dụng tính năng này.';
        });
        return;
      }
      _voice.statusListener = statusChanged;
      _voice.errorListener = recognitionFailed;
      final prefix = _input.text.trim();
      await _voice.listen(
        listenOptions: speech.SpeechListenOptions(localeId: 'vi_VN'),
        onResult: (result) {
          if (!mounted) return;
          final text = [
            if (prefix.isNotEmpty) prefix,
            result.recognizedWords,
          ].join(' ');
          _input.text = text.length > 4000 ? text.substring(0, 4000) : text;
          _input.selection = TextSelection.collapsed(
            offset: _input.text.length,
          );
        },
      );
    } catch (_) {
      if (mounted) {
        setState(() {
          _listening = false;
          _inputError =
              'Thiết bị chưa hỗ trợ nhập giọng nói. Bạn vẫn có thể nhập bằng bàn phím.';
        });
      }
    }
  }

  Future<void> _selectSession(String id) async {
    if (_uploading || _listening) return;
    final opened = await ref.read(aiChatControllerProvider).selectSession(id);
    if (!mounted || !opened) return;
    _input.clear();
    setState(() {
      _showHistory = false;
      _attachments = null;
      _inputError = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  @override
  void dispose() {
    _voice.cancel();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final controller = ref.read(aiChatControllerProvider);
    if (!controller.canSend || _uploading || _listening) return;
    final text = _input.text.trim().isNotEmpty
        ? _input.text
        : _attachments != null
        ? 'Cập nhật ảnh hiện trạng cho bản nháp đặt dịch vụ này.'
        : '';
    if (text.isEmpty) return;
    await controller.send(text, attachments: _attachments);
    if (!mounted) return;
    if (controller.error == null) {
      _input.clear();
      setState(() => _attachments = null);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _retry() async {
    final controller = ref.read(aiChatControllerProvider);
    await controller.retry();
    if (!mounted || controller.error != null) return;
    _input.clear();
    setState(() => _attachments = null);
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(aiChatControllerProvider);
    final scheme = Theme.of(context).colorScheme;
    final confirmation = controller.confirmation;
    final payment = controller.payment;
    final images = _attachments ?? controller.attachments;
    final canInteract = controller.canSend && !_uploading && !_listening;
    final uploadAllowed =
        confirmation == null || confirmation['tool'] == 'create_booking';
    final isProvider = ref.watch(
      authControllerProvider.select(
        (auth) => auth.user?.role == UserRole.provider,
      ),
    );
    final status = controller.busy
        ? controller.messages.isEmpty
              ? 'Đang tải cuộc trò chuyện'
              : 'Đang xử lý yêu cầu'
        : controller.error != null
        ? 'Cần thử lại yêu cầu'
        : controller.needsReconciliation
        ? 'Cần kiểm tra kết quả'
        : confirmation != null
        ? 'Chờ bạn xác nhận'
        : null;
    return Material(
      color: scheme.surfaceContainerLowest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: .5)),
      ),
      clipBehavior: Clip.antiAlias,
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  SvgPicture.asset(
                    'assets/brand/ai-assistant.svg',
                    width: 48,
                    height: 48,
                    excludeFromSemantics: true,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Trợ lý Handigo',
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(
                                fontSize: 22,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -.5,
                              ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isProvider
                              ? 'Hỗ trợ dành cho nhà cung cấp'
                              : 'Hỗ trợ dành cho khách hàng',
                          style: TextStyle(
                            fontSize: 13,
                            color: scheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Tác vụ mới',
                    onPressed: controller.canReset && !_uploading && !_listening
                        ? () async {
                            await controller.reset();
                            if (!mounted || controller.error != null) return;
                            _input.clear();
                            setState(() {
                              _attachments = null;
                              _inputError = null;
                              _showHistory = false;
                            });
                          }
                        : null,
                    style: IconButton.styleFrom(
                      foregroundColor: scheme.onSurfaceVariant,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.add, size: 20),
                  ),
                  IconButton(
                    tooltip: _showHistory
                        ? 'Quay lại cuộc trò chuyện'
                        : 'Lịch sử trò chuyện',
                    onPressed:
                        controller.canSwitchSession &&
                            !_uploading &&
                            !_listening
                        ? () {
                            FocusScope.of(context).unfocus();
                            setState(() => _showHistory = !_showHistory);
                          }
                        : null,
                    icon: Icon(
                      _showHistory ? Icons.arrow_back : Icons.history,
                      size: 20,
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đóng trợ lý',
                    onPressed: () => Navigator.pop(context),
                    style: IconButton.styleFrom(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    icon: const Icon(Icons.close, size: 20),
                  ),
                ],
              ),
            ),
            Divider(
              height: 1,
              color: scheme.outlineVariant.withValues(alpha: .3),
            ),
            if (status != null && !_showHistory)
              Container(
                width: double.infinity,
                color: scheme.surfaceContainerLow.withValues(alpha: .6),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    if (controller.busy)
                      const SizedBox(
                        width: 13,
                        height: 13,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else
                      Icon(
                        Icons.circle,
                        size: 6,
                        color: controller.error != null
                            ? scheme.error
                            : scheme.primary,
                      ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        status,
                        style: TextStyle(
                          fontSize: 13,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: _showHistory
                  ? AiChatHistory(
                      controller: controller,
                      onSelected: _selectSession,
                    )
                  : ColoredBox(
                      color: Color.alphaBlend(
                        scheme.surfaceContainerLow.withValues(alpha: .4),
                        scheme.surfaceContainerLowest,
                      ),
                      child: LayoutBuilder(
                        builder: (context, constraints) => ListView(
                          controller: _scroll,
                          padding: const EdgeInsets.all(16),
                          children: [
                            if (controller.messages.isEmpty && !controller.busy)
                              ConstrainedBox(
                                constraints: BoxConstraints(
                                  minHeight: (constraints.maxHeight - 32).clamp(
                                    0,
                                    double.infinity,
                                  ),
                                ),
                                child: Center(
                                  child: _AiWelcome(
                                    isProvider: isProvider,
                                    enabled: canInteract,
                                    onSend: (text) async {
                                      _input.text = text;
                                      await _send();
                                    },
                                  ),
                                ),
                              ),
                            for (final message in controller.messages)
                              _AiMessageFrame(
                                message: message,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (message['sender'] != 'user')
                                      _AiMessageContent(
                                        content:
                                            message['content'] as String? ?? '',
                                      )
                                    else
                                      SelectableText(
                                        message['content'] as String? ?? '',
                                        style: TextStyle(
                                          color: message['sender'] == 'user'
                                              ? scheme.onPrimary
                                              : scheme.onSurface,
                                        ),
                                      ),
                                    if ((message['customerAttachments']
                                                as List? ??
                                            [])
                                        .isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 8),
                                        child: Wrap(
                                          spacing: 8,
                                          runSpacing: 8,
                                          children: [
                                            for (final url
                                                in (message['customerAttachments']
                                                        as List)
                                                    .whereType<String>())
                                              ClipRRect(
                                                borderRadius:
                                                    BorderRadius.circular(12),
                                                child: Image.network(
                                                  url,
                                                  width: 96,
                                                  height: 96,
                                                  fit: BoxFit.cover,
                                                  semanticLabel:
                                                      'Ảnh hiện trạng đã gửi',
                                                  errorBuilder: (_, _, _) =>
                                                      const SizedBox(
                                                        width: 96,
                                                        height: 96,
                                                        child: Icon(
                                                          Icons
                                                              .broken_image_outlined,
                                                        ),
                                                      ),
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    for (final group
                                        in (message['choiceGroups'] as List? ??
                                                [])
                                            .whereType<
                                              Map<String, dynamic>
                                            >()) ...[
                                      const SizedBox(height: 8),
                                      Text(group['label'] as String? ?? ''),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 4,
                                        children: [
                                          for (final option
                                              in (group['options'] as List? ??
                                                      [])
                                                  .whereType<String>())
                                            ActionChip(
                                              label: Text(option),
                                              onPressed: canInteract
                                                  ? () {
                                                      final current = _input
                                                          .text
                                                          .trim();
                                                      _input.text =
                                                          group['multiple'] ==
                                                                  true &&
                                                              current.isNotEmpty
                                                          ? '$current; $option'
                                                          : option;
                                                      _input.selection =
                                                          TextSelection.collapsed(
                                                            offset: _input
                                                                .text
                                                                .length,
                                                          );
                                                    }
                                                  : null,
                                            ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            if (controller.busy)
                              const Row(
                                children: [
                                  SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  ),
                                  SizedBox(width: 12),
                                  Expanded(child: Text('Trợ lý đang xử lý...')),
                                ],
                              ),
                            if (controller.error != null)
                              Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        controller.error!,
                                        style: TextStyle(color: scheme.error),
                                      ),
                                      TextButton(
                                        onPressed: controller.busy
                                            ? null
                                            : _retry,
                                        child: const Text('Thử lại'),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            if (controller.needsReconciliation)
                              Card(
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Thao tác trước cần được kiểm tra. Vui lòng tải lại trạng thái trước khi tiếp tục.',
                                      ),
                                      TextButton(
                                        onPressed: controller.busy
                                            ? null
                                            : controller.canReconcileBooking
                                            ? controller.checkBooking
                                            : controller.load,
                                        child: Text(
                                          controller.canReconcileBooking
                                              ? 'Kiểm tra kết quả tạo đơn'
                                              : 'Tải lại trạng thái',
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            if (controller.needsNewSession)
                              const Padding(
                                padding: EdgeInsets.all(12),
                                child: Text(
                                  'Cuộc trò chuyện đã kết thúc. Nhấn nút cuộc trò chuyện mới để tiếp tục.',
                                ),
                              ),
                            if (confirmation != null)
                              _ConfirmationCard(
                                action: confirmation,
                                enabled: canInteract && _attachments == null,
                                onDecision: controller.decide,
                              ),
                            if (payment != null)
                              _PaymentCard(
                                payment: payment,
                                enabled: canInteract,
                                canCheck:
                                    controller.canCheckPayment &&
                                    !_uploading &&
                                    !_listening &&
                                    _attachments == null,
                                onCheck: controller.checkPayment,
                              ),
                          ],
                        ),
                      ),
                    ),
            ),
            Divider(
              height: 1,
              color: scheme.outlineVariant.withValues(alpha: .3),
            ),
            if (!_showHistory)
              AiChatComposer(
                input: _input,
                enabled: controller.canSend,
                listening: _listening,
                uploading: _uploading,
                showUpload:
                    !isProvider &&
                    uploadAllowed &&
                    (controller.session?['bookingDraft'] as Map?)?['status'] !=
                        'booked',
                images: images,
                attachmentsDirty: _attachments != null,
                error: _inputError,
                onUpload: _upload,
                onVoice: _toggleVoice,
                onSend: _send,
                onRemoveImage: (index) => setState(() {
                  _attachments = List<String>.of(images)..removeAt(index);
                }),
              ),
          ],
        ),
      ),
    );
  }
}

class _AiWelcome extends StatelessWidget {
  const _AiWelcome({
    required this.isProvider,
    required this.enabled,
    required this.onSend,
  });
  final bool isProvider, enabled;
  final ValueChanged<String> onSend;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 16),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: scheme.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: scheme.primary.withValues(alpha: .1)),
            ),
            child: SvgPicture.asset(
              'assets/brand/ai-assistant.svg',
              width: 56,
              height: 56,
              excludeFromSemantics: true,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'CHÀO BẠN, MÌNH LÀ HANDIGO',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: scheme.primary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isProvider
                ? 'Tôi có thể hỗ trợ gì?'
                : 'Bạn cần giúp gì cho ngôi nhà?',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontSize: 22,
              fontWeight: FontWeight.w600,
              letterSpacing: -.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isProvider
                ? 'Hỏi về đơn được nhận, lịch làm việc, hồ sơ hoặc dịch vụ đăng ký.'
                : 'Tôi có thể giúp đặt dịch vụ, gửi yêu cầu hỗ trợ, khiếu nại và tra cứu chính sách Handigo.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 16,
              height: 1.5,
              color: scheme.onSurfaceVariant,
            ),
          ),
          if (!isProvider) ...[
            const SizedBox(height: 24),
            for (final suggestion in const [
              (
                Icons.build_outlined,
                'Tìm dịch vụ phù hợp',
                'Giúp tôi chọn dịch vụ tại nhà.',
              ),
              (
                Icons.calendar_month_outlined,
                'Hướng dẫn đặt lịch',
                'Hướng dẫn tôi cách đặt lịch.',
              ),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: OutlinedButton(
                  onPressed: enabled ? () => onSend(suggestion.$3) : null,
                  style: OutlinedButton.styleFrom(
                    backgroundColor: scheme.surfaceContainerLowest,
                    foregroundColor: scheme.onSurface,
                    minimumSize: const Size(double.infinity, 56),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    side: BorderSide(
                      color: scheme.outlineVariant.withValues(alpha: .4),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(suggestion.$1, size: 18, color: scheme.primary),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          suggestion.$2,
                          style: const TextStyle(fontSize: 16),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.north_east,
                        size: 16,
                        color: scheme.onSurfaceVariant,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _AiMessageContent extends StatelessWidget {
  const _AiMessageContent({required this.content});
  final String content;

  TextSpan _inline(String text) {
    final matches = RegExp(r'\*\*([^*]+)\*\*').allMatches(text);
    final spans = <TextSpan>[];
    var offset = 0;
    for (final match in matches) {
      spans.add(TextSpan(text: text.substring(offset, match.start)));
      spans.add(
        TextSpan(
          text: match.group(1),
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
      );
      offset = match.end;
    }
    spans.add(TextSpan(text: text.substring(offset)));
    return TextSpan(children: spans);
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final listMarker = RegExp(r'^\s*(?:[-*•]|\d+[.)])\s+');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final paragraph in content.trim().split(RegExp(r'\n\s*\n')))
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: paragraph.split('\n').every(listMarker.hasMatch)
                ? Column(
                    children: [
                      for (final line in paragraph.split('\n'))
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '•  ',
                                style: TextStyle(color: scheme.primary),
                              ),
                              Expanded(
                                child: SelectableText.rich(
                                  _inline(line.replaceFirst(listMarker, '')),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  )
                : SelectableText.rich(_inline(paragraph)),
          ),
      ],
    );
  }
}

class _AiMessageFrame extends StatelessWidget {
  const _AiMessageFrame({required this.message, required this.child});
  final Map<String, dynamic> message;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isUser = message['sender'] == 'user';
    final createdAt = DateTime.tryParse(
      '${message['createdAt'] ?? ''}',
    )?.toLocal();
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: LayoutBuilder(
        builder: (context, constraints) => Align(
          alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
          child: SizedBox(
            width: constraints.maxWidth * (isUser ? .88 : 1),
            child: Column(
              crossAxisAlignment: isUser
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  alignment: isUser ? WrapAlignment.end : WrapAlignment.start,
                  children: [
                    if (!isUser)
                      SvgPicture.asset(
                        'assets/brand/ai-assistant.svg',
                        width: 20,
                        height: 20,
                        excludeFromSemantics: true,
                      ),
                    Text(
                      isUser ? 'Bạn' : 'Trợ lý Handigo',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: isUser ? FontWeight.w400 : FontWeight.w600,
                        color: isUser
                            ? scheme.onSurfaceVariant
                            : scheme.primary,
                      ),
                    ),
                    if (createdAt != null)
                      Text(
                        '·  ${DateFormat('HH:mm').format(createdAt)}',
                        style: TextStyle(
                          fontSize: 11,
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: isUser
                        ? scheme.primary
                        : scheme.surfaceContainerLowest,
                    border: isUser
                        ? null
                        : Border.all(
                            color: scheme.outlineVariant.withValues(alpha: .35),
                          ),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(isUser ? 16 : 4),
                      topRight: Radius.circular(isUser ? 4 : 16),
                      bottomLeft: const Radius.circular(16),
                      bottomRight: const Radius.circular(16),
                    ),
                  ),
                  child: DefaultTextStyle.merge(
                    style: const TextStyle(fontSize: 16, height: 1.5),
                    child: child,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

const _previewLabels = {
  'service': 'Dịch vụ',
  'options': 'Tùy chọn',
  'address': 'Địa chỉ',
  'schedule': 'Thời gian',
  'unitPrice': 'Đơn giá',
  'quantity': 'Số lượng',
  'originalAmount': 'Giá trước giảm',
  'voucherCode': 'Voucher',
  'discountAmount': 'Giảm giá',
  'providerName': 'Chuyên gia ưu tiên',
  'previousAddress': 'Địa chỉ trước khi sửa',
  'recipientName': 'Người nhận',
  'recipientPhone': 'Số điện thoại người nhận',
  'defaultAddress': 'Địa chỉ mặc định',
  'addressNote': 'Ghi chú địa chỉ',
  'responseDeadline': 'Hạn phản hồi',
  'paymentMethod': 'Thanh toán',
  'amount': 'Số tiền',
  'description': 'Mô tả',
  'orderCode': 'Mã đơn',
  'reason': 'Lý do hủy',
  'paidAmount': 'Đã thanh toán',
  'refundAmount': 'Dự kiến hoàn',
  'cancellationFee': 'Phí hủy',
  'note': 'Lưu ý',
  'paymentLabel': 'Khoản thanh toán',
  'subject': 'Tiêu đề yêu cầu',
  'category': 'Nhóm hỗ trợ',
  'priority': 'Độ ưu tiên',
  'caseId': 'Mã yêu cầu',
  'caseStatus': 'Trạng thái hiện tại',
};

String _previewValue(String key, dynamic value) {
  if (value is num) {
    return key == 'quantity'
        ? '$value'
        : '${NumberFormat.decimalPattern('vi_VN').format(value)} đ';
  }
  if (value is List) return value.whereType<String>().join('\n');
  if (value is! String) return '';
  if (key == 'paymentMethod') {
    return {
          'cash': 'Tiền mặt',
          'bank': 'Chuyển khoản',
          'wallet': 'Ví Handigo',
        }[value] ??
        value;
  }
  if (key == 'schedule') {
    final date = DateTime.tryParse(value);
    if (date != null) {
      return DateFormat('dd/MM/yyyy HH:mm').format(date.toLocal());
    }
  }
  return value;
}

class _ConfirmationCard extends StatelessWidget {
  const _ConfirmationCard({
    required this.action,
    required this.enabled,
    required this.onDecision,
  });
  final Map<String, dynamic> action;
  final bool enabled;
  final Future<void> Function(String) onDecision;

  @override
  Widget build(BuildContext context) {
    final preview = action['preview'] as Map<String, dynamic>? ?? {};
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              preview['title'] as String? ?? 'Xác nhận thao tác',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            const Text(
              'Kiểm tra thông tin trước khi xác nhận. Bạn có thể nhắn thông tin cần sửa.',
            ),
            for (final entry in _previewLabels.entries)
              if (_previewValue(entry.key, preview[entry.key]).isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(
                    '${entry.value}: ${_previewValue(entry.key, preview[entry.key])}',
                  ),
                ),
            if (action['expiresAt'] is String)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  'Có hiệu lực đến ${_previewValue('schedule', action['expiresAt'])}.',
                ),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: enabled ? () => onDecision('REJECT') : null,
                    child: const Text('Từ chối'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: enabled ? () => onDecision('CONFIRM') : null,
                    child: const Text('Xác nhận'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({
    required this.payment,
    required this.enabled,
    required this.canCheck,
    required this.onCheck,
  });
  final Map<String, dynamic> payment;
  final bool enabled;
  final bool canCheck;
  final Future<void> Function() onCheck;

  @override
  Widget build(BuildContext context) {
    final url = Uri.tryParse(payment['checkoutUrl'] as String? ?? '');
    final canOpen =
        payment['status'] == 'pending' &&
        url != null &&
        url.scheme == 'https' &&
        url.userInfo.isEmpty &&
        !url.hasPort &&
        (url.host == 'payos.vn' || url.host.endsWith('.payos.vn'));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Thanh toán đơn ${payment['orderCode'] ?? ''}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(payment['message'] as String? ?? ''),
            if (payment['amount'] is num)
              Text(_previewValue('amount', payment['amount'])),
            if (canOpen)
              TextButton(
                onPressed: enabled
                    ? () async {
                        try {
                          final opened = await launchUrl(
                            url,
                            mode: LaunchMode.externalApplication,
                          );
                          if (!opened) throw const FormatException();
                        } catch (_) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Không mở được trang thanh toán. Vui lòng thử lại.',
                                ),
                              ),
                            );
                          }
                        }
                      }
                    : null,
                child: const Text('Mở PayOS để thanh toán'),
              ),
            TextButton(
              onPressed: canCheck ? onCheck : null,
              child: const Text('Kiểm tra thanh toán'),
            ),
          ],
        ),
      ),
    );
  }
}
