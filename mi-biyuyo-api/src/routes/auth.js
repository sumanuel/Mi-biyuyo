const router = require("express").Router();
const ctrl = require("../controllers/authController");
const validate = require("../middleware/validate");
const authGuard = require("../middleware/authGuard");

router.post("/register", ctrl.validateRegister, validate, ctrl.register);
router.post("/login", ctrl.validateLogin, validate, ctrl.login);
router.post(
  "/verify-email",
  ctrl.validateVerifyEmail,
  validate,
  ctrl.verifyEmail,
);
router.post("/resend-code", ctrl.validateResendCode, validate, ctrl.resendCode);
router.post(
  "/forgot-password",
  ctrl.validateForgotPassword,
  validate,
  ctrl.forgotPassword,
);
router.post(
  "/reset-password",
  ctrl.validateResetPassword,
  validate,
  ctrl.resetPassword,
);
router.get("/me", authGuard, ctrl.me);
router.patch("/me", authGuard, ctrl.updateProfile);

module.exports = router;
