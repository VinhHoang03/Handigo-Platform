import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  authMessageRateLimit,
  otpRateLimit,
} from "../middlewares/rateLimit.middleware";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  facebookLoginSchema,
  googleLoginSchema,
  loginSchema,
  registerSchema,
  resendRegisterOtpSchema,
  resetPasswordSchema,
  verifyRegisterOtpSchema,
  verifyResetPasswordOtpSchema,
} from "../validations/auth.validator";

const router = Router();

router.use(
  ["/verify-register-otp", "/verify-reset-password-otp", "/reset-password"],
  otpRateLimit,
);
router.use(
  ["/register", "/resend-register-otp", "/forgot-password"],
  authMessageRateLimit,
);

router.post("/register", validate(registerSchema), authController.register);
router.post(
  "/verify-register-otp",
  validate(verifyRegisterOtpSchema),
  authController.verifyRegisterOtp,
);
router.post(
  "/resend-register-otp",
  validate(resendRegisterOtpSchema),
  authController.resendRegisterOtp,
);
router.post("/login", validate(loginSchema), authController.login);
router.post(
  "/google-login",
  validate(googleLoginSchema),
  authController.googleLogin,
);
router.post(
  "/facebook-login",
  validate(facebookLoginSchema),
  authController.facebookLogin,
);
router.post("/refresh-token", authController.refreshToken);
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.post(
  "/verify-reset-password-otp",
  validate(verifyResetPasswordOtpSchema),
  authController.verifyResetPasswordOtp,
);
router.post(
  "/change-password",
  authMiddleware,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.post("/logout", authController.logout);
router.get("/me", authMiddleware, authController.getProfile);

export default router;
