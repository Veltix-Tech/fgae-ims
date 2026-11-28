import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";

import { loginLimiter } from "../../src/config/rateLimit.js";

describe("Authentication rate limiting", () => {
  const app = express();

  app.use(loginLimiter);

  app.get("/test-login", (_req, res) => {
    res.status(200).json({ message: "Request accepted" });
  });

  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);

    await new Promise<void>((resolve) => {
      server.once("listening", resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine test server address");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  it("allows requests within the configured limit", async () => {
    const response = await fetch(`${baseUrl}/test-login`);

    expect(response.status).toBe(200);
    expect(response.headers.get("ratelimit-limit")).toBe("10");
  });

  it("blocks requests after the configured limit", async () => {
    // The first test already made one request.
    // Send the remaining allowed requests.
    for (let i = 0; i < 9; i++) {
      await fetch(`${baseUrl}/test-login`);
    }

    const response = await fetch(`${baseUrl}/test-login`);

    expect(response.status).toBe(429);

    const body = await response.json() as {
      status: string;
      message: string;
    };

    expect(body.status).toBe("error");
    expect(body.message).toContain("Too many login attempts");
  });
});