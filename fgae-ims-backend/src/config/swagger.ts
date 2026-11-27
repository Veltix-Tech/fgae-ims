
const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FGAE-IMS Backend API",
    version: "1.0.0",
    description:
      "API documentation for the FGAE-IMS backend. Authentication uses short-lived JWT access tokens and an HttpOnly refresh-token cookie.",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local development server",
    },
  ],
  tags: [
    {
      name: "Authentication",
      description: "Staff authentication, account activation, and password management",
    },
  ],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Log in",
        description: "Authenticates a staff member and sets the refresh-token cookie.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Login successful. Returns an access token and user information." },
          "401": { description: "Invalid credentials or account cannot log in." },
          "429": { description: "Too many login attempts." },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Authentication"],
        summary: "Refresh access token",
        description: "Uses the HttpOnly refresh-token cookie to rotate the session and issue a new access token.",
        security: [{ RefreshCookie: [] }],
        responses: {
          "200": { description: "Access token refreshed and refresh cookie rotated." },
          "401": { description: "Refresh token is missing, invalid, expired, or revoked." },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Log out",
        description: "Logs out the current refresh-token session and clears the refresh cookie.",
        security: [{ RefreshCookie: [] }],
        responses: {
          "200": { description: "Logout completed." },
          "401": { description: "Refresh token is invalid." },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get current user",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Returns the authenticated user's information." },
          "401": { description: "Authentication required or access token invalid." },
        },
      },
    },
    "/auth/logout-all": {
      post: {
        tags: ["Authentication"],
        summary: "Log out from all devices",
        description: "Revokes all active sessions belonging to the authenticated user.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "All active sessions revoked." },
          "401": { description: "Authentication required." },
        },
      },
    },
    "/auth/activate": {
      post: {
        tags: ["Authentication"],
        summary: "Activate staff account",
        description: "Uses an invitation token to activate an account and set its password.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ActivateRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Account activated successfully." },
          "400": { description: "Invalid, expired, or already-used activation token." },
        },
      },
    },
    "/auth/resend-activation": {
      post: {
        tags: ["Authentication"],
        summary: "Resend activation invitation",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EmailRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Generic response to prevent account enumeration." },
          "429": { description: "Too many requests." },
        },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Authentication"],
        summary: "Request password reset",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/EmailRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Generic response whether or not the account exists." },
          "429": { description: "Too many requests." },
        },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Authentication"],
        summary: "Reset password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ResetPasswordRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Password reset successfully." },
          "400": { description: "Invalid, expired, or already-used reset token." },
        },
      },
    },
    "/auth/change-password": {
      post: {
        tags: ["Authentication"],
        summary: "Change password",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
            },
          },
        },
        responses: {
          "200": { description: "Password changed successfully." },
          "401": { description: "Authentication failed or current password is incorrect." },
        },
      },
    },
    "/auth/staff": {
      post: {
        tags: ["Authentication"],
        summary: "Create staff account",
        description: "Creates a staff account and sends an activation invitation. Requires USER_CREATE permission.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateStaffRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Staff account created and invitation processed." },
          "401": { description: "Authentication required." },
          "403": { description: "Insufficient permissions or organizational scope." },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Use the access token returned by login or refresh.",
      },
      RefreshCookie: {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
        description: "HttpOnly refresh-token cookie set by the login endpoint.",
      },
    },
    schemas: {
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "staff@example.com" },
          password: { type: "string", example: "YourPassword123!" },
        },
      },
      ActivateRequest: {
        type: "object",
        required: ["activationToken", "password"],
        properties: {
          activationToken: { type: "string" },
          password: { type: "string", minLength: 12 },
        },
      },
      EmailRequest: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email", example: "staff@example.com" },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["token", "newPassword"],
        properties: {
          token: { type: "string" },
          newPassword: { type: "string", minLength: 12 },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string" },
          newPassword: { type: "string", minLength: 12 },
        },
      },
      CreateStaffRequest: {
        type: "object",
        required: ["email", "firstName", "lastName", "roleCode", "organizationId"],
        properties: {
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          firstName: { type: "string" },
          middleName: { type: "string" },
          lastName: { type: "string" },
          roleCode: {
            type: "string",
            enum: [
              "SUPER_ADMIN",
              "AREA_MANAGER",
              "PROJECT_MANAGER",
              "BRANCH_MANAGER",
              "VOLUNTEER_MANAGER",
              "FIELD_SUPERVISOR",
              "HR_OFFICER",
              "FINANCE_OFFICER",
              "VOLUNTEER",
            ],
          },
          organizationId: { type: "string", format: "uuid" },
          areaId: { type: "string", format: "uuid" },
        },
      },
    },
  },
};

export default openApiSpec;
