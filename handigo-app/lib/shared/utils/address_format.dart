bool isMapAddress(String? placeId) =>
    placeId != null &&
    placeId.trim().isNotEmpty &&
    !placeId.startsWith('agent-area:');

String formatAddress(
  String address, {
  String ward = '',
  String province = '',
  bool fromMap = false,
}) {
  final parts = <String>[];
  final administrativePrefix = RegExp(
    r'^(?:Phường|Xã|Thị trấn|Quận|Huyện|Thị xã|Thành phố|Tỉnh|TP\.?)[\s]+',
    caseSensitive: false,
  );
  for (final value in [address, ward, province]) {
    for (final raw in value.split(',')) {
      var part = raw.trim().replaceFirst(administrativePrefix, '').trim();
      if (fromMap) {
        part = part
            .replaceFirst(RegExp(r'^Đường\s+', caseSensitive: false), '')
            .replaceFirstMapped(
              RegExp(r'^(\d+[\w/.-]*)\s+Đường\s+', caseSensitive: false),
              (match) => '${match[1]} ',
            );
      }
      if (part.isNotEmpty &&
          !parts.any((item) => item.toLowerCase() == part.toLowerCase())) {
        parts.add(part);
      }
    }
  }
  parts.removeWhere(
    (part) => RegExp(
      r'^(?:Việt Nam|Vietnam|Viet Nam|VN)$',
      caseSensitive: false,
    ).hasMatch(part),
  );
  // Không loại số nhà ở đầu địa chỉ khi bỏ mã bưu chính.
  for (var i = parts.length - 1; i > 1; i--) {
    if (RegExp(r'^\d{4,6}$').hasMatch(parts[i])) parts.removeAt(i);
  }
  if (parts.length >= 2 && RegExp(r'^\d+[\w/.-]*$').hasMatch(parts.first)) {
    parts[1] = '${parts.first} ${parts[1]}';
    parts.removeAt(0);
  }
  return parts.join(', ');
}

String? formatAddressData(Map<String, dynamic>? address) {
  if (address == null) return null;
  final formatted = formatAddress(
    (address['fullAddress'] ?? address['addressLine'] ?? address['label'])
            as String? ??
        '',
    ward: address['ward'] as String? ?? '',
    province: address['province'] as String? ?? '',
    fromMap: isMapAddress(address['placeId'] as String?),
  );
  return formatted.isEmpty ? null : formatted;
}
