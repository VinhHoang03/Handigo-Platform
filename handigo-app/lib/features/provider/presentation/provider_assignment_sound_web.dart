import 'dart:js_interop';
import 'provider_assignment_sound.dart';

@JS('document.baseURI')
external JSString get _baseUri;

@JS('Audio')
extension type _BrowserAudio._(JSObject _) implements JSObject {
  external factory _BrowserAudio(String source);
  external JSPromise<JSAny?> play();
  external void pause();
  external set currentTime(double value);
}

AssignmentAlertSound createAssignmentSound() => _WebAssignmentSound();

class _WebAssignmentSound implements AssignmentAlertSound {
  _BrowserAudio? _audio;
  bool _disposed = false;
  int _revision = 0;

  @override
  Future<bool> play() async {
    if (_disposed) return false;
    final revision = ++_revision;
    try {
      final source = Uri.parse(
        _baseUri.toDart,
      ).resolve('assets/assets/audio/assignment-alert.wav');
      final audio = _audio ??= _BrowserAudio(source.toString());
      audio.currentTime = 0;
      await audio.play().toDart;
      if (_disposed || revision != _revision) audio.pause();
      return !_disposed && revision == _revision;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<void> stop() async {
    _revision++;
    _audio?.pause();
  }

  @override
  void dispose() {
    _disposed = true;
    _revision++;
    _audio?.pause();
    _audio = null;
  }
}
