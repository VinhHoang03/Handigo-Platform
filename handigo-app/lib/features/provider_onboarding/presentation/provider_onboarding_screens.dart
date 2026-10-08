import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../app/providers/app_providers.dart';
import '../../service_catalog/presentation/service_catalog_provider.dart';
import '../data/provider_application_repository.dart';
import '../domain/provider_application_models.dart';

final providerApplicationRepositoryProvider = Provider(
  (ref) => ProviderApplicationRepository(ref.watch(apiClientProvider)),
);
final providerApplicationProvider = FutureProvider<ProviderApplication?>(
  (ref) => ref.watch(providerApplicationRepositoryProvider).mine(),
);

class ProviderOnboardingScreen extends ConsumerStatefulWidget {
  const ProviderOnboardingScreen({super.key});
  @override
  ConsumerState<ProviderOnboardingScreen> createState() =>
      _ProviderOnboardingScreenState();
}

class _ProviderOnboardingScreenState
    extends ConsumerState<ProviderOnboardingScreen> {
  final description = TextEditingController(),
      experience = TextEditingController(text: '0'),
      area = TextEditingController(),
      fullName = TextEditingController(),
      documentNumber = TextEditingController(),
      certificateTitle = TextEditingController();
  int step = 1;
  final selectedServices = <String>{};
  String documentType = 'cccd';
  String? frontUrl, backUrl, passportUrl, certificateUrl;
  bool saving = false;
  ProviderApplication? current;
  @override
  void dispose() {
    description.dispose();
    experience.dispose();
    area.dispose();
    fullName.dispose();
    documentNumber.dispose();
    certificateTitle.dispose();
    super.dispose();
  }

  void hydrate(ProviderApplication? item) {
    if (current != item && item != null) {
      current = item;
      step = item.onboardingStep ?? 1;
      description.text = item.description;
      experience.text = '${item.experienceYears}';
      area.text = item.workingAreas.join('; ');
      selectedServices.addAll(item.serviceIds);
      final identity = item.identityDocument;
      if (identity != null) {
        documentType = identity.type;
        fullName.text = identity.fullName;
        documentNumber.text = identity.documentNumber;
        frontUrl = identity.frontImageUrl;
        backUrl = identity.backImageUrl;
        passportUrl = identity.passportImageUrl;
      }
    }
  }

  Map<String, dynamic> _payload({bool submit = false}) => {
    'description': description.text.trim(),
    'experienceYears': int.tryParse(experience.text) ?? 0,
    'serviceIds': selectedServices.toList(),
    'workingAreas': area.text
        .split(';')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList(),
    'identityDocument': {
      'type': documentType,
      'documentNumber': documentNumber.text.trim(),
      'fullName': fullName.text.trim(),
      if (frontUrl != null) 'frontImageUrl': frontUrl,
      if (backUrl != null) 'backImageUrl': backUrl,
      if (passportUrl != null) 'passportImageUrl': passportUrl,
    },
    'onboardingStep': step,
    if (submit)
      'certificates': certificateTitle.text.trim().isEmpty
          ? []
          : [
              {
                'title': certificateTitle.text.trim(),
                'imageUrls': [certificateUrl!],
              },
            ],
  };
  Future<void> _save() async {
    setState(() => saving = true);
    try {
      await ref
          .read(providerApplicationRepositoryProvider)
          .saveDraft(_payload());
      ref.invalidate(providerApplicationProvider);
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Đã lưu bản nháp.')));
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Không thể lưu bản nháp: $e')));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _submit() async {
    final hasDocument = documentType == 'passport'
        ? passportUrl != null
        : frontUrl != null;
    final hasCertificate =
        certificateTitle.text.trim().isEmpty || certificateUrl != null;
    if (selectedServices.isEmpty ||
        area.text.trim().isEmpty ||
        fullName.text.trim().isEmpty ||
        documentNumber.text.trim().isEmpty ||
        !hasDocument ||
        !hasCertificate) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Vui lòng hoàn thiện dịch vụ, khu vực, giấy tờ và ảnh chứng chỉ nếu đã nhập tên.',
          ),
        ),
      );
      return;
    }
    setState(() => saving = true);
    try {
      final repo = ref.read(providerApplicationRepositoryProvider);
      final result = current?.status == 'rejected'
          ? await repo.resubmit(current!.id, _payload(submit: true))
          : await repo.submit(_payload(submit: true));
      ref.invalidate(providerApplicationProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          'Hồ sơ đã chuyển sang trạng thái ${_statusLabel(result.status)}.'
              .toSnackBar(),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Không thể gửi hồ sơ: $e')));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> _pick(bool front) async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (file == null) return;
    setState(() => saving = true);
    try {
      final kind = documentType == 'passport'
          ? 'passport'
          : (front ? 'cccd_front' : 'cccd_back');
      final url = await ref
          .read(providerApplicationRepositoryProvider)
          .uploadAsset(file, purpose: 'identity', documentKind: kind);
      setState(() {
        if (documentType == 'passport') {
          passportUrl = url;
        } else if (front) {
          frontUrl = url;
        } else {
          backUrl = url;
        }
      });
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Tải giấy tờ thất bại: $e')));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final application = ref.watch(providerApplicationProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đăng ký làm Đối tác'),
        leading: context.canPop()
            ? IconButton(
                tooltip: 'Quay lại',
                onPressed: () => context.pop(),
                icon: const Icon(Icons.arrow_back),
              )
            : null,
        actions: [
          IconButton(
            tooltip: 'Trợ giúp',
            onPressed: () => showAboutDialog(
              context: context,
              applicationName: 'Handigo Đối tác',
              applicationVersion: 'Hồ sơ đăng ký',
            ),
            icon: const Icon(Icons.help_outline_rounded),
          ),
          IconButton(
            tooltip: 'Đăng xuất',
            onPressed: _logout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: application.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _error(error),
        data: (item) {
          hydrate(item);
          return Column(
            children: [
              const _OnboardingHero(),
              if (item != null) _statusCard(item),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: _OnboardingStepper(step: step),
              ),
              Expanded(child: _stepBody()),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: saving ? null : _save,
                        child: const Text('Lưu nháp'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: saving
                            ? null
                            : (step == 3
                                  ? _submit
                                  : () => setState(() => step++)),
                        child: Text(step == 3 ? 'Gửi hồ sơ' : 'Tiếp tục'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Đăng xuất'),
        content: const Text('Bạn muốn thoát khỏi tài khoản hiện tại?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authControllerProvider).logout();
    }
  }

  Widget _error(Object e) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Không thể tải hồ sơ: $e'),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: () => ref.invalidate(providerApplicationProvider),
            child: const Text('Thử lại'),
          ),
        ],
      ),
    ),
  );
  Widget _statusCard(ProviderApplication item) => Card(
    margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
    color: item.status == 'rejected'
        ? Theme.of(context).colorScheme.errorContainer
        : Theme.of(context).colorScheme.surfaceContainerLow,
    child: ListTile(
      leading: Icon(
        item.status == 'approved' ? Icons.verified : Icons.assignment_outlined,
      ),
      title: Text('Trạng thái: ${_statusLabel(item.status)}'),
      subtitle: Text(
        item.rejectionReason ??
            item.rejectionNotes ??
            'Bạn có thể tiếp tục hoàn thiện hồ sơ.',
      ),
    ),
  );
  Widget _stepBody() => ListView(
    padding: const EdgeInsets.all(16),
    children: switch (step) {
      1 => [
        _title('Thông tin kinh nghiệm'),
        TextField(
          controller: description,
          maxLines: 4,
          decoration: const InputDecoration(labelText: 'Mô tả kinh nghiệm'),
        ),
        TextField(
          controller: experience,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Số năm kinh nghiệm'),
        ),
        const SizedBox(height: 16),
        _services(),
      ],
      2 => [
        _title('Khu vực hoạt động'),
        Text(
          'Nhập nhiều khu vực, ngăn cách bằng dấu chấm phẩy. Mỗi khu vực cần có dạng Phường/Xã, Tỉnh/Thành phố.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        TextField(
          controller: area,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Khu vực hoạt động'),
        ),
        const SizedBox(height: 16),
        _title('Giấy tờ tùy thân'),
        DropdownButtonFormField(
          value: documentType,
          items: const [
            DropdownMenuItem(value: 'cccd', child: Text('CCCD')),
            DropdownMenuItem(value: 'passport', child: Text('Hộ chiếu')),
          ],
          onChanged: (v) => setState(() => documentType = v ?? 'cccd'),
        ),
        TextField(
          controller: fullName,
          decoration: const InputDecoration(labelText: 'Họ tên trên giấy tờ'),
        ),
        TextField(
          controller: documentNumber,
          decoration: const InputDecoration(labelText: 'Số giấy tờ'),
        ),
        Row(
          children: [
            Expanded(
              child: _uploadButton(
                documentType == 'passport' ? 'Ảnh hộ chiếu' : 'Mặt trước',
                documentType == 'passport' ? passportUrl : frontUrl,
                () => _pick(true),
              ),
            ),
            if (documentType == 'cccd') const SizedBox(width: 8),
            if (documentType == 'cccd')
              Expanded(
                child: _uploadButton('Mặt sau', backUrl, () => _pick(false)),
              ),
          ],
        ),
      ],
      3 => [
        _title('Kiểm tra và gửi hồ sơ'),
        _summary('Dịch vụ', '${selectedServices.length} dịch vụ đã chọn'),
        _summary('Khu vực', area.text),
        _summary(
          'Giấy tờ',
          (documentType == 'passport' ? passportUrl : frontUrl) == null
              ? 'Chưa tải giấy tờ bắt buộc'
              : 'Đã tải giấy tờ',
        ),
        TextField(
          controller: certificateTitle,
          decoration: const InputDecoration(
            labelText: 'Tên chứng chỉ (không bắt buộc)',
          ),
        ),
        _uploadButton(
          'Ảnh chứng chỉ (không bắt buộc)',
          certificateUrl,
          _pickCertificate,
        ),
        const SizedBox(height: 12),
        const Text(
          'Sau khi gửi, hồ sơ sẽ chờ quản trị viên xét duyệt. Ứng dụng không tự phê duyệt hồ sơ.',
        ),
      ],
      _ => [],
    },
  );
  Future<void> _pickCertificate() async {
    final file = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (file == null) return;
    setState(() => saving = true);
    try {
      final url = await ref
          .read(providerApplicationRepositoryProvider)
          .uploadAsset(
            file,
            purpose: 'certificate',
            documentKind: 'certificate',
          );
      if (mounted) setState(() => certificateUrl = url);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Tải chứng chỉ thất bại: $e')));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget _services() {
    final services = ref.watch(serviceCatalogServicesProvider(null));
    return services.when(
      loading: () => const CircularProgressIndicator(),
      error: (_, __) => const Text('Không thể tải danh sách dịch vụ.'),
      data: (page) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Chọn nhóm dịch vụ'),
          ...page.items.map(
            (service) => CheckboxListTile(
              value: selectedServices.contains(service.id),
              onChanged: (v) => setState(
                () => v == true
                    ? selectedServices.add(service.id)
                    : selectedServices.remove(service.id),
              ),
              title: Text(service.name),
              subtitle: Text(service.categoryName ?? ''),
            ),
          ),
        ],
      ),
    );
  }

  Widget _title(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 12, top: 4),
    child: Text(
      text,
      style: Theme.of(
        context,
      ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
    ),
  );
  Widget _summary(String label, String value) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(label),
    subtitle: Text(value),
  );
  Widget _uploadButton(String label, String? url, VoidCallback onPressed) =>
      OutlinedButton.icon(
        onPressed: saving ? null : onPressed,
        icon: Icon(url == null ? Icons.upload_file : Icons.check_circle),
        label: Text(url == null ? label : '$label: đã tải'),
      );
}

class _OnboardingHero extends StatelessWidget {
  const _OnboardingHero();
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
    child: Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        color: Theme.of(context).colorScheme.primaryContainer,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Gia nhập đội ngũ Handigo',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Nhận việc phù hợp và phát triển nghề nghiệp cùng chúng tôi.',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            Icons.workspace_premium_rounded,
            size: 48,
            color: Theme.of(context).colorScheme.onPrimaryContainer,
          ),
        ],
      ),
    ),
  );
}

class _OnboardingStepper extends StatelessWidget {
  const _OnboardingStepper({required this.step});
  final int step;
  @override
  Widget build(BuildContext context) {
    final labels = ['Kinh nghiệm', 'Khu vực & giấy tờ', 'Hoàn tất'];
    return Row(
      children: List.generate(labels.length, (index) {
        final active = index + 1 <= step;
        return Expanded(
          child: Row(
            children: [
              Column(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: active
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.surfaceContainerHighest,
                    child: Text(
                      '${index + 1}',
                      style: TextStyle(
                        fontSize: 12,
                        color: active ? Theme.of(context).colorScheme.onPrimary : null,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    labels[index],
                    style: const TextStyle(fontSize: 10),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
              if (index < labels.length - 1)
                Expanded(
                  child: Container(
                    height: 2,
                    margin: const EdgeInsets.only(
                      bottom: 22,
                      left: 5,
                      right: 5,
                    ),
                    color: index + 1 < step
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
            ],
          ),
        );
      }),
    );
  }
}

String _statusLabel(String value) => switch (value) {
  'draft' => 'Bản nháp',
  'pending' => 'Đang chờ duyệt',
  'resubmitted' => 'Đã gửi lại',
  'approved' => 'Đã duyệt',
  'rejected' => 'Cần bổ sung',
  _ => value,
};

extension on String {
  SnackBar toSnackBar() => SnackBar(content: Text(this));
}
