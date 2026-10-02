String? usableMediaUrl(String? value) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) return null;
  final lower = normalized.toLowerCase();
  if (lower == 'null' || lower == 'undefined' || lower == 'file:///null') {
    return null;
  }
  return normalized;
}
