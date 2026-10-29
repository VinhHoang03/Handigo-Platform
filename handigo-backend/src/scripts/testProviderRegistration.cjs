const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { Types } = require('mongoose');

// Kiểm tra luồng đăng ký bằng service thật, không kết nối database hay gửi email.
function load(file, resolve) {
  const context = { exports: {}, require: resolve, Date, URL,
    process: { env: { ACCESS_TOKEN_SECRET: 'secret-gia-chi-dung-kiem-thu' } } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, context);
  return context.exports;
}
const role = load(path.join(__dirname, '../utils/userRole.ts'), () => ({}));
const navigation = load(path.join(__dirname, '../../../handigo-web/src/features/auth/utils/roleNavigation.ts'), () => ({}));
class AppError extends Error {
  constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
}
let user;
let sessions = 0;
let updates = 0;
const users = {
  findOne: async () => user,
  findOneAndUpdate: async (filter, update, options) => {
    assert.equal(filter.isEmailVerified, false);
    assert.equal(options.runValidators, true);
    updates++;
    Object.assign(user, update.$set);
    for (const field of Object.keys(update.$unset)) delete user[field];
    return user;
  },
};
const auth = load(path.join(__dirname, '../services/auth.service.ts'), name => {
  if (name === '../models/user.model') return { default: users, __esModule: true };
  if (name === '../models/session.model') return { Session: { updateOne: async () => { sessions++; } } };
  if (name === '../utils/userRole') return role;
  if (name === '../utils/appError') return { AppError };
  if (name === '../utils/otp') return { hashOtp: value => `ma-kiem-thu:${value}` };
  if (name === '../utils/token') return { signAccessToken: account => account.role, signRefreshToken: () => 'phien-kiem-thu' };
  if (name === 'jsonwebtoken') return { decode: () => ({ exp: Math.floor(Date.now() / 1000) + 3600 }) };
  if (name.startsWith('.')) return {};
  return require(name);
});
const { authMiddleware } = load(path.join(__dirname, '../middlewares/auth.middleware.ts'), name => {
  if (name === 'jsonwebtoken') return { verify: () => ({ id: user._id.toString() }) };
  if (name === '../models/user.model') return { default: users, __esModule: true };
  if (name === '../utils/userRole') return role;
  if (name === '../utils/token') return { isTokenVersionCurrent: () => true };
  if (name === '../services/penaltyPolicy.service') return { refreshAccountLock: async () => {} };
  if (name === '../utils/orderActorContext') return { orderActorContext: { run: (_actor, next) => next() } };
  return {};
});
const { roleMiddleware } = load(path.join(__dirname, '../middlewares/role.middleware.ts'), () => ({}));
async function authenticatedRole() {
  const req = { headers: { authorization: 'Bearer ma-kiem-thu' } };
  // Secret giả chỉ tồn tại trong môi trường VM của kiểm thử.
  return new Promise((resolve, reject) => {
    authMiddleware(req, { status: () => ({ json: reject }) }, error => error ? reject(error) : resolve(req));
  });
}
function applicant(intent) {
  return { _id: new Types.ObjectId(), email: 'dang-ky@example.com', role: 'CUSTOMER',
    registrationIntent: intent, isEmailVerified: false, registerOtp: 'ma-kiem-thu:123456',
    registerOtpExpire: new Date(Date.now() + 60000) };
}
async function run() {
  user = applicant('PROVIDER');
  const registered = await auth.verifyRegisterOtp(user.email, '123456');
  assert.equal(registered.user.role, 'CUSTOMER');
  assert.equal(registered.token, 'CUSTOMER');
  assert.equal(registered.user.providerOnboardingStatus, 'PROFILE_INCOMPLETE');
  assert.equal(user.role, 'CUSTOMER');
  assert.equal(user.registrationIntent, undefined);
  assert.equal(sessions, 1);
  user = applicant('CUSTOMER');
  assert.equal(await auth.verifyRegisterOtp(user.email, '123456'), null);
  assert.equal(user.role, 'CUSTOMER');
  assert.equal(sessions, 1);
  user = applicant('PROVIDER');
  await assert.rejects(() => auth.verifyRegisterOtp(user.email, '000000'));
  assert.equal(updates, 2);
  user.registerOtpExpire = new Date(0);
  await assert.rejects(() => auth.verifyRegisterOtp(user.email, '123456'));
  assert.equal(updates, 2);
  for (const status of ['PROFILE_INCOMPLETE', 'PENDING_REVIEW', 'REJECTED']) {
    assert.equal(role.getEffectiveUserRole({ role: 'PROVIDER', providerOnboardingStatus: status }), 'CUSTOMER');
    assert.equal(role.getEffectiveUserRole({ role: 'ADMIN', providerOnboardingStatus: status }), 'ADMIN');
    user = { ...applicant('PROVIDER'), role: 'PROVIDER', status: 'active', providerOnboardingStatus: status };
    const req = await authenticatedRole();
    assert.equal(req.user.role, 'CUSTOMER');
    let denied = false;
    roleMiddleware('PROVIDER')(req, { status: code => {
      assert.equal(code, 403);
      return { json: () => { denied = true; } };
    } }, () => assert.fail('Tài khoản chưa duyệt không được truy cập chức năng thợ.'));
    assert.equal(denied, true);
  }
  for (const status of [undefined, null, 'APPROVED']) {
    assert.equal(role.getEffectiveUserRole({ role: 'PROVIDER', providerOnboardingStatus: status }), 'PROVIDER');
  }
  assert.equal(navigation.getRoleHomePath('CUSTOMER', 'PROFILE_INCOMPLETE'), '/register-provider');
  assert.equal(navigation.getRoleHomePath('CUSTOMER', 'PENDING_REVIEW'), '/customer/profile?tab=applications');
  assert.equal(navigation.getRoleHomePath('PROVIDER', 'PENDING_REVIEW'), '/customer/profile?tab=applications');
  assert.equal(navigation.getRoleHomePath('CUSTOMER', 'REJECTED'), '/register-provider');
  assert.equal(navigation.getRoleHomePath('PROVIDER', 'APPROVED'), '/provider');
  user.providerOnboardingStatus = 'APPROVED';
  const approved = await authenticatedRole();
  let allowed = false;
  roleMiddleware('PROVIDER')(approved, {}, () => { allowed = true; });
  assert.equal(allowed, true);
  console.log('Đã kiểm tra OTP đăng ký, quyền trước/sau duyệt và điều hướng hồ sơ thợ.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
