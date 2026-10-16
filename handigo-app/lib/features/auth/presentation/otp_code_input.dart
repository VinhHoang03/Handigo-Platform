import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class OtpCodeInput extends StatefulWidget {
  const OtpCodeInput({
    required this.controller,
    required this.validator,
    this.enabled = true,
    super.key,
  });

  final TextEditingController controller;
  final FormFieldValidator<String> validator;
  final bool enabled;

  @override
  State<OtpCodeInput> createState() => _OtpCodeInputState();
}

class _OtpCodeInputState extends State<OtpCodeInput> {
  final _controllers = List.generate(6, (_) => TextEditingController());
  final _focusNodes = List.generate(6, (_) => FocusNode());
  final _fieldKey = GlobalKey<FormFieldState<String>>();
  bool _publishing = false;

  @override
  void initState() {
    super.initState();
    _syncFromController();
    widget.controller.addListener(_syncFromController);
  }

  @override
  void didUpdateWidget(OtpCodeInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_syncFromController);
      widget.controller.addListener(_syncFromController);
      _syncFromController();
    }
  }

  void _syncFromController() {
    if (_publishing) return;
    final digits = widget.controller.text.replaceAll(RegExp(r'[^0-9]'), '');
    for (var index = 0; index < _controllers.length; index++) {
      _setDigit(index, index < digits.length ? digits[index] : '');
    }
    _fieldKey.currentState?.didChange(
      _controllers.map((item) => item.text).join(),
    );
  }

  void _setDigit(int index, String digit) {
    _controllers[index].value = TextEditingValue(
      text: digit,
      selection: TextSelection.collapsed(offset: digit.length),
    );
  }

  void _publishCode() {
    final code = _controllers.map((item) => item.text).join();
    _publishing = true;
    widget.controller.value = TextEditingValue(
      text: code,
      selection: TextSelection.collapsed(offset: code.length),
    );
    _publishing = false;
    _fieldKey.currentState?.didChange(code);
  }

  void _onChanged(int index, String value) {
    if (value.isEmpty) {
      _publishCode();
      if (index > 0) _focusNodes[index - 1].requestFocus();
      return;
    }
    final start = value.length == 6 ? 0 : index;
    final available = _controllers.length - start;
    final count = value.length < available ? value.length : available;
    for (var offset = 0; offset < count; offset++) {
      _setDigit(start + offset, value[offset]);
    }
    _publishCode();
    final next = start + count;
    if (next < _focusNodes.length) {
      _focusNodes[next].requestFocus();
    } else {
      _focusNodes.last.unfocus();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_syncFromController);
    for (final controller in _controllers) {
      controller.dispose();
    }
    for (final focusNode in _focusNodes) {
      focusNode.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FormField<String>(
    key: _fieldKey,
    initialValue: widget.controller.text,
    validator: widget.validator,
    builder: (field) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: List.generate(
            6,
            (index) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(left: index == 0 ? 0 : 6),
                child: Focus(
                  onKeyEvent: (_, event) {
                    if (widget.enabled &&
                        event is KeyDownEvent &&
                        event.logicalKey == LogicalKeyboardKey.backspace &&
                        _controllers[index].text.isEmpty &&
                        index > 0) {
                      _setDigit(index - 1, '');
                      _publishCode();
                      _focusNodes[index - 1].requestFocus();
                      return KeyEventResult.handled;
                    }
                    return KeyEventResult.ignored;
                  },
                  child: Semantics(
                    label: 'Chữ số OTP ${index + 1} trên 6',
                    child: TextField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      enabled: widget.enabled,
                      keyboardType: TextInputType.number,
                      textInputAction: index == 5
                          ? TextInputAction.done
                          : TextInputAction.next,
                      autofillHints: index == 0
                          ? const [AutofillHints.oneTimeCode]
                          : null,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(6),
                      ],
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge,
                      decoration: InputDecoration(
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 14,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        enabledBorder: field.hasError
                            ? OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: BorderSide(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              )
                            : null,
                      ),
                      onTap: () =>
                          _controllers[index].selection = TextSelection(
                            baseOffset: 0,
                            extentOffset: _controllers[index].text.length,
                          ),
                      onChanged: (value) => _onChanged(index, value),
                      onSubmitted: (_) {
                        if (index < 5) _focusNodes[index + 1].requestFocus();
                      },
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (field.hasError)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              field.errorText!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
      ],
    ),
  );
}
