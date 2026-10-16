import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../app/providers/app_providers.dart';
import '../../auth/domain/app_user.dart';

class RoleHomeScreen extends ConsumerWidget {
  const RoleHomeScreen({required this.role, super.key});
  final UserRole role;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return Scaffold(
      appBar: AppBar(title: Text(role == UserRole.provider ? 'Handigo Provider' : 'Handigo')),
      body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('Xin chào, ${auth.user?.fullName ?? ''}', textAlign: TextAlign.center),
        const SizedBox(height: 8), Text(role.label), const SizedBox(height: 24),
        OutlinedButton.icon(onPressed: () => ref.read(authControllerProvider).logout(), icon: const Icon(Icons.logout), label: const Text('Đăng xuất')),
      ]))),
    );
  }
}
