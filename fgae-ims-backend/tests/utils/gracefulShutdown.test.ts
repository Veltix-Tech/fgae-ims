import { describe, expect, it, vi } from "vitest";
import { gracefulShutdown } from "../../src/utils/gracefulShutdown.js";

describe("gracefulShutdown", () => {
  it("closes the HTTP server before disconnecting the database", async () => {
    const calls: string[] = [];

    const server = {
      close: vi.fn((callback) => {
        calls.push("server");
        callback(null);
        return server;
      }),
    };

    const disconnectDatabase = vi.fn(async () => {
      calls.push("database");
    });

    await gracefulShutdown(
      server as never,
      disconnectDatabase,
    );

    expect(calls).toEqual(["server", "database"]);
    expect(server.close).toHaveBeenCalledOnce();
    expect(disconnectDatabase).toHaveBeenCalledOnce();
  });

  it("does not disconnect the database if server closing fails", async () => {
    const server = {
      close: vi.fn((callback) => {
        callback(new Error("Server close failed"));
        return server;
      }),
    };

    const disconnectDatabase = vi.fn(async () => {});

    await expect(
      gracefulShutdown(server as never, disconnectDatabase),
    ).rejects.toThrow("Server close failed");

    expect(disconnectDatabase).not.toHaveBeenCalled();
  });
});