import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { loginSchema } from "./auth.validation.js";
import { login } from "./auth.controller.js";

const router = Router();

// POST /auth/login
router.post(
  "/login",
  validate(loginSchema),
  login
);

export default router;