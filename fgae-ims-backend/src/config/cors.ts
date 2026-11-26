import type { CorsOptions } from "cors";
import { isAllowedOrigin } from "./origins.js";

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Requests without an Origin header include server-to-server
    // and command-line clients. Browser origins must be allowlisted.
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  optionsSuccessStatus: 204,
};