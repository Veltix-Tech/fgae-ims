
import { Router } from "express";

import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

import { permissionChecker } from "./accessService.js";
import { PERMISSIONS } from "./permissions.js";

import {
  loginSchema,
  createStaffSchema,
} from "./auth.validation.js";

import {
  login,
  refresh,
  logout,
  createStaff,
} from "./auth.controller.js";

const router = Router();

// Public authentication routes.
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);

// Protected staff account creation.
router.post(
  "/staff",
  authenticate,
  authorize(PERMISSIONS.USER_CREATE, permissionChecker),
  validate(createStaffSchema),
  createStaff,
);

export default router;
