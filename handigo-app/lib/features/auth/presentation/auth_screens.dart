import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/providers/app_providers.dart';
import '../../../app/theme/app_theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/app_feedback.dart';
import 'otp_code_input.dart';

enum OtpMode { register, resetPassword }

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator.adaptive()));
}

class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    required this.title,
    required this.child,
    this.showBackButton = true,
    this.showHeader = true,
    this.showCard = true,
    this.statusText = '',
    super.key,
  });
  final String title;
  final Widget child;
  final bool showBackButton;
  final bool showHeader;
  final bool showCard;
  final String statusText;

  void _goBack(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: const Color(0xFFF9F7FF),
      body: SafeArea(
        child: Column(
          children: [
            if (showHeader)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(
                  children: [
                    if (showBackButton)
                      _RoundIconButton(
                        icon: Icons.arrow_back,
                        tooltip: 'Quay lại',
                        onPressed: () => _goBack(context),
                      )
                    else
                      const SizedBox.square(dimension: 44),
                    if (statusText.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEDEAFF),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: AppTheme.successGreen,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 7),
                            Text(
                              statusText,
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: const Color(0xFF4C4658),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    const Spacer(),
                  ],
                ),
              ),
            Expanded(
              child: Align(
                alignment: showHeader ? Alignment.topCenter : Alignment.center,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 460),
                    child: showCard
                        ? Container(
                            padding: const EdgeInsets.fromLTRB(24, 24, 24, 22),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(
                                color: const Color(0xFFE8E3F2),
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x1A20164D),
                                  blurRadius: 24,
                                  offset: Offset(0, 12),
                                ),
                              ],
                            ),
                            child: _content(theme),
                          )
                        : _content(theme),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Text(
                '© 2026 Handigo · Bảo mật · Điều khoản',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: const Color(0xFF777184),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _content(ThemeData theme) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const _HandigoMark(),
      const SizedBox(height: 18),
      Text(
        title,
        textAlign: TextAlign.center,
        style: theme.textTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w700,
          color: const Color(0xFF17132D),
        ),
      ),
      const SizedBox(height: 8),
      child,
    ],
  );
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: tooltip,
    child: IconButton.filledTonal(
      onPressed: onPressed,
      icon: Icon(icon, size: 21),
      style: IconButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF17132D),
        fixedSize: const Size(44, 44),
        shape: const CircleBorder(),
      ),
    ),
  );
}

class _HandigoMark extends StatelessWidget {
  const _HandigoMark();

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: const Color(0xFF3928D5),
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [
            BoxShadow(
              color: Color(0x333928D5),
              blurRadius: 10,
              offset: Offset(0, 5),
            ),
          ],
        ),
        child: const Icon(
          Icons.handyman_rounded,
          color: Colors.white,
          size: 27,
        ),
      ),
      const SizedBox(width: 10),
      Text(
        'Handigo',
        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
          color: const Color(0xFF2F20BD),
          fontWeight: FontWeight.w800,
          letterSpacing: -0.5,
        ),
      ),
    ],
  );
}

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.onPressed,
  });
  final String label;
  final Widget icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => OutlinedButton.icon(
    onPressed: onPressed,
    icon: icon,
    label: Text(label),
    style: OutlinedButton.styleFrom(
      backgroundColor: const Color(0xFFF5F3FF),
      foregroundColor: const Color(0xFF26213B),
      side: const BorderSide(color: Color(0xFFE1DDF1)),
      minimumSize: const Size(0, 52),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}

class AuthError extends StatelessWidget {
  const AuthError({required this.message, super.key});
  final String? message;

  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(message!),
    );
  }
}

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    await ref
        .read(authControllerProvider)
        .login(_email.text.trim(), _password.text);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    return AuthScaffold(
      title: 'Chào mừng trở lại!',
      showHeader: false,
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 22),
            const _AuthFieldLabel('Email'),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: 'ban@vidu.com',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              validator: _emailValidator,
            ),
            const SizedBox(height: 16),
            const _AuthFieldLabel('Mật khẩu'),
            TextFormField(
              controller: _password,
              obscureText: _obscure,
              decoration: InputDecoration(
                hintText: 'Nhập mật khẩu của bạn',
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  icon: Icon(
                    _obscure ? Icons.visibility : Icons.visibility_off,
                  ),
                ),
              ),
              validator: (value) => value == null || value.isEmpty
                  ? 'Vui lòng nhập mật khẩu'
                  : null,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Checkbox(value: true, onChanged: (_) {}),
                const Expanded(child: Text('Ghi nhớ đăng nhập')),
                Expanded(
                  child: TextButton(
                    onPressed: () => context.push('/forgot-password'),
                    child: const Text('Quên mật khẩu?'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            AuthError(message: auth.message),
            FilledButton(
              onPressed: _busy ? null : _submit,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              child: _busy
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator.adaptive(),
                    )
                  : const Text('Đăng nhập'),
            ),
            ...[
              const SizedBox(height: 20),
              const _AuthDivider(label: 'HOẶC'),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _SocialButton(
                      label: 'Google',
                      icon: const _GoogleMark(),
                      onPressed: _busy
                          ? null
                          : () => _showSocialNotice('Google'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _SocialButton(
                      label: 'Facebook',
                      icon: const Icon(
                        Icons.facebook,
                        size: 20,
                        color: Color(0xFF1877F2),
                      ),
                      onPressed: _busy
                          ? null
                          : () => _showSocialNotice('Facebook'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text('Chưa có tài khoản? '),
                  TextButton(
                    onPressed: _busy ? null : () => context.push('/register'),
                    child: const Text('Đăng ký ngay'),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showSocialNotice(
    String provider,
  ) => AppToast.show(
    context,
    'Đăng nhập $provider sẽ hoạt động sau khi cấu hình OAuth cho ứng dụng.',
  );
}

class _AuthDivider extends StatelessWidget {
  const _AuthDivider({this.label = 'Hoặc đăng nhập với'});
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      const Expanded(child: Divider(color: Color(0xFFE8E3F2))),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.labelSmall?.copyWith(color: const Color(0xFF777184)),
        ),
      ),
      const Expanded(child: Divider(color: Color(0xFFE8E3F2))),
    ],
  );
}

class _AuthFieldLabel extends StatelessWidget {
  const _AuthFieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      text,
      textAlign: TextAlign.left,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
        color: const Color(0xFF26213B),
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) => const SizedBox.square(
    dimension: 20,
    child: CustomPaint(painter: _GoogleMarkPainter()),
  );
}

class _GoogleMarkPainter extends CustomPainter {
  const _GoogleMarkPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 24, size.height / 24);
    final blue = Path()
      ..moveTo(22.56, 12.25)
      ..cubicTo(22.56, 11.47, 22.49, 10.72, 22.36, 10)
      ..lineTo(12, 10)
      ..lineTo(12, 14.26)
      ..lineTo(17.92, 14.26)
      ..cubicTo(17.66, 15.63, 16.88, 16.79, 15.71, 17.57)
      ..lineTo(15.71, 20.34)
      ..lineTo(19.28, 20.34)
      ..cubicTo(21.36, 18.42, 22.56, 15.60, 22.56, 12.25)
      ..close();
    final green = Path()
      ..moveTo(12, 23)
      ..cubicTo(14.97, 23, 17.46, 22.02, 19.28, 20.34)
      ..lineTo(15.71, 17.57)
      ..cubicTo(14.73, 18.23, 13.48, 18.63, 12, 18.63)
      ..cubicTo(9.14, 18.63, 6.71, 16.70, 5.84, 14.10)
      ..lineTo(2.18, 14.10)
      ..lineTo(2.18, 16.94)
      ..cubicTo(3.99, 20.53, 7.70, 23, 12, 23)
      ..close();
    final yellow = Path()
      ..moveTo(5.84, 14.10)
      ..cubicTo(5.62, 13.44, 5.49, 12.74, 5.49, 12)
      ..cubicTo(5.49, 11.26, 5.62, 10.56, 5.84, 9.90)
      ..lineTo(5.84, 7.06)
      ..lineTo(2.18, 7.06)
      ..cubicTo(1.43, 8.55, 1, 10.22, 1, 12)
      ..cubicTo(1, 13.78, 1.43, 15.45, 2.18, 16.94)
      ..close();
    final red = Path()
      ..moveTo(12, 5.38)
      ..cubicTo(13.62, 5.38, 15.06, 5.94, 16.21, 7.02)
      ..lineTo(19.36, 3.87)
      ..cubicTo(17.45, 2.09, 14.97, 1, 12, 1)
      ..cubicTo(7.70, 1, 3.99, 3.47, 2.18, 7.06)
      ..lineTo(5.84, 9.90)
      ..cubicTo(6.71, 7.31, 9.14, 5.38, 12, 5.38)
      ..close();
    canvas.drawPath(blue, Paint()..color = const Color(0xFF4285F4));
    canvas.drawPath(green, Paint()..color = const Color(0xFF34A853));
    canvas.drawPath(yellow, Paint()..color = const Color(0xFFFBBC05));
    canvas.drawPath(red, Paint()..color = const Color(0xFFEA4335));
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GoogleMarkPainter oldDelegate) => false;
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});
  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _email = TextEditingController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;
  bool _obscure = true;

  int get _passwordStrength {
    final value = _password.text;
    if (value.isEmpty) return 0;
    var score = 0;
    if (value.length >= 8) score++;
    if (RegExp(r'[a-z]').hasMatch(value)) score++;
    if (RegExp(r'[A-Z]').hasMatch(value)) score++;
    if (RegExp(r'[0-9]').hasMatch(value)) score++;
    if (RegExp(r'[^a-zA-Z0-9]').hasMatch(value)) score++;
    return score > 4 ? 4 : score;
  }

  String get _passwordStrengthLabel => switch (_passwordStrength) {
    0 => 'Chưa nhập',
    1 => 'Yếu',
    2 => 'Trung bình',
    3 => 'Tốt',
    _ => 'Rất tốt',
  };

  String get _passwordStrengthHint {
    final missing = <String>[];
    if (_password.text.length < 8) missing.add('8 ký tự');
    if (!RegExp(r'[a-z]').hasMatch(_password.text)) missing.add('chữ thường');
    if (!RegExp(r'[A-Z]').hasMatch(_password.text)) missing.add('chữ hoa');
    if (!RegExp(r'[0-9]').hasMatch(_password.text)) missing.add('chữ số');
    return missing.isEmpty
        ? 'Đủ các nhóm ký tự'
        : 'Nên thêm ${missing.take(2).join(' và ')}';
  }

  @override
  void dispose() {
    for (final controller in [_email, _name, _phone, _password, _confirm]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    final otpExpiresAt = DateTime.now().add(const Duration(minutes: 10));
    setState(() => _busy = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .register(
            email: _email.text.trim(),
            password: _password.text,
            fullName: _name.text.trim(),
            phone: _phone.text.trim(),
          );
      if (mounted)
        context.push(
          '/register/otp?email=${Uri.encodeComponent(_email.text.trim())}',
          extra: otpExpiresAt,
        );
    } on ApiException catch (error) {
      if (mounted) _showError(error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showError(String message) => AppToast.show(context, message, type: AppToastType.error);

  @override
  Widget build(BuildContext context) => AuthScaffold(
    title: 'Tạo tài khoản mới',
    showCard: false,
    child: Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Trải nghiệm hơn 30+ dịch vụ sửa chữa và chăm sóc nhà cửa tận nơi',
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: const Color(0xFF777184)),
          ),
          const SizedBox(height: 22),
          const _AuthFieldLabel('Họ và tên'),
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(
              hintText: 'Nguyễn Văn A',
              prefixIcon: Icon(Icons.person_outline),
            ),
            validator: (value) => value == null || value.trim().length < 2
                ? 'Vui lòng nhập họ và tên'
                : null,
          ),
          const SizedBox(height: 16),
          const _AuthFieldLabel('Email'),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              hintText: 'ban@vidu.com',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: _emailValidator,
          ),
          const SizedBox(height: 16),
          const _AuthFieldLabel('Số điện thoại di động'),
          TextFormField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              hintText: '0912 345 678',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Dùng để nhận mã OTP và thợ liên hệ khi đến nhà',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: const Color(0xFF777184)),
          ),
          const SizedBox(height: 16),
          const _AuthFieldLabel('Mật khẩu'),
          TextFormField(
            controller: _password,
            obscureText: _obscure,
            decoration: InputDecoration(
              hintText: 'Tối thiểu 8 ký tự, gồm chữ và số',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                onPressed: () => setState(() => _obscure = !_obscure),
                icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
              ),
            ),
            onChanged: (_) => setState(() {}),
            validator: _passwordValidator,
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              ...List.generate(
                4,
                (index) => Expanded(
                  child: Container(
                    height: 4,
                    margin: EdgeInsets.only(right: index == 3 ? 0 : 4),
                    decoration: BoxDecoration(
                      color: index < _passwordStrength
                          ? const Color(0xFF3928D5)
                          : const Color(0xFFE1DDF1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Độ an toàn: $_passwordStrengthLabel',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              Text(
                _passwordStrengthHint,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          const SizedBox(height: 16),
          const _AuthFieldLabel('Xác nhận mật khẩu'),
          TextFormField(
            controller: _confirm,
            obscureText: true,
            decoration: const InputDecoration(
              hintText: 'Nhập lại mật khẩu vừa đặt',
              prefixIcon: Icon(Icons.lock_reset_outlined),
            ),
            validator: (value) =>
                value != _password.text ? 'Mật khẩu xác nhận không khớp' : null,
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: _busy ? null : _submit,
            icon: const Icon(Icons.arrow_forward_rounded),
            label: _busy
                ? const SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator.adaptive(),
                  )
                : const Text('Tiếp tục / Đăng ký'),
          ),
          const SizedBox(height: 14),
          const _AuthDivider(label: 'Hoặc đăng ký nhanh bằng'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _SocialButton(
                  label: 'Google',
                  icon: const _GoogleMark(),
                  onPressed: _busy
                      ? null
                      : () => _showRegisterSocialNotice(context, 'Google'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _SocialButton(
                  label: 'Facebook',
                  icon: const Icon(
                    Icons.facebook,
                    size: 20,
                    color: Color(0xFF1877F2),
                  ),
                  onPressed: _busy
                      ? null
                      : () => _showRegisterSocialNotice(context, 'Facebook'),
                ),
              ),
            ],
          ),
          TextButton(
            onPressed: _busy ? null : () => context.go('/login'),
            child: const Text('Đã có tài khoản? Đăng nhập'),
          ),
        ],
      ),
    ),
  );

  void _showRegisterSocialNotice(BuildContext context, String provider) => AppToast.show(
    context,
    'Đăng ký $provider sẽ hoạt động sau khi cấu hình OAuth.',
  );
}

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    final otpExpiresAt = DateTime.now().add(const Duration(minutes: 10));
    setState(() => _busy = true);
    try {
      await ref.read(authRepositoryProvider).forgotPassword(_email.text.trim());
      if (mounted) {
        AppToast.show(
          context,
          'Mã OTP đặt lại đã được gửi đến email của bạn.',
          type: AppToastType.success,
        );
        context.push(
          '/forgot-password/reset?email=${Uri.encodeComponent(_email.text.trim())}',
          extra: otpExpiresAt,
        );
      }
    } on ApiException catch (error) {
      if (mounted)
        AppToast.show(context, error.message, type: AppToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Quên mật khẩu',
      statusText: '',
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            Align(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: const Color(0xFFEDEAFF),
                  shape: BoxShape.circle,
                  boxShadow: const [
                    BoxShadow(color: Color(0x263928D5), blurRadius: 18),
                  ],
                ),
                child: const Icon(
                  Icons.shield_outlined,
                  size: 38,
                  color: Color(0xFF3928D5),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Nhập email đã đăng ký để nhận mã OTP và khôi phục tài khoản.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            const _AuthFieldLabel('Email'),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(
                hintText: 'ban@vidu.com',
                prefixIcon: Icon(Icons.email_outlined),
              ),
              validator: _emailValidator,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox.square(
                      dimension: 22,
                      child: CircularProgressIndicator.adaptive(),
                    )
                  : const Text('Gửi mã OTP'),
            ),
          ],
        ),
      ),
    );
  }
}

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({
    required this.email,
    required this.mode,
    this.expiresAt,
    super.key,
  });
  final String email;
  final OtpMode mode;
  final DateTime? expiresAt;
  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _otp = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;
  bool _resending = false;
  Timer? _timer;
  late DateTime _expiresAt;
  late DateTime _resendAvailableAt;

  @override
  void initState() {
    super.initState();
    _expiresAt =
        widget.expiresAt ?? DateTime.now().add(const Duration(minutes: 10));
    _resendAvailableAt = _expiresAt.subtract(const Duration(minutes: 9));
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  int _secondsUntil(DateTime deadline) {
    final seconds = (deadline.difference(DateTime.now()).inMilliseconds / 1000)
        .ceil();
    return seconds > 0 ? seconds : 0;
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      if (widget.mode == OtpMode.register) {
        final ok = await ref
            .read(authControllerProvider)
            .verifyRegisterOtp(widget.email, _otp.text.trim());
        if (!mounted) return;
        if (!ok) {
          AppToast.show(
            context,
            ref.read(authControllerProvider).message ?? 'Không thể xác thực mã OTP.',
            type: AppToastType.error,
          );
        } else if (ref.read(authControllerProvider).isAuthenticated) {
          context.go('/customer');
        } else {
          AppToast.show(
            context,
            'Email đã được xác thực. Bạn có thể đăng nhập.',
            type: AppToastType.success,
          );
          context.go('/login');
        }
      } else {
        await ref
            .read(authRepositoryProvider)
            .verifyResetPasswordOtp(widget.email, _otp.text.trim());
        if (mounted) {
          await context.push(
            '/forgot-password/new-password',
            extra: ResetPasswordArguments(
              email: widget.email,
              otp: _otp.text.trim(),
            ),
          );
        }
      }
    } on ApiException catch (error) {
      if (mounted)
        AppToast.show(context, error.message, type: AppToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    if (_busy || _resending || _secondsUntil(_resendAvailableAt) > 0) return;
    setState(() => _resending = true);
    final expiresAt = DateTime.now().add(const Duration(minutes: 10));
    try {
      final repository = ref.read(authRepositoryProvider);
      if (widget.mode == OtpMode.resetPassword) {
        await repository.forgotPassword(widget.email);
      } else {
        await repository.resendRegisterOtp(widget.email);
      }
      if (mounted) {
        _otp.clear();
        setState(() {
          _expiresAt = expiresAt;
          _resendAvailableAt = DateTime.now().add(const Duration(seconds: 60));
        });
        AppToast.show(
          context,
          widget.mode == OtpMode.resetPassword
              ? 'Mã OTP mới đã được gửi. Vui lòng kiểm tra cả thư rác.'
              : 'Mã OTP mới đã được gửi qua email. Vui lòng kiểm tra cả thư rác.',
          type: AppToastType.success,
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        AppToast.show(context, error.message, type: AppToastType.error);
      }
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reset = widget.mode == OtpMode.resetPassword;
    final remainingSeconds = _secondsUntil(_expiresAt);
    final resendSeconds = _secondsUntil(_resendAvailableAt);
    final remainingTime =
        '${remainingSeconds ~/ 60}:${(remainingSeconds % 60).toString().padLeft(2, '0')}';
    return AuthScaffold(
      title: reset ? 'Xác thực mã OTP' : 'Xác thực email',
      statusText: '',
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F3FF),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE1DDF1)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.email_outlined, color: Color(0xFF3928D5)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text('Mã xác thực đã gửi đến\n${widget.email}'),
                  ),
                  TextButton(
                    onPressed: _busy || _resending ? null : () => context.pop(),
                    child: const Text('Đổi email'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            const _AuthFieldLabel('Mã OTP gồm 6 chữ số'),
            OtpCodeInput(
              controller: _otp,
              enabled: !_busy && !_resending && remainingSeconds > 0,
              validator: (value) {
                if (_secondsUntil(_expiresAt) == 0)
                  return 'Mã OTP đã hết hạn. Vui lòng gửi lại mã.';
                return value == null || !RegExp(r'^[0-9]{6}$').hasMatch(value)
                    ? 'Vui lòng nhập đủ 6 chữ số OTP'
                    : null;
              },
            ),
            const SizedBox(height: 12),
            Text(
              remainingSeconds > 0
                  ? 'Mã OTP hết hạn sau $remainingTime'
                  : 'Mã OTP đã hết hạn. Vui lòng gửi lại mã.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: remainingSeconds == 0
                    ? Theme.of(context).colorScheme.error
                    : null,
              ),
            ),
            TextButton(
              onPressed: _busy || _resending || resendSeconds > 0
                  ? null
                  : _resend,
              child: Text(
                _resending
                    ? 'Đang gửi mã...'
                    : resendSeconds > 0
                    ? 'Gửi lại mã OTP sau ${resendSeconds}s'
                    : 'Gửi lại mã OTP',
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _busy || _resending || remainingSeconds == 0
                  ? null
                  : _submit,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: _busy
                  ? const SizedBox.square(
                      dimension: 22,
                      child: CircularProgressIndicator.adaptive(),
                    )
                  : const Text('Xác thực mã OTP'),
            ),
          ],
        ),
      ),
    );
  }
}

class ResetPasswordArguments {
  const ResetPasswordArguments({required this.email, required this.otp});
  final String email;
  final String otp;
}

class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({required this.arguments, super.key});
  final ResetPasswordArguments arguments;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;
  bool _obscurePassword = true;
  bool _obscureConfirm = true;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .resetPassword(
            email: widget.arguments.email,
            otp: widget.arguments.otp,
            newPassword: _password.text,
          );
      if (!mounted) return;
      AppToast.show(
        context,
        'Đặt lại mật khẩu thành công.',
        type: AppToastType.success,
      );
      context.go('/login');
    } on ApiException catch (error) {
      if (mounted)
        AppToast.show(context, error.message, type: AppToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthScaffold(
    title: 'Đặt lại mật khẩu',
    statusText: '',
    child: Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 16),
          const _AuthFieldLabel('Mật khẩu mới'),
          TextFormField(
            controller: _password,
            enabled: !_busy,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              hintText: 'Tối thiểu 8 ký tự',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                onPressed: () =>
                    setState(() => _obscurePassword = !_obscurePassword),
                icon: Icon(
                  _obscurePassword ? Icons.visibility : Icons.visibility_off,
                ),
              ),
            ),
            validator: _passwordValidator,
          ),
          const SizedBox(height: 16),
          const _AuthFieldLabel('Xác nhận mật khẩu mới'),
          TextFormField(
            controller: _confirm,
            enabled: !_busy,
            obscureText: _obscureConfirm,
            decoration: InputDecoration(
              hintText: 'Nhập lại mật khẩu mới',
              prefixIcon: const Icon(Icons.lock_reset_outlined),
              suffixIcon: IconButton(
                onPressed: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
                icon: Icon(
                  _obscureConfirm ? Icons.visibility : Icons.visibility_off,
                ),
              ),
            ),
            validator: (value) => value == null || value.isEmpty
                ? 'Vui lòng xác nhận mật khẩu mới'
                : value != _password.text
                ? 'Mật khẩu xác nhận không khớp'
                : null,
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator.adaptive(),
                  )
                : const Text('Đặt lại mật khẩu'),
          ),
          TextButton(
            onPressed: _busy ? null : () => context.pop(),
            child: const Text('Quay lại bước xác thực OTP'),
          ),
        ],
      ),
    ),
  );
}

String? _emailValidator(String? value) =>
    value == null ||
        !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value.trim())
    ? 'Vui lòng nhập email hợp lệ'
    : null;
String? _passwordValidator(String? value) => value == null || value.length < 8
    ? 'Mật khẩu phải có ít nhất 8 ký tự'
    : null;
