import '../../services/domain/service.dart';
import 'service_option.dart';

class ServiceDetail {
  const ServiceDetail({required this.service, required this.options});

  factory ServiceDetail.fromJson(
    Map<String, dynamic> json,
    List<ServiceOption> options,
  ) => ServiceDetail(service: Service.fromJson(json), options: options);

  final Service service;
  final List<ServiceOption> options;

  String? selectionError(List<String> selectedIds) {
    if (selectedIds.any((id) => !options.any((option) => option.id == id))) return 'Tùy chọn đã thay đổi. Vui lòng chọn lại.';
    for (final group in service.optionGroups) {
      final count = options.where((option) => option.groupId == group.id && selectedIds.contains(option.id)).length;
      if (group.isRequired && count == 0) return 'Vui lòng chọn tùy chọn trong nhóm “${group.name}”.';
      if (group.selectionMode == 'single' && count > 1) return 'Nhóm “${group.name}” chỉ được chọn một tùy chọn.';
    }
    if (service.optionGroups.isEmpty && service.requiresOptionSelection && options.isNotEmpty && selectedIds.isEmpty) {
      return 'Vui lòng chọn tùy chọn dịch vụ.';
    }
    final legacyGroups = <String, int>{};
    for (final option in options.where((option) => option.groupId == null && option.selectionMode == 'single' && selectedIds.contains(option.id))) {
      final key = option.selectionGroup?.trim().toLowerCase();
      if (key != null && key.isNotEmpty) legacyGroups[key] = (legacyGroups[key] ?? 0) + 1;
    }
    if (legacyGroups.values.any((count) => count > 1)) return 'Mỗi nhóm chọn một chỉ được chọn một tùy chọn.';
    return null;
  }
}
