enum UserRole {
  customer('Khách hàng'), provider('Nhà cung cấp'), admin('Quản trị viên');
  const UserRole(this.label);
  final String label;
  static UserRole parse(String value) => switch (value.toUpperCase()) {
    'CUSTOMER' => customer, 'PROVIDER' => provider, 'ADMIN' => admin,
    _ => throw const FormatException('Vai trò tài khoản không hợp lệ.'),
  };
}

class AppUser {
  const AppUser({required this.id, required this.fullName, required this.email,
    required this.role, this.providerOnboardingStatus});
  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: (json['id'] ?? json['_id']) as String,
    fullName: json['fullName'] as String,
    email: json['email'] as String,
    role: UserRole.parse(json['role'] as String),
    providerOnboardingStatus: json['providerOnboardingStatus'] as String?,
  );
  final String id;
  final String fullName;
  final String email;
  final UserRole role;
  final String? providerOnboardingStatus;
  bool get canViewOrders => role == UserRole.customer ||
      (role == UserRole.provider && providerOnboardingStatus == 'APPROVED');
}
