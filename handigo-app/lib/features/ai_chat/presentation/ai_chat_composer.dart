import 'package:flutter/material.dart';

class AiChatComposer extends StatefulWidget {
  const AiChatComposer({
    required this.input,
    required this.enabled,
    required this.listening,
    required this.uploading,
    required this.showUpload,
    required this.images,
    required this.attachmentsDirty,
    required this.onUpload,
    required this.onVoice,
    required this.onSend,
    required this.onRemoveImage,
    this.error,
    super.key,
  });
  final TextEditingController input;
  final bool enabled, listening, uploading, showUpload, attachmentsDirty;
  final List<String> images;
  final VoidCallback onUpload, onVoice, onSend;
  final ValueChanged<int> onRemoveImage;
  final String? error;

  @override
  State<AiChatComposer> createState() => _AiChatComposerState();
}

class _AiChatComposerState extends State<AiChatComposer> {
  final _focus = FocusNode();
  @override
  void initState() {
    super.initState();
    _focus.addListener(_focusChanged);
  }

  void _focusChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _focus.removeListener(_focusChanged);
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final input = widget.input;
    final enabled = widget.enabled;
    final listening = widget.listening;
    final uploading = widget.uploading;
    final showUpload = widget.showUpload;
    final images = widget.images;
    final attachmentsDirty = widget.attachmentsDirty;
    final onUpload = widget.onUpload;
    final onVoice = widget.onVoice;
    final onSend = widget.onSend;
    final onRemoveImage = widget.onRemoveImage;
    final error = widget.error;
    final expanded = _focus.hasFocus;
    final scheme = Theme.of(context).colorScheme;
    final available = enabled && !uploading && !listening;
    final iconStyle = IconButton.styleFrom(
      minimumSize: const Size(48, 48),
      foregroundColor: scheme.onSurfaceVariant,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
    final controls = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showUpload)
          IconButton(
            tooltip: 'Đính kèm ảnh hiện trạng',
            style: iconStyle,
            onPressed: available && images.length < 4 ? onUpload : null,
            icon: uploading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add_photo_alternate_outlined, size: 20),
          ),
        IconButton(
          tooltip: listening ? 'Dừng nhập giọng nói' : 'Nhập bằng giọng nói',
          style: listening
              ? iconStyle.copyWith(
                  backgroundColor: WidgetStatePropertyAll(
                    scheme.errorContainer,
                  ),
                )
              : iconStyle,
          onPressed: (enabled && !uploading) || listening ? onVoice : null,
          icon: Icon(
            listening ? Icons.stop_rounded : Icons.mic_none_rounded,
            size: 20,
          ),
        ),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: input,
          builder: (context, value, _) => IconButton.filled(
            tooltip: 'Gửi tin nhắn',
            onPressed:
                available && (value.text.trim().isNotEmpty || attachmentsDirty)
                ? onSend
                : null,
            style: iconStyle.copyWith(
              backgroundColor: WidgetStateProperty.resolveWith(
                (states) => states.contains(WidgetState.disabled)
                    ? scheme.surfaceContainerHigh
                    : scheme.primary,
              ),
              foregroundColor: WidgetStateProperty.resolveWith(
                (states) => states.contains(WidgetState.disabled)
                    ? scheme.onSurfaceVariant
                    : scheme.onPrimary,
              ),
            ),
            icon: const Icon(Icons.send_outlined, size: 20),
          ),
        ),
      ],
    );
    return TextFieldTapRegion(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: scheme.surfaceContainerLow.withValues(alpha: .5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: scheme.outlineVariant.withValues(alpha: .6),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (images.isNotEmpty)
                    SizedBox(
                      height: 88,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: images.length,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (context, index) => SizedBox(
                          width: 80,
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.network(
                                  images[index],
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, _, _) =>
                                      const Icon(Icons.broken_image_outlined),
                                ),
                              ),
                              Positioned(
                                top: 0,
                                right: 0,
                                child: IconButton(
                                  tooltip: 'Bỏ ảnh hiện trạng ${index + 1}',
                                  style: iconStyle.copyWith(
                                    backgroundColor: WidgetStatePropertyAll(
                                      scheme.surfaceContainerLowest.withValues(
                                        alpha: .9,
                                      ),
                                    ),
                                  ),
                                  onPressed: available
                                      ? () => onRemoveImage(index)
                                      : null,
                                  icon: const Icon(Icons.close, size: 16),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: TextField(
                          controller: input,
                          focusNode: _focus,
                          onTapOutside: (_) => _focus.unfocus(),
                          enabled: enabled && !uploading,
                          readOnly: listening,
                          minLines: 1,
                          maxLines: expanded ? 4 : 1,
                          maxLength: 4000,
                          textInputAction: TextInputAction.newline,
                          decoration: InputDecoration(
                            hintText: enabled
                                ? 'Nhắn yêu cầu của bạn…'
                                : 'Vui lòng chờ để tiếp tục…',
                            counterText: '',
                            filled: false,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 10,
                            ),
                          ),
                        ),
                      ),
                      if (!expanded) controls,
                    ],
                  ),
                  if (expanded)
                    Align(alignment: Alignment.centerRight, child: controls),
                ],
              ),
            ),
            if (images.isNotEmpty || attachmentsDirty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  '${images.length}/4 ảnh hiện trạng. ${attachmentsDirty ? 'Nhấn Gửi để cập nhật ảnh trước khi xác nhận.' : 'Ảnh sẽ được gửi kèm đơn sau xác nhận.'}',
                  style: TextStyle(
                    fontSize: 12,
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ),
            if (listening || error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  error ??
                      'Đang nghe tiếng Việt… Nhấn dừng, kiểm tra nội dung rồi gửi.',
                  style: TextStyle(
                    fontSize: 12,
                    color: error != null
                        ? scheme.error
                        : scheme.onSurfaceVariant,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
