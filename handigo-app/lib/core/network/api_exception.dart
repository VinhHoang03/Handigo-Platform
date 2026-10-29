import 'package:dio/dio.dart';
import 'http_error_messages.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.code});
  final String message;
  final int? statusCode;
  final String? code;

  String get diagnosticMessage {
    final details = [
      if (statusCode != null) 'HTTP $statusCode',
      if (code != null && code != 'HTTP_$statusCode') code!,
    ];
    return details.isEmpty ? message : '$message (${details.join(' · ')})';
  }

  factory ApiException.fromDio(DioException error) {
    final status = error.response?.statusCode;
    final responseData = error.response?.data;
    final rawCode = responseData is Map ? responseData['code'] : null;
    final code = rawCode is String && rawCode.trim().isNotEmpty
        ? rawCode.trim()
        : status != null
        ? 'HTTP_$status'
        : switch (error.type) {
            DioExceptionType.connectionTimeout => 'CONNECTION_TIMEOUT',
            DioExceptionType.sendTimeout => 'SEND_TIMEOUT',
            DioExceptionType.receiveTimeout => 'RECEIVE_TIMEOUT',
            DioExceptionType.cancel => 'REQUEST_CANCELLED',
            DioExceptionType.badCertificate => 'INVALID_CERTIFICATE',
            DioExceptionType.connectionError => 'CONNECTION_FAILED',
            _ => 'NETWORK_ERROR',
          };
    final backendMessage = responseData is Map<String, dynamic>
        ? responseData['message']
        : null;
    if (backendMessage is String &&
        backendMessage.trim().isNotEmpty &&
        !{
          'lỗi máy chủ nội bộ',
          'internal server error',
        }.contains(backendMessage.trim().toLowerCase())) {
      return ApiException(
        _translateBackendMessage(backendMessage),
        statusCode: status,
        code: code,
      );
    }
    final message = status != null
        ? httpErrorMessage(status)
        : switch (error.type) {
            DioExceptionType.connectionTimeout =>
              'Kết nối đến máy chủ quá lâu. Vui lòng thử lại.',
            DioExceptionType.sendTimeout =>
              'Gửi dữ liệu mất quá lâu. Vui lòng thử lại.',
            DioExceptionType.receiveTimeout =>
              'Máy chủ phản hồi quá chậm. Vui lòng thử lại.',
            DioExceptionType.cancel => 'Yêu cầu đã được hủy.',
            DioExceptionType.badCertificate =>
              'Chứng chỉ bảo mật của máy chủ không hợp lệ.',
            DioExceptionType.connectionError =>
              'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
            _ => httpErrorMessage(null),
          };
    return ApiException(message, statusCode: status, code: code);
  }

  static String _translateBackendMessage(String message) => switch (message) {
    'Invalid email or password' => 'Email hoặc mật khẩu không đúng.',
    'Email is not verified' => 'Email chưa được xác thực.',
    'Email is already registered' => 'Email đã được đăng ký.',
    'OTP has expired' => 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.',
    'Invalid OTP' => 'Mã OTP không đúng.',
    'Password reset successfully' => 'Đặt lại mật khẩu thành công.',
    'Registration OTP has been sent to your email' =>
      'Mã OTP đã được gửi đến email của bạn.',
    'Registration OTP has been resent' =>
      'Mã OTP mới đã được gửi đến email của bạn.',
    _ => message,
  };
  @override
  String toString() => message;
}
