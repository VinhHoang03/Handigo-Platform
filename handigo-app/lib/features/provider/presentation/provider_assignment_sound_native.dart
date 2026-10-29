import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'provider_assignment_sound.dart';

AssignmentAlertSound createAssignmentSound() => _AssignmentAlertSound();

class _AssignmentAlertSound implements AssignmentAlertSound {
  AudioPlayer? _player;
  bool _disposed = false;
  int _revision = 0;

  @override
  Future<bool> play() async {
    if (_disposed) return false;
    final revision = ++_revision;
    try {
      final player = _player ??= AudioPlayer();
      await player.play(AssetSource('audio/assignment-alert.wav'));
      if (_disposed || revision != _revision) await player.stop();
      return !_disposed && revision == _revision;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<void> stop() async {
    _revision++;
    try {
      await _player?.stop();
    } catch (_) {
      // Lỗi âm thanh không chặn phản hồi đơn hàng.
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _revision++;
    unawaited(
      _player?.dispose().catchError((Object _) {}) ?? Future<void>.value(),
    );
  }
}
