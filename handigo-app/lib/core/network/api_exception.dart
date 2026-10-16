import 'package:dio/dio.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  factory ApiException.fromDio(DioException error) {
    final status = error.response?.statusCode;
    final responseData = error.response?.data;
    final backendMessage = responseData is Map<String, dynamic>
        ? responseData['message']
        : null;
    if (backendMessage is String && backendMessage.trim().isNotEmpty) {
      return ApiException(_translateBackendMessage(backendMessage), statusCode: status);
    }
    return ApiException(switch (status) {
      400 || 422 => 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
      401 => 'Thông tin đăng nhập hoặc phiên làm việc không hợp lệ.',
      403 => 'Bạn chưa có quyền sử dụng chức năng này.',
      404 => 'Không tìm thấy dữ liệu yêu cầu.',
      409 => 'Dữ liệu đã thay đổi. Vui lòng tải lại.',
      429 => 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
      null => 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
      _ => 'Máy chủ chưa thể xử lý yêu cầu. Vui lòng thử lại sau.',
    }, statusCode: status);
  }

  static String _translateBackendMessage(String message) => switch (message) {
    'Invalid email or password' => 'Email hoặc mật khẩu không đúng.',
    'Email is not verified' => 'Email chưa được xác thực.',
    'Email is already registered' => 'Email đã được đăng ký.',
    'OTP has expired' => 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.',
    'Invalid OTP' => 'Mã OTP không đúng.',
    'Password reset successfully' => 'Đặt lại mật khẩu thành công.',
    'Registration OTP has been sent to your email' => 'Mã OTP đã được gửi đến email của bạn.',
    'Registration OTP has been resent' => 'Mã OTP mới đã được gửi đến email của bạn.',
    _ => message,
  };
  @override
  String toString() => message;
}
