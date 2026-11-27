import "dotenv/config";
import { validateEnvironment } from "./config/env.js";
import app from "./app.js";
import prisma from "./config/db.js";
import { gracefulShutdown } from "./utils/gracefulShutdown.js";

validateEnvironment();

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

let isShuttingDown = false;

const shutdown = (signal: string) => {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`${signal} received. Starting graceful shutdown...`);

  const forceShutdownTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    server.closeAllConnections();
    process.exit(1);
  }, 10_000);

  void gracefulShutdown(server, () => prisma.$disconnect())
    .then(() => {
      clearTimeout(forceShutdownTimer);
      console.log("HTTP server and database disconnected.");
      process.exit(0);
    })
    .catch((error: unknown) => {
      clearTimeout(forceShutdownTimer);
      console.error("Error during graceful shutdown:", error);
      process.exit(1);
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));