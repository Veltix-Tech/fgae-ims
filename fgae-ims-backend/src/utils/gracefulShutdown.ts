import type { Server } from "node:http";

export const gracefulShutdown = async (
  server: Pick<Server, "close">,
  disconnectDatabase: () => Promise<unknown>,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await disconnectDatabase();
};