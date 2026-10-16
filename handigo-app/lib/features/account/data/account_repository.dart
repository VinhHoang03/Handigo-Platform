import '../../../core/network/api_client.dart';
import '../../../core/network/paged_result.dart';
import '../domain/account_models.dart';

class AccountRepository {
  const AccountRepository(this._api);
  final ApiClient _api;

  Future<Map<String, dynamic>> profile() async => (await _api.request('/users/me', authenticated: true))['user'] as Map<String, dynamic>;
  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async => (await _api.request('/users/profile', method: 'PUT', data: data, authenticated: true))['data'] as Map<String, dynamic>;
  Future<List<AddressItem>> addresses() async { final data = (await _api.request('/addresses', authenticated: true))['data']; return (data as List<dynamic>? ?? []).map((e) => AddressItem.fromJson(e as Map<String, dynamic>)).toList(); }
  Future<AddressItem> createAddress(Map<String, dynamic> data) async => AddressItem.fromJson((await _api.request('/addresses', method: 'POST', data: data, authenticated: true))['data'] as Map<String, dynamic>);
  Future<AddressItem> updateAddress(String id, Map<String, dynamic> data) async => AddressItem.fromJson((await _api.request('/addresses/$id', method: 'PUT', data: data, authenticated: true))['data'] as Map<String, dynamic>);
  Future<void> deleteAddress(String id) => _api.request('/addresses/$id', method: 'DELETE', authenticated: true).then((_) {});
  Future<WalletInfo> wallet() async => WalletInfo.fromJson((await _api.request('/wallets/me', authenticated: true))['data'] as Map<String, dynamic>);
  Future<PagedResult<WalletTransactionItem>> walletTransactions({int page = 1}) async { final data = (await _api.request('/wallets/me/transactions', query: {'page': page, 'limit': 20}, authenticated: true))['data'] as Map<String, dynamic>; return PagedResult.fromJson(data, WalletTransactionItem.fromJson); }
  Future<Map<String, dynamic>> deposit(double amount) async => (await _api.request('/wallets/me/deposit', method: 'POST', data: {'amount': amount.toInt()}, authenticated: true))['data'] as Map<String, dynamic>;
  Future<List<VoucherItem>> vouchers() async { final data = (await _api.request('/vouchers/available', authenticated: true))['data']; return (data is List ? data : (data is Map ? (data['items'] as List? ?? []) : const [])).map((e) => VoucherItem.fromJson(e as Map<String, dynamic>)).toList(); }
  Future<List<FeedbackItem>> feedbacks() async { final data = (await _api.request('/feedback/me', authenticated: true))['data']; return (data as List<dynamic>? ?? []).map((e) => FeedbackItem.fromJson(e as Map<String, dynamic>)).toList(); }
  Future<FeedbackItem> createFeedback(Map<String, dynamic> data) async => FeedbackItem.fromJson((await _api.request('/feedback', method: 'POST', data: data, authenticated: true))['data'] as Map<String, dynamic>);
  Future<PagedResult<SupportItem>> tickets({int page = 1}) async { final data = (await _api.request('/support-tickets/me', query: {'page': page, 'limit': 20}, authenticated: true))['data'] as Map<String, dynamic>; return PagedResult.fromJson(data, SupportItem.fromJson); }
  Future<SupportItem> createTicket(Map<String, dynamic> data) async => SupportItem.fromJson((await _api.request('/support-tickets', method: 'POST', data: data, authenticated: true))['data'] as Map<String, dynamic>);
  Future<PagedResult<SupportItem>> complaints({int page = 1}) async { final data = (await _api.request('/complaints/me', query: {'page': page, 'limit': 20}, authenticated: true))['data'] as Map<String, dynamic>; return PagedResult.fromJson(data, SupportItem.fromJson); }
  Future<SupportItem> createComplaint(Map<String, dynamic> data) async => SupportItem.fromJson((await _api.request('/complaints', method: 'POST', data: data, authenticated: true))['data'] as Map<String, dynamic>);
}
