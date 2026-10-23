import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'provider_assignment_sound_native.dart'
    if (dart.library.js_interop) 'provider_assignment_sound_web.dart'
    as platform;

abstract class AssignmentAlertSound {
  Future<bool> play();
  Future<void> stop();
  void dispose();
}

final assignmentAlertSoundProvider = Provider<AssignmentAlertSound>((ref) {
  final sound = platform.createAssignmentSound();
  ref.onDispose(sound.dispose);
  return sound;
});
