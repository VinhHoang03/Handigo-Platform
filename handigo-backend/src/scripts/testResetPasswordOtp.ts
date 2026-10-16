import assert from "node:assert/strict";
import User from "../models/user.model";
import { verifyResetPasswordOtp } from "../services/auth.service";
import { hashOtp } from "../utils/otp";
import { verifyResetPasswordOtpSchema } from "../validations/auth.validator";

const run = async () => {
  const originalFindOne = User.findOne;
  let user: object | null = {
    resetPasswordOtp: hashOtp("123456"),
    resetPasswordOtpExpire: new Date(Date.now() + 60_000),
  };
  User.findOne = (async () => user) as unknown as typeof User.findOne;
  try {
    await verifyResetPasswordOtp("ban@example.com", "123456");
    await assert.rejects(() => verifyResetPasswordOtp("ban@example.com", "654321"));
    user = { resetPasswordOtp: hashOtp("123456"), resetPasswordOtpExpire: new Date(0) };
    await assert.rejects(() => verifyResetPasswordOtp("ban@example.com", "123456"));
    user = null;
    await assert.rejects(() => verifyResetPasswordOtp("ban@example.com", "123456"));
    assert.equal(verifyResetPasswordOtpSchema.safeParse({ email: "ban@example.com", otp: "12a456" }).success, false);
    assert.equal(verifyResetPasswordOtpSchema.safeParse({ email: "ban@example.com", otp: "12345" }).success, false);
    console.log("Đã kiểm tra OTP đúng, sai, hết hạn, người dùng không tồn tại và validation.");
  } finally {
    User.findOne = originalFindOne;
  }
};

run().catch(() => {
  console.error("Kiểm tra xác thực OTP thất bại.");
  process.exitCode = 1;
});
