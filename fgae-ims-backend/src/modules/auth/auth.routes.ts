
import { Router } from "express";

import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

import { permissionChecker } from "./accessService.js";
import { PERMISSIONS } from "./permissions.js";

import { activate } from "./auth.controller.js";
import { activateSchema } from "./auth.validation.js";
import { requireTrustedOrigin } from "../../middleware/requireTrustedOrigin.js";

import {
  loginSchema,
  createStaffSchema,
  resendActivationSchema,
} from "./auth.validation.js";

import {
  login,
  refresh,
  logout,
  logoutAll,
  createStaff,
  resendActivation,
  getMe,
} from "./auth.controller.js";

import {
  requestPasswordReset,
  confirmPasswordReset,
} from "./passwordReset.controller.js";

import {
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
} from "./passwordReset.validation.js";

import {
  changePassword,
} from "./changePassword.controller.js";

import {
  changePasswordSchema,
} from "./changePassword.validation.js";

const router = Router();

// Public authentication routes.
router.post(
  "/login",
  requireTrustedOrigin,
  validate(loginSchema),
  login,
);

router.post(
  "/refresh",
  requireTrustedOrigin,
  refresh,
);

router.post(
  "/logout",
  requireTrustedOrigin,
  logout,
);

// Protected current-user endpoint.
router.get("/me", authenticate, getMe);

router.post("/logout-all", authenticate, logoutAll);

router.post(
  "/activate",
  validate(activateSchema),
  activate
);

router.post(
  "/resend-activation",
  validate(resendActivationSchema),
  resendActivation
);

router.post(
  "/forgot-password",
  validate(requestPasswordResetSchema),
  requestPasswordReset,
);

router.post(
  "/reset-password",
  validate(confirmPasswordResetSchema),
  confirmPasswordReset,
);

router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  changePassword,
);

// Protected staff account creation.
router.post(
  "/staff",
  authenticate,
  authorize(PERMISSIONS.USER_CREATE, permissionChecker),
  validate(createStaffSchema),
  createStaff,
);

export default router;
